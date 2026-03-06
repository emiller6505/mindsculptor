import { createClient } from '@/lib/supabase-server'
import { DbError } from '@/lib/db-error'

const RANGE_DAYS: Record<string, number> = { '30d': 30, '60d': 60, '90d': 90 }

export function parseRange(raw?: string): number {
  return RANGE_DAYS[raw ?? ''] ?? 30
}

export type SnapshotRow = {
  id: number
  format: string
  window_start: string
  window_end: string
  archetype_id: string
  top8_count: number
  total_entries: number
  meta_share: number | null
  trend_delta: number | null
  sample_size: number
  confidence: string
  computed_at: string
  archetypes: { id: string; name: string; tier: string | null }
}

export type HeaderStats = {
  sample_size: number
  confidence: string
  window_start: string
  window_end: string
  computed_at: string
}

export type MetaShareEntry = {
  archetype_id: string
  archetype_name: string
  tier: string | null
  meta_share: number
  trend_delta: number | null
}

export type MoverEntry = {
  archetype_id: string
  archetype_name: string
  trend_delta: number
}

export type TrendPoint = {
  archetype_id: string
  archetype_name: string
  window_end: string
  meta_share: number
}

export async function fetchCurrentWindow(format: string, rangeDays: number) {
  const supabase = await createClient()

  // The analyzer stores multiple rows per archetype per window_end — one per
  // window size (30d, 60d, 90d). We want only the row whose window_start
  // matches the user's selected range. Compute the expected window_start from
  // the most recent window_end, then filter to that exact window_start.
  //
  // Step 1: find the latest window_end for this format
  const { data: latest, error: latestErr } = await supabase
    .from('metagame_snapshots')
    .select('window_end')
    .eq('format', format)
    .order('window_end', { ascending: false })
    .limit(1)

  if (latestErr) throw new DbError('fetch_latest_window', latestErr.message)
  if (!latest?.length) return []

  const windowEnd = latest[0].window_end as string
  const endDate = new Date(windowEnd)
  const startDate = new Date(endDate)
  startDate.setDate(startDate.getDate() - rangeDays)
  const windowStart = startDate.toISOString().slice(0, 10)

  // Step 2: fetch snapshots matching this exact window
  const { data, error } = await supabase
    .from('metagame_snapshots')
    .select('*, archetypes!inner(id, name, tier)')
    .eq('format', format)
    .eq('window_end', windowEnd)
    .eq('window_start', windowStart)
    .order('meta_share', { ascending: false })

  if (error) throw new DbError('fetch_current_window', error.message)
  return (data ?? []) as SnapshotRow[]
}

export function extractHeaderStats(rows: SnapshotRow[]): HeaderStats | null {
  if (rows.length === 0) return null

  // Deduplicate by archetype_id
  const seen = new Set<string>()
  const currentWindow = rows.filter(r => {
    if (seen.has(r.archetype_id)) return false
    seen.add(r.archetype_id)
    return true
  })
  const totalSample = currentWindow.reduce((sum, r) => sum + r.sample_size, 0)
  const confidences = currentWindow.map(r => r.confidence)

  // Worst confidence in current window
  const order = ['LOW', 'MEDIUM', 'HIGH', 'VERY HIGH']
  const worstIdx = Math.min(...confidences.map(c => order.indexOf(c)))

  return {
    sample_size: totalSample,
    confidence: order[worstIdx] ?? 'LOW',
    window_start: currentWindow.at(-1)?.window_start ?? rows[0].window_end,
    window_end: rows[0].window_end,
    computed_at: rows[0].computed_at,
  }
}

export function extractMetaShare(rows: SnapshotRow[]): MetaShareEntry[] {
  if (rows.length === 0) return []

  // Deduplicate by archetype_id — keep first occurrence (highest meta_share since rows are pre-sorted)
  const seen = new Set<string>()
  const result: MetaShareEntry[] = []
  for (const r of rows) {
    if (r.meta_share == null || seen.has(r.archetype_id)) continue
    seen.add(r.archetype_id)
    result.push({
      archetype_id: r.archetype_id,
      archetype_name: r.archetypes.name,
      tier: r.archetypes.tier,
      meta_share: r.meta_share,
      trend_delta: r.trend_delta,
    })
  }
  return result.sort((a, b) => b.meta_share - a.meta_share)
}

export function extractTopMovers(rows: SnapshotRow[]): { gainers: MoverEntry[]; losers: MoverEntry[] } {
  if (rows.length === 0) return { gainers: [], losers: [] }

  // Deduplicate by archetype_id
  const seen = new Set<string>()
  const current = rows.filter(r => {
    if (r.trend_delta == null || seen.has(r.archetype_id)) return false
    seen.add(r.archetype_id)
    return true
  })

  const gainers = current
    .filter(r => r.trend_delta! > 0)
    .sort((a, b) => b.trend_delta! - a.trend_delta!)
    .slice(0, 3)
    .map(r => ({ archetype_id: r.archetype_id, archetype_name: r.archetypes.name, trend_delta: r.trend_delta! }))

  const losers = current
    .filter(r => r.trend_delta! < 0)
    .sort((a, b) => a.trend_delta! - b.trend_delta!)
    .slice(0, 3)
    .map(r => ({ archetype_id: r.archetype_id, archetype_name: r.archetypes.name, trend_delta: r.trend_delta! }))

  return { gainers, losers }
}

export async function fetchTrendLines(format: string) {
  const supabase = await createClient()

  // Get all snapshots for format, no range filter
  const { data, error } = await supabase
    .from('metagame_snapshots')
    .select('*, archetypes!inner(id, name, tier)')
    .eq('format', format)
    .order('window_end', { ascending: true })

  if (error) throw new DbError('fetch_trend_lines', error.message)
  const rows = (data ?? []) as SnapshotRow[]

  if (rows.length === 0) return []

  // Find top 8 by most recent meta_share
  const latestEnd = rows.at(-1)!.window_end
  const latestWindow = rows.filter(r => r.window_end === latestEnd && r.meta_share != null)
  const top8Ids = latestWindow
    .sort((a, b) => (b.meta_share ?? 0) - (a.meta_share ?? 0))
    .slice(0, 8)
    .map(r => r.archetype_id)

  const top8Set = new Set(top8Ids)

  // Deduplicate by archetype_id + window_end (keep first = shortest window)
  const seen = new Set<string>()
  return rows
    .filter(r => {
      const key = `${r.archetype_id}|${r.window_end}`
      if (!top8Set.has(r.archetype_id) || r.meta_share == null || seen.has(key)) return false
      seen.add(key)
      return true
    })
    .map(r => ({
      archetype_id: r.archetype_id,
      archetype_name: r.archetypes.name,
      window_end: r.window_end,
      meta_share: r.meta_share!,
    }))
}

export async function hasSnapshots(format: string): Promise<boolean> {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from('metagame_snapshots')
    .select('id', { count: 'exact', head: true })
    .eq('format', format)
    .limit(1)

  if (error) return false
  return (count ?? 0) > 0
}

export async function fetchTopArchetypeNames(format: string): Promise<string[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('metagame_snapshots')
    .select('meta_share, archetypes!inner(name)')
    .eq('format', format)
    .order('window_end', { ascending: false })
    .limit(20)

  if (error || !data) return []

  type Row = { meta_share: number | null; archetypes: { name: string } }
  const rows = data as unknown as Row[]

  if (rows.length === 0) return []

  // latest window_end is implicitly the first rows since ordered desc
  // just take unique names sorted by meta_share
  const seen = new Set<string>()
  const result: string[] = []
  for (const r of rows) {
    if (r.meta_share != null && !seen.has(r.archetypes.name)) {
      seen.add(r.archetypes.name)
      result.push(r.archetypes.name)
      if (result.length === 3) break
    }
  }
  return result
}
