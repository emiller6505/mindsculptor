import { createStaticClient } from '@/lib/supabase-static'

// ── Types ────────────────────────────────────────────────────────────────────

export type Archetype = {
  id: string
  name: string
  format: string
  tier: string
  description: string | null
  key_cards: string[] | null
}

export type LatestSnapshot = {
  meta_share: number
  trend_delta: number | null
  top8_count: number
  total_entries: number
  sample_size: number
  confidence: string
  window_end: string
}

export type SharePoint = {
  meta_share: number
  window_end: string
  window_start: string
}

export type RecentResult = {
  pilot: string | null
  placement: number
  record: string | null
  event_name: string
  date: string
  tier: string | null
  source_url: string | null
}

// ── Queries ──────────────────────────────────────────────────────────────────

export async function fetchArchetype(archetypeId: string): Promise<Archetype | null> {
  const supabase = createStaticClient()
  const { data, error } = await supabase
    .from('archetypes')
    .select('id, name, format, tier, description, key_cards')
    .eq('id', archetypeId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data
}

export async function fetchLatestSnapshot(archetypeId: string): Promise<LatestSnapshot | null> {
  const supabase = createStaticClient()
  const { data, error } = await supabase
    .from('metagame_snapshots')
    .select('meta_share, trend_delta, top8_count, total_entries, sample_size, confidence, window_end, window_start')
    .eq('archetype_id', archetypeId)
    .order('window_end', { ascending: false })
    .order('window_start', { ascending: false })
    .limit(1)

  if (error) throw new Error(error.message)
  if (!data || data.length === 0) return null
  return data[0]
}

export async function fetchShareHistory(archetypeId: string): Promise<SharePoint[]> {
  const supabase = createStaticClient()
  const { data, error } = await supabase
    .from('metagame_snapshots')
    .select('meta_share, window_end, window_start')
    .eq('archetype_id', archetypeId)
    .order('window_end', { ascending: true })

  if (error) throw new Error(error.message)
  if (!data) return []

  // Deduplicate by window_end, keeping shortest window (30d preferred)
  const byWindowEnd = new Map<string, SharePoint>()
  for (const row of data) {
    const existing = byWindowEnd.get(row.window_end)
    if (!existing) {
      byWindowEnd.set(row.window_end, row)
    } else {
      const existingSpan = new Date(existing.window_end).getTime() - new Date(existing.window_start).getTime()
      const rowSpan = new Date(row.window_end).getTime() - new Date(row.window_start).getTime()
      if (rowSpan < existingSpan) {
        byWindowEnd.set(row.window_end, row)
      }
    }
  }
  return Array.from(byWindowEnd.values())
}

export async function fetchHasMatches(): Promise<boolean> {
  const supabase = createStaticClient()
  const { count, error } = await supabase
    .from('matches')
    .select('*', { count: 'exact', head: true })

  if (error) return false
  return (count ?? 0) > 0
}

export async function fetchRecentResults(archetypeId: string): Promise<RecentResult[]> {
  const supabase = createStaticClient()
  const { data, error } = await supabase
    .from('deck_archetypes')
    .select(`
      decks!inner(
        pilot,
        placement,
        record,
        tournaments!inner(
          name,
          date,
          tier,
          source_url
        )
      )
    `)
    .eq('archetype_id', archetypeId)
    .not('decks.placement', 'is', null)
    .limit(50)

  if (error) throw new Error(error.message)
  if (!data) return []

  return extractRecentResults(data)
}

// PostgREST nests joins — flatten to our shape
export function extractRecentResults(data: unknown[]): RecentResult[] {
  const results: RecentResult[] = []
  for (const row of data) {
    const r = row as { decks: { pilot: string | null; placement: number; record: string | null; tournaments: { name: string; date: string; tier: string | null; source_url: string | null } } }
    const d = r.decks
    if (!d || d.placement == null) continue
    const t = d.tournaments
    if (!t) continue
    results.push({
      pilot: d.pilot,
      placement: d.placement,
      record: d.record,
      event_name: t.name,
      date: t.date,
      tier: t.tier,
      source_url: t.source_url,
    })
  }
  // Sort: newest first, then by placement asc — take top 10
  results.sort((a, b) => {
    const dateDiff = b.date.localeCompare(a.date)
    if (dateDiff !== 0) return dateDiff
    return a.placement - b.placement
  })
  return results.slice(0, 10)
}

export async function fetchAllArchetypeIds(): Promise<{ format: string; archetype: string }[]> {
  const supabase = createStaticClient()
  const { data, error } = await supabase
    .from('archetypes')
    .select('id, format')

  if (error) throw new Error(error.message)
  if (!data) return []

  return data.map(row => ({ format: row.format, archetype: row.id }))
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function trendArrow(delta: number | null): { label: string; color: string } | null {
  if (delta == null) return null
  if (delta > 3) return { label: '↑↑', color: 'text-spark' }
  if (delta > 0) return { label: '↑', color: 'text-spark' }
  if (delta === 0) return { label: '→', color: 'text-ash' }
  if (delta > -3) return { label: '↓', color: 'text-flame' }
  return { label: '↓↓', color: 'text-flame' }
}
