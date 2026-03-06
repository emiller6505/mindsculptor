import { vi, describe, it, expect, beforeEach } from 'vitest'

// Mock supabase-server before importing queries
vi.mock('../../../lib/supabase-server', () => ({
  createClient: vi.fn(),
}))

import { createClient } from '../../../lib/supabase-server'
import {
  parseRange,
  fetchCurrentWindow,
  fetchTrendLines,
  fetchTopArchetypeNames,
  hasSnapshots,
  extractHeaderStats,
  extractMetaShare,
  extractTopMovers,
  type SnapshotRow,
} from '../[format]/queries'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ARCHETYPES = [
  { id: 'boros-energy-modern', name: 'Boros Energy', tier: 'S' },
  { id: 'goryo-modern', name: "Goryo's Vengeance", tier: 'A' },
  { id: 'mardu-modern', name: 'Mardu Midrange', tier: 'B' },
  { id: 'amulet-modern', name: 'Amulet Titan', tier: 'A' },
  { id: 'murktide-modern', name: 'Murktide Regent', tier: 'A' },
  { id: 'burn-modern', name: 'Burn', tier: 'B' },
  { id: 'tron-modern', name: 'Tron', tier: 'B' },
  { id: 'mill-modern', name: 'Mill', tier: 'C' },
]

function makeSnapshot(overrides: Partial<SnapshotRow> & { archetype_id: string; window_end: string }): SnapshotRow {
  const arch = ARCHETYPES.find(a => a.id === overrides.archetype_id) ?? ARCHETYPES[0]
  const { archetype_id, window_end, ...rest } = overrides
  return {
    id: Math.floor(Math.random() * 10000),
    format: 'modern',
    window_start: '2026-01-01',
    window_end,
    archetype_id,
    top8_count: 3,
    total_entries: 60,
    meta_share: 10,
    trend_delta: null,
    sample_size: 120,
    confidence: 'MEDIUM',
    computed_at: '2026-01-07T00:00:00Z',
    archetypes: arch,
    ...rest,
  }
}

// Window 1 (oldest) — no trend_delta
const WINDOW_1 = [
  makeSnapshot({ archetype_id: 'boros-energy-modern', window_start: '2026-01-01', window_end: '2026-01-07', meta_share: 18.5, trend_delta: null, sample_size: 120, confidence: 'MEDIUM' }),
  makeSnapshot({ archetype_id: 'goryo-modern', window_start: '2026-01-01', window_end: '2026-01-07', meta_share: 12.0, trend_delta: null, sample_size: 120, confidence: 'MEDIUM' }),
  makeSnapshot({ archetype_id: 'mardu-modern', window_start: '2026-01-01', window_end: '2026-01-07', meta_share: 9.0, trend_delta: null, sample_size: 120, confidence: 'MEDIUM' }),
  makeSnapshot({ archetype_id: 'amulet-modern', window_start: '2026-01-01', window_end: '2026-01-07', meta_share: 8.0, trend_delta: null, sample_size: 120, confidence: 'MEDIUM' }),
  makeSnapshot({ archetype_id: 'murktide-modern', window_start: '2026-01-01', window_end: '2026-01-07', meta_share: 7.0, trend_delta: null, sample_size: 120, confidence: 'MEDIUM' }),
  makeSnapshot({ archetype_id: 'burn-modern', window_start: '2026-01-01', window_end: '2026-01-07', meta_share: 6.5, trend_delta: null, sample_size: 120, confidence: 'MEDIUM' }),
  makeSnapshot({ archetype_id: 'tron-modern', window_start: '2026-01-01', window_end: '2026-01-07', meta_share: 5.0, trend_delta: null, sample_size: 120, confidence: 'MEDIUM' }),
  makeSnapshot({ archetype_id: 'mill-modern', window_start: '2026-01-01', window_end: '2026-01-07', meta_share: 3.0, trend_delta: null, sample_size: 120, confidence: 'MEDIUM' }),
]

// Window 2
const WINDOW_2 = [
  makeSnapshot({ archetype_id: 'boros-energy-modern', window_start: '2026-01-08', window_end: '2026-01-14', meta_share: 21.2, trend_delta: 2.7, sample_size: 150, confidence: 'HIGH' }),
  makeSnapshot({ archetype_id: 'goryo-modern', window_start: '2026-01-08', window_end: '2026-01-14', meta_share: 10.5, trend_delta: -1.5, sample_size: 150, confidence: 'HIGH' }),
  makeSnapshot({ archetype_id: 'mardu-modern', window_start: '2026-01-08', window_end: '2026-01-14', meta_share: 11.0, trend_delta: 2.0, sample_size: 150, confidence: 'HIGH' }),
  makeSnapshot({ archetype_id: 'amulet-modern', window_start: '2026-01-08', window_end: '2026-01-14', meta_share: 7.5, trend_delta: -0.5, sample_size: 150, confidence: 'HIGH' }),
  makeSnapshot({ archetype_id: 'murktide-modern', window_start: '2026-01-08', window_end: '2026-01-14', meta_share: 8.0, trend_delta: 1.0, sample_size: 150, confidence: 'HIGH' }),
  makeSnapshot({ archetype_id: 'burn-modern', window_start: '2026-01-08', window_end: '2026-01-14', meta_share: 5.0, trend_delta: -1.5, sample_size: 150, confidence: 'HIGH' }),
  makeSnapshot({ archetype_id: 'tron-modern', window_start: '2026-01-08', window_end: '2026-01-14', meta_share: 5.5, trend_delta: 0.5, sample_size: 150, confidence: 'HIGH' }),
  makeSnapshot({ archetype_id: 'mill-modern', window_start: '2026-01-08', window_end: '2026-01-14', meta_share: 2.5, trend_delta: -0.5, sample_size: 150, confidence: 'HIGH' }),
]

// Window 3 (most recent)
const WINDOW_3 = [
  makeSnapshot({ archetype_id: 'boros-energy-modern', window_start: '2026-01-15', window_end: '2026-01-21', meta_share: 24.0, trend_delta: 2.8, sample_size: 180, confidence: 'VERY HIGH' }),
  makeSnapshot({ archetype_id: 'goryo-modern', window_start: '2026-01-15', window_end: '2026-01-21', meta_share: 9.0, trend_delta: -1.5, sample_size: 180, confidence: 'VERY HIGH' }),
  makeSnapshot({ archetype_id: 'mardu-modern', window_start: '2026-01-15', window_end: '2026-01-21', meta_share: 12.5, trend_delta: 1.5, sample_size: 180, confidence: 'VERY HIGH' }),
  makeSnapshot({ archetype_id: 'amulet-modern', window_start: '2026-01-15', window_end: '2026-01-21', meta_share: 6.0, trend_delta: -1.5, sample_size: 180, confidence: 'VERY HIGH' }),
  makeSnapshot({ archetype_id: 'murktide-modern', window_start: '2026-01-15', window_end: '2026-01-21', meta_share: 8.5, trend_delta: 0.5, sample_size: 180, confidence: 'VERY HIGH' }),
  makeSnapshot({ archetype_id: 'burn-modern', window_start: '2026-01-15', window_end: '2026-01-21', meta_share: 4.0, trend_delta: -1.0, sample_size: 180, confidence: 'VERY HIGH' }),
  makeSnapshot({ archetype_id: 'tron-modern', window_start: '2026-01-15', window_end: '2026-01-21', meta_share: 6.0, trend_delta: 0.5, sample_size: 180, confidence: 'VERY HIGH' }),
  makeSnapshot({ archetype_id: 'mill-modern', window_start: '2026-01-15', window_end: '2026-01-21', meta_share: 2.0, trend_delta: -0.5, sample_size: 180, confidence: 'VERY HIGH' }),
]

// All 3 windows sorted by window_end desc (as Supabase returns with order desc)
const ALL_ROWS_DESC = [...WINDOW_3, ...WINDOW_2, ...WINDOW_1]
// All 3 windows sorted by window_end asc (for trend lines)
const ALL_ROWS_ASC = [...WINDOW_1, ...WINDOW_2, ...WINDOW_3]

// ── Chainable mock ───────────────────────────────────────────────────────────

type PgResult = { data: unknown; error: { message: string } | null; count?: number | null }

function makeChainable(result: PgResult) {
  const chain: Record<string, unknown> = {
    single: () => Promise.resolve(result),
    maybeSingle: () => Promise.resolve(result),
    then: (resolve: (v: PgResult) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  }
  for (const m of ['select', 'eq', 'gte', 'lte', 'order', 'limit', 'in', 'not']) {
    chain[m] = () => chain
  }
  return chain
}

function mockSupabase(result: PgResult) {
  const client = { from: vi.fn(() => makeChainable(result)) }
  vi.mocked(createClient).mockResolvedValue(client as never)
  return client
}

function mockSupabaseSequential(...results: PgResult[]) {
  const from = vi.fn()
  for (const r of results) {
    from.mockReturnValueOnce(makeChainable(r))
  }
  // Fall back to empty for any extra calls
  from.mockReturnValue(makeChainable({ data: [], error: null }))
  const client = { from }
  vi.mocked(createClient).mockResolvedValue(client as never)
  return client
}

// ── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => { vi.resetAllMocks() })

describe('parseRange', () => {
  it('parses known ranges', () => {
    expect(parseRange('30d')).toBe(30)
    expect(parseRange('60d')).toBe(60)
    expect(parseRange('90d')).toBe(90)
  })

  it('defaults to 30 for unknown input', () => {
    expect(parseRange(undefined)).toBe(30)
    expect(parseRange('7d')).toBe(30)
    expect(parseRange('garbage')).toBe(30)
  })
})

describe('extractMetaShare', () => {
  it('extracts current window sorted by meta_share desc', () => {
    const result = extractMetaShare(ALL_ROWS_DESC)

    expect(result).toHaveLength(8)
    expect(result[0].archetype_name).toBe('Boros Energy')
    expect(result[0].meta_share).toBe(24.0)
    expect(result[0].tier).toBe('S')
    expect(result[1].archetype_name).toBe('Mardu Midrange')
    expect(result[1].meta_share).toBe(12.5)

    // Verify sorted descending
    for (let i = 1; i < result.length; i++) {
      expect(result[i].meta_share).toBeLessThanOrEqual(result[i - 1].meta_share)
    }
  })
})

describe('extractTopMovers', () => {
  it('returns top 3 gainers and losers from current window', () => {
    const { gainers, losers } = extractTopMovers(ALL_ROWS_DESC)

    expect(gainers).toHaveLength(3)
    expect(gainers[0].archetype_name).toBe('Boros Energy')
    expect(gainers[0].trend_delta).toBe(2.8)
    expect(gainers[1].archetype_name).toBe('Mardu Midrange')
    expect(gainers[2].trend_delta).toBe(0.5) // Murktide or Tron

    expect(losers).toHaveLength(3)
    expect(losers[0].trend_delta).toBeLessThan(0)
    // Top losers: goryo -1.5, amulet -1.5, burn -1.0
  })
})

describe('extractHeaderStats', () => {
  it('returns aggregate stats from current window', () => {
    const stats = extractHeaderStats(ALL_ROWS_DESC)

    expect(stats).not.toBeNull()
    expect(stats!.window_end).toBe('2026-01-21')
    expect(stats!.sample_size).toBe(180 * 8) // 8 archetypes × 180
    expect(stats!.confidence).toBe('VERY HIGH')
    expect(stats!.computed_at).toBe('2026-01-07T00:00:00Z')
  })

  it('returns null for empty rows', () => {
    expect(extractHeaderStats([])).toBeNull()
  })
})

describe('fetchCurrentWindow', () => {
  it('calls supabase with correct filters', async () => {
    // First call: find latest window_end; second call: fetch matching rows
    const client = mockSupabaseSequential(
      { data: [{ window_end: '2026-01-21' }], error: null },
      { data: WINDOW_3, error: null },
    )

    const result = await fetchCurrentWindow('modern', 30)

    expect(client.from).toHaveBeenCalledTimes(2)
    expect(client.from).toHaveBeenCalledWith('metagame_snapshots')
    expect(result).toHaveLength(WINDOW_3.length)
  })

  it('returns empty when no snapshots exist', async () => {
    mockSupabase({ data: [], error: null })

    const result = await fetchCurrentWindow('modern', 30)

    expect(result).toHaveLength(0)
  })

  it('throws on supabase error', async () => {
    mockSupabase({ data: null, error: { message: 'connection failed' } })

    await expect(fetchCurrentWindow('modern', 30)).rejects.toThrow('fetch_latest_window')
  })
})

describe('fetchTrendLines', () => {
  it('returns trend data for top 8 archetypes ordered by window_end asc', async () => {
    mockSupabase({ data: ALL_ROWS_ASC, error: null })

    const result = await fetchTrendLines('modern')

    expect(result.length).toBeGreaterThan(0)
    // Should have entries for 3 windows × 8 archetypes
    expect(result).toHaveLength(24)

    // Verify ordered by window_end asc
    const windows = result.map(r => r.window_end)
    for (let i = 1; i < windows.length; i++) {
      expect(windows[i] >= windows[i - 1]).toBe(true)
    }
  })

  it('returns empty array for no data', async () => {
    mockSupabase({ data: [], error: null })

    const result = await fetchTrendLines('modern')

    expect(result).toHaveLength(0)
  })
})

describe('empty states', () => {
  it('extractMetaShare returns empty for no snapshots', () => {
    expect(extractMetaShare([])).toHaveLength(0)
  })

  it('extractTopMovers returns empty when all trend_delta null', () => {
    // WINDOW_1 has all null trend_deltas
    const { gainers, losers } = extractTopMovers(WINDOW_1)

    expect(gainers).toHaveLength(0)
    expect(losers).toHaveLength(0)
  })
})

describe('fetchTopArchetypeNames (SEO)', () => {
  it('returns top 3 archetype names', async () => {
    const seoRows = [
      { meta_share: 24.0, archetypes: { name: 'Boros Energy' } },
      { meta_share: 12.5, archetypes: { name: 'Mardu Midrange' } },
      { meta_share: 9.0, archetypes: { name: "Goryo's Vengeance" } },
      { meta_share: 8.5, archetypes: { name: 'Murktide Regent' } },
    ]
    mockSupabase({ data: seoRows, error: null })

    const names = await fetchTopArchetypeNames('modern')

    expect(names).toEqual(['Boros Energy', 'Mardu Midrange', "Goryo's Vengeance"])
  })

  it('returns empty array on error', async () => {
    mockSupabase({ data: null, error: { message: 'fail' } })

    const names = await fetchTopArchetypeNames('modern')

    expect(names).toEqual([])
  })
})

describe('hasSnapshots', () => {
  it('returns true when count > 0', async () => {
    mockSupabase({ data: null, error: null, count: 5 })

    const result = await hasSnapshots('modern')

    expect(result).toBe(true)
  })

  it('returns false when count is 0', async () => {
    mockSupabase({ data: null, error: null, count: 0 })

    const result = await hasSnapshots('modern')

    expect(result).toBe(false)
  })

  it('returns false on error', async () => {
    mockSupabase({ data: null, error: { message: 'fail' }, count: null })

    const result = await hasSnapshots('modern')

    expect(result).toBe(false)
  })
})

describe('format validation', () => {
  it('parseRange handles all valid ranges', () => {
    expect(parseRange('30d')).toBe(30)
    expect(parseRange('60d')).toBe(60)
    expect(parseRange('90d')).toBe(90)
  })
})
