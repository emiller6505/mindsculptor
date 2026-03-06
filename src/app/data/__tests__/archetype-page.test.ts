import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('../../../lib/supabase-static', () => ({
  createStaticClient: vi.fn(),
}))

vi.mock('../../../lib/supabase-server', () => ({
  createClient: vi.fn(),
}))

import { createStaticClient } from '../../../lib/supabase-static'
import { createClient } from '../../../lib/supabase-server'
import {
  fetchArchetype,
  fetchLatestSnapshot,
  fetchShareHistory,
  fetchHasMatches,
  fetchRecentResults,
  fetchAllArchetypeIds,
  trendArrow,
  extractRecentResults,
} from '../[format]/[archetype]/queries'

// ── Fixtures ─────────────────────────────────────────────────────────────────

const MOCK_ARCHETYPE = {
  id: 'boros-energy-modern',
  name: 'Boros Energy',
  format: 'modern',
  tier: 'S',
  description: 'Aggressive energy deck leveraging Ajani and Guide of Souls',
  key_cards: ['Ajani, Nacatl Pariah'],
}

const MOCK_SNAPSHOT = {
  meta_share: 24.0,
  trend_delta: 2.8,
  top8_count: 5,
  total_entries: 60,
  sample_size: 180,
  confidence: 'VERY HIGH',
  window_end: '2026-01-21',
  window_start: '2025-12-22',
}

const MOCK_SHARE_HISTORY = [
  { meta_share: 18.5, window_end: '2026-01-07', window_start: '2025-12-08' },
  { meta_share: 21.2, window_end: '2026-01-14', window_start: '2025-12-15' },
  { meta_share: 24.0, window_end: '2026-01-21', window_start: '2025-12-22' },
]

const MOCK_RECENT_RESULTS = [
  {
    decks: {
      pilot: 'PlayerOne',
      placement: 1,
      record: '7-0',
      tournaments: { name: 'Modern Challenge', date: '2026-01-20', tier: 'Challenge', source_url: 'https://example.com/1' },
    },
  },
  {
    decks: {
      pilot: 'PlayerTwo',
      placement: 3,
      record: '6-1',
      tournaments: { name: 'Modern Preliminary', date: '2026-01-19', tier: 'Preliminary', source_url: 'https://example.com/2' },
    },
  },
  {
    decks: {
      pilot: null,
      placement: 8,
      record: '5-2',
      tournaments: { name: 'RCQ Regional', date: '2026-01-18', tier: 'RCQ', source_url: null },
    },
  },
]

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
  vi.mocked(createStaticClient).mockReturnValue(client as never)
  vi.mocked(createClient).mockResolvedValue(client as never)
  return client
}

// ── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => { vi.resetAllMocks() })

describe('fetchArchetype', () => {
  it('returns archetype for valid ID', async () => {
    mockSupabase({ data: MOCK_ARCHETYPE, error: null })
    const result = await fetchArchetype('boros-energy-modern')
    expect(result).toEqual(MOCK_ARCHETYPE)
  })

  it('returns null for unknown ID', async () => {
    mockSupabase({ data: null, error: null })
    const result = await fetchArchetype('nonexistent')
    expect(result).toBeNull()
  })

  it('throws on supabase error', async () => {
    mockSupabase({ data: null, error: { message: 'connection failed' } })
    await expect(fetchArchetype('boros-energy-modern')).rejects.toThrow('fetch_archetype')
  })
})

describe('fetchLatestSnapshot', () => {
  it('returns latest 30d snapshot', async () => {
    mockSupabase({ data: [MOCK_SNAPSHOT], error: null })
    const result = await fetchLatestSnapshot('boros-energy-modern')
    expect(result).toEqual(MOCK_SNAPSHOT)
    expect(result!.meta_share).toBe(24.0)
  })

  it('returns null when no snapshots exist', async () => {
    mockSupabase({ data: [], error: null })
    const result = await fetchLatestSnapshot('boros-energy-modern')
    expect(result).toBeNull()
  })
})

describe('fetchShareHistory', () => {
  it('returns deduplicated history sorted by window_end asc', async () => {
    mockSupabase({ data: MOCK_SHARE_HISTORY, error: null })
    const result = await fetchShareHistory('boros-energy-modern')
    expect(result).toHaveLength(3)
    expect(result[0].window_end).toBe('2026-01-07')
    expect(result[2].window_end).toBe('2026-01-21')
  })

  it('filters to shortest window per window_end', async () => {
    const duped = [
      { meta_share: 18.5, window_end: '2026-01-07', window_start: '2025-11-08' }, // 60d window
      { meta_share: 19.0, window_end: '2026-01-07', window_start: '2025-12-08' }, // 30d window — shorter, should win
    ]
    mockSupabase({ data: duped, error: null })
    const result = await fetchShareHistory('boros-energy-modern')
    expect(result).toHaveLength(1)
    expect(result[0].meta_share).toBe(19.0)
    expect(result[0].window_start).toBe('2025-12-08')
  })

  it('returns empty array when no data', async () => {
    mockSupabase({ data: [], error: null })
    const result = await fetchShareHistory('boros-energy-modern')
    expect(result).toHaveLength(0)
  })
})

describe('fetchHasMatches', () => {
  it('returns false when matches count is 0', async () => {
    mockSupabase({ data: null, error: null, count: 0 })
    const result = await fetchHasMatches()
    expect(result).toBe(false)
  })

  it('returns true when matches count > 0', async () => {
    mockSupabase({ data: null, error: null, count: 5 })
    const result = await fetchHasMatches()
    expect(result).toBe(true)
  })
})

describe('fetchRecentResults', () => {
  it('returns results joined through deck_archetypes', async () => {
    mockSupabase({ data: MOCK_RECENT_RESULTS, error: null })
    const result = await fetchRecentResults('boros-energy-modern')
    expect(result).toHaveLength(3)
    expect(result[0].pilot).toBe('PlayerOne')
    expect(result[0].placement).toBe(1)
    expect(result[0].event_name).toBe('Modern Challenge')
  })

  it('returns empty array when no results', async () => {
    mockSupabase({ data: [], error: null })
    const result = await fetchRecentResults('boros-energy-modern')
    expect(result).toHaveLength(0)
  })
})

describe('extractRecentResults', () => {
  it('flattens nested PostgREST joins', () => {
    const results = extractRecentResults(MOCK_RECENT_RESULTS)
    expect(results).toHaveLength(3)
    expect(results[0]).toEqual({
      pilot: 'PlayerOne',
      placement: 1,
      record: '7-0',
      event_name: 'Modern Challenge',
      date: '2026-01-20',
      tier: 'Challenge',
      source_url: 'https://example.com/1',
    })
  })

  it('sorts by date desc then placement asc', () => {
    const results = extractRecentResults(MOCK_RECENT_RESULTS)
    expect(results[0].date).toBe('2026-01-20')
    expect(results[1].date).toBe('2026-01-19')
    expect(results[2].date).toBe('2026-01-18')
  })
})

describe('fetchAllArchetypeIds', () => {
  it('returns format + archetype pairs', async () => {
    mockSupabase({
      data: [
        { id: 'boros-energy-modern', format: 'modern' },
        { id: 'azorius-control-standard', format: 'standard' },
      ],
      error: null,
    })
    const result = await fetchAllArchetypeIds()
    expect(result).toEqual([
      { format: 'modern', archetype: 'boros-energy-modern' },
      { format: 'standard', archetype: 'azorius-control-standard' },
    ])
  })
})

describe('trendArrow', () => {
  it('returns null for null delta', () => {
    expect(trendArrow(null)).toBeNull()
  })

  it('returns ↑↑ text-spark for delta > 3', () => {
    const result = trendArrow(4.5)
    expect(result).toEqual({ label: '↑↑', color: 'text-spark' })
  })

  it('returns ↑ text-spark for delta > 0', () => {
    const result = trendArrow(1.5)
    expect(result).toEqual({ label: '↑', color: 'text-spark' })
  })

  it('returns → text-ash for delta === 0', () => {
    const result = trendArrow(0)
    expect(result).toEqual({ label: '→', color: 'text-ash' })
  })

  it('returns ↓ text-flame for delta > -3', () => {
    const result = trendArrow(-1.5)
    expect(result).toEqual({ label: '↓', color: 'text-flame' })
  })

  it('returns ↓↓ text-flame for delta <= -3', () => {
    const result = trendArrow(-3)
    expect(result).toEqual({ label: '↓↓', color: 'text-flame' })
  })
})

describe('empty/edge states', () => {
  it('archetype exists but no snapshots', async () => {
    mockSupabase({ data: [], error: null })
    const snapshot = await fetchLatestSnapshot('boros-energy-modern')
    expect(snapshot).toBeNull()
  })

  it('archetype exists but no recent results', async () => {
    mockSupabase({ data: [], error: null })
    const results = await fetchRecentResults('boros-energy-modern')
    expect(results).toHaveLength(0)
  })
})
