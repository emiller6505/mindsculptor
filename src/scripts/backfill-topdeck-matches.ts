import 'dotenv/config'
import { createHash } from 'node:crypto'
import { supabase } from '../lib/supabase.js'
import { buildMatchRows } from '../parsers/topdeck.js'
import type { RoundData } from '../parsers/topdeck.js'

const BASE_URL = 'https://topdeck.gg/api'
const RATE_LIMIT_MS = 2000
const MIN_PLAYERS = 16

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function apiKey(): string {
  const key = process.env.TOPDECK_API_KEY
  if (!key) throw new Error('TOPDECK_API_KEY not set')
  return key
}

async function get(path: string): Promise<unknown> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30_000)
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { 'Authorization': apiKey() },
      signal: controller.signal,
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`HTTP ${res.status}: ${text}`)
    }
    return res.json()
  } finally {
    clearTimeout(timeout)
  }
}

function stableId(...parts: string[]): string {
  return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 16)
}

async function backfill(): Promise<void> {
  // Select only lightweight columns — no raw_content
  const { data: jobs, error } = await supabase
    .from('scrape_jobs')
    .select('id, source_url')
    .eq('source', 'topdeck')
    .eq('status', 'parsed')
    .order('id')
  if (error) throw new Error(`DB error: ${error.message}`)
  if (!jobs?.length) { console.log('[backfill] No parsed TopDeck jobs found'); return }

  console.log(`[backfill] ${jobs.length} total parsed TopDeck jobs`)

  let success = 0, skipped = 0, errors = 0

  for (const [i, job] of jobs.entries()) {
    const tid = job.source_url
    const tournamentId = stableId('topdeck', tid)
    try {
      // Check player count from tournaments table
      const { data: tournament, error: tErr } = await supabase
        .from('tournaments')
        .select('player_count')
        .eq('id', tournamentId)
        .single()
      if (tErr || !tournament || (tournament.player_count ?? 0) < MIN_PLAYERS) {
        skipped++
        continue
      }

      // Check if matches already exist for this tournament
      const { count, error: cErr } = await supabase
        .from('matches')
        .select('id', { count: 'exact', head: true })
        .eq('tournament_id', tournamentId)
      if (cErr) throw new Error(`Count error: ${cErr.message}`)
      if (count && count > 0) {
        console.log(`[backfill] skip ${tid} — already has ${count} matches`)
        skipped++
        continue
      }

      // Fetch rounds from API
      const rounds = await get(`/v2/tournaments/${tid}/rounds`) as RoundData[]
      if (!Array.isArray(rounds) || rounds.length === 0) {
        console.log(`[backfill] skip ${tid} — no rounds data from API`)
        skipped++
        if (i < jobs.length - 1) await sleep(RATE_LIMIT_MS)
        continue
      }

      // Build player→deck_id map from existing decks in DB
      const { data: decks, error: dErr } = await supabase
        .from('decks')
        .select('id, pilot')
        .eq('tournament_id', tournamentId)
      if (dErr) throw new Error(`Deck lookup: ${dErr.message}`)

      const playerToDeckId = new Map<string, string>()
      for (const d of decks ?? []) {
        if (d.pilot) playerToDeckId.set(d.pilot, d.id)
      }

      const matchRows = buildMatchRows(rounds, tournamentId, playerToDeckId)

      if (matchRows.length > 0) {
        const { error: mErr } = await supabase
          .from('matches')
          .upsert(matchRows, { onConflict: 'tournament_id,round,player_a', ignoreDuplicates: true })
        if (mErr) throw new Error(`Match upsert: ${mErr.message}`)
      }

      // Patch rounds into scrape_job raw_content so future re-parses have it
      const { data: full, error: fErr } = await supabase
        .from('scrape_jobs')
        .select('raw_content')
        .eq('id', job.id)
        .single()
      if (!fErr && full) {
        const parsed = JSON.parse(full.raw_content)
        parsed.rounds = rounds
        await supabase
          .from('scrape_jobs')
          .update({ raw_content: JSON.stringify(parsed) })
          .eq('id', job.id)
      }

      success++
      console.log(`[backfill] ${tid} — ${matchRows.length} matches (${playerToDeckId.size} decks linked)`)
    } catch (err) {
      errors++
      console.error(`[backfill] error ${tid}:`, err)
    }

    if (i < jobs.length - 1) await sleep(RATE_LIMIT_MS)
  }

  console.log(`[backfill] Done — success: ${success}, skipped: ${skipped}, errors: ${errors}`)
}

backfill().catch(err => { console.error('[backfill] Fatal:', err); process.exit(1) })
