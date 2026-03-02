import { supabase } from '../lib/supabase'
import type { Intent } from './intent'

export interface DeckSummary {
  pilot: string
  placement: number | null
  tournament_name: string
  tournament_date: string
  tier: string | null
  mainboard: { name: string; qty: number }[]
  sideboard: { name: string; qty: number }[]
}

export interface CardInfo {
  name: string
  oracle_text: string | null
  type_line: string | null
  mana_cost: string | null
  cmc: number | null
  appearances: number  // count of recent deck_cards rows
}

export interface RetrievedData {
  format: string | null
  window_days: number
  tournaments_count: number
  top_decks: DeckSummary[]
  card_info: CardInfo | null
}

export async function retrieveContext(intent: Intent): Promise<RetrievedData> {
  const window_days = intent.timeframe_days
  const cutoff = new Date(Date.now() - window_days * 86_400_000).toISOString().split('T')[0]

  const [topDecks, cardInfo] = await Promise.all([
    fetchTopDecks(intent.format, cutoff, intent.archetype, intent.archetype_b),
    intent.card ? fetchCardInfo(intent.card, intent.format, cutoff) : Promise.resolve(null),
  ])

  const tournaments_count = new Set(topDecks.map(d => d.tournament_name)).size

  return { format: intent.format, window_days, tournaments_count, top_decks: topDecks, card_info: cardInfo }
}

async function fetchTopDecks(
  format: string | null,
  cutoff: string,
  archetype: string | null,
  archetype_b: string | null,
): Promise<DeckSummary[]> {
  // Fetch top-placing decks with their card lists.
  // Limit to top 24 by placement to keep context size reasonable.
  let query = supabase
    .from('decks')
    .select(`
      pilot,
      placement,
      raw_list,
      tournaments!inner (
        name,
        date,
        format,
        tier
      )
    `)
    .gte('tournaments.date', cutoff)
    .not('placement', 'is', null)
    .order('placement', { ascending: true })
    .limit(24)

  if (format) query = query.eq('tournaments.format', format)

  const { data, error } = await query
  if (error) throw new Error(`Deck retrieval error: ${error.message}`)

  let decks = (data ?? []).map(row => {
    const t = row.tournaments as unknown as { name: string; date: string; format: string; tier: string | null }
    const rawList = row.raw_list as { mainboard: { name: string; qty: number }[]; sideboard: { name: string; qty: number }[] } | null
    return {
      pilot: row.pilot ?? 'Unknown',
      placement: row.placement,
      tournament_name: t.name,
      tournament_date: t.date,
      tier: t.tier,
      mainboard: rawList?.mainboard ?? [],
      sideboard: rawList?.sideboard ?? [],
    }
  })

  // For matchup and deck_advice with a specific archetype, filter by key card overlap.
  // This is a heuristic until archetype classification lands in Phase 4.
  const archetypes = [archetype, archetype_b].filter(Boolean) as string[]
  if (archetypes.length > 0) {
    decks = filterByArchetypeHint(decks, archetypes)
  }

  return decks
}

// Simple heuristic: an archetype hint like "Burn" → look for decks containing Eidolon of the Great Revel,
// Lightning Bolt, etc. We do this by checking if the archetype name appears as a substring in any card names
// or if the archetype name words match common card names in the mainboard.
// Phase 4 will replace this with proper archetype classification.
function filterByArchetypeHint(decks: DeckSummary[], archetypes: string[]): DeckSummary[] {
  const keywords = archetypes.flatMap(a => a.toLowerCase().split(/\s+/))
  return decks.filter(d =>
    d.mainboard.some(c =>
      keywords.some(kw => c.name.toLowerCase().includes(kw))
    )
  )
}

async function fetchCardInfo(card: string, format: string | null, cutoff: string): Promise<CardInfo | null> {
  const { data: cardRow, error: cardErr } = await supabase
    .from('cards')
    .select('name, oracle_text, type_line, mana_cost, cmc')
    .ilike('name', card)
    .limit(1)
    .single()

  if (cardErr || !cardRow) return null

  // Two-step approach: get qualifying tournament IDs, then deck IDs, then count appearances.
  // Avoids deeply nested PostgREST filter chains.
  let tourneyQuery = supabase.from('tournaments').select('id').gte('date', cutoff)
  if (format) tourneyQuery = tourneyQuery.eq('format', format)
  const { data: tourneys } = await tourneyQuery
  const tourneyIds = (tourneys ?? []).map(t => t.id)

  if (tourneyIds.length === 0) {
    return { name: cardRow.name, oracle_text: cardRow.oracle_text, type_line: cardRow.type_line, mana_cost: cardRow.mana_cost, cmc: cardRow.cmc, appearances: 0 }
  }

  const { data: decks } = await supabase
    .from('decks')
    .select('id')
    .in('tournament_id', tourneyIds)
    .not('placement', 'is', null)
    .lte('placement', 32)
  const deckIds = (decks ?? []).map(d => d.id)

  const { count } = await supabase
    .from('deck_cards')
    .select('*', { count: 'exact', head: true })
    .eq('card_name', cardRow.name)
    .in('deck_id', deckIds)

  return {
    name: cardRow.name,
    oracle_text: cardRow.oracle_text,
    type_line: cardRow.type_line,
    mana_cost: cardRow.mana_cost,
    cmc: cardRow.cmc,
    appearances: count ?? 0,
  }
}
