import { supabase } from '../lib/supabase'
import type { Intent } from './intent'

// Voyage embeddings are optional — only used if VOYAGE_API_KEY is set
async function resolveArchetypeIds(archetypes: string[], format: string | null): Promise<string[] | null> {
  if (!process.env.VOYAGE_API_KEY || !format) return null
  try {
    const { embed } = await import('../lib/voyage')
    const [vector] = await embed([archetypes.join(' ')])
    const { data, error } = await supabase.rpc('match_archetypes', {
      query_embedding: JSON.stringify(vector),
      format_filter: format,
      match_count: archetypes.length * 2,
    })
    if (error || !data?.length) return null
    return (data as { id: string; similarity: number }[])
      .filter(r => r.similarity >= 0.7)
      .map(r => r.id)
  } catch {
    return null
  }
}

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
  const archetypeHints = [archetype, archetype_b].filter(Boolean) as string[]

  // If archetypes are mentioned, try to resolve them to IDs via vector search first.
  // If that fails (no VOYAGE_API_KEY or no embeddings yet), fall through to keyword heuristic below.
  let archetypeIds: string[] | null = null
  if (archetypeHints.length > 0) {
    archetypeIds = await resolveArchetypeIds(archetypeHints, format)
  }

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

  // When we have resolved archetype IDs, filter decks via deck_archetypes join
  if (archetypeIds && archetypeIds.length > 0) {
    const { data: archetypeDecks } = await supabase
      .from('deck_archetypes')
      .select('deck_id')
      .in('archetype_id', archetypeIds)
    const deckIds = (archetypeDecks ?? []).map(r => r.deck_id)
    if (deckIds.length > 0) query = query.in('id', deckIds)
  }

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

  // Fallback: keyword heuristic when vector search isn't available or returned nothing
  if (archetypeHints.length > 0 && archetypeIds === null) {
    decks = filterByArchetypeHint(decks, archetypeHints)
  }

  return decks
}

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
