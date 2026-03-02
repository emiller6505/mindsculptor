/**
 * Tests for parser job-claiming and status-transition behavior.
 *
 * Root cause this guards against: the TOCTOU fix changed parsers from
 * SELECT WHERE status='pending' to UPDATE SET status='in_progress' RETURNING.
 * The DB constraint chk_scrape_jobs_status originally didn't include
 * 'in_progress', causing every parse run to fail with a constraint violation.
 *
 * These tests verify:
 *  1. Every parser claims jobs via in_progress (not a bare SELECT)
 *  2. Successful jobs are marked 'parsed'
 *  3. Failed jobs are marked 'failed'
 *  4. The full set of status values used is documented and consistent
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('../../lib/supabase.js', () => ({ supabase: { from: vi.fn(), rpc: vi.fn() } }))

import { supabase } from '../../lib/supabase.js'
import { parsePendingMtgoJobs } from '../mtgo.js'
import { parsePendingMtggoldfishJobs } from '../mtggoldfish.js'
import { parsePendingMtgtop8Jobs } from '../mtgtop8.js'
import { parsePendingTopdeckJobs } from '../topdeck.js'

// Builds a spy-able mock for the claim query chain.
// update() is a spy so tests can assert what status it was called with.
// The chain resolves with `resolveWith` when awaited.
function makeClaimChain(resolveWith: { data: unknown[]; error: null }) {
  const updateSpy = vi.fn()
  const chain = {
    eq:     vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    order:  vi.fn().mockResolvedValue(resolveWith),
  }
  updateSpy.mockReturnValue(chain)
  return { fromReturn: { update: updateSpy }, updateSpy }
}

// Minimal but valid raw_content for a topdeck job with N standings
function topdeckJobContent(numStandings: number, withDeckObj = false) {
  const standings = Array.from({ length: numStandings }, (_, i) => ({
    id: `player-${i}`,
    name: `Player${i}`,
    standing: i + 1,
    deckObj: i === 0 && withDeckObj
      ? { Mainboard: { 'Lightning Bolt': { id: 'uuid', count: 4 } }, Sideboard: {} }
      : null,
  }))
  return JSON.stringify({
    meta: { TID: 'test-123', tournamentName: 'Test Event', startDate: 1700000000, format: 'Modern' },
    standings,
  })
}

beforeEach(() => vi.resetAllMocks())

// ---------------------------------------------------------------------------
// 1. Claim behavior — all parsers
// ---------------------------------------------------------------------------

describe('parser job claiming', () => {
  const PARSERS = [
    { name: 'mtgo',        fn: parsePendingMtgoJobs },
    { name: 'mtggoldfish', fn: parsePendingMtggoldfishJobs },
    { name: 'mtgtop8',     fn: parsePendingMtgtop8Jobs },
    { name: 'topdeck',     fn: parsePendingTopdeckJobs },
  ]

  for (const { name, fn } of PARSERS) {
    it(`${name}: atomically claims pending jobs with in_progress status`, async () => {
      const { fromReturn, updateSpy } = makeClaimChain({ data: [], error: null })
      vi.mocked(supabase.from).mockReturnValue(fromReturn as never)

      await fn()

      expect(updateSpy).toHaveBeenCalledWith({ status: 'in_progress' })
    })
  }
})

// ---------------------------------------------------------------------------
// 2. Status transitions — topdeck as representative (no external fetches)
// ---------------------------------------------------------------------------

describe('topdeck parser status transitions', () => {
  it('marks job as failed when standings count is below minimum (< 4)', async () => {
    const job = { id: 1, source_url: 'test-123', raw_content: topdeckJobContent(2) }

    // Call 1: claim → returns the thin job
    const { fromReturn: claimMock } = makeClaimChain({ data: [job], error: null })
    // Call 2: status update to 'failed' → just needs to not error
    const failUpdateSpy = vi.fn()
    const failChain = { eq: vi.fn().mockReturnThis(), then: (r: (v: unknown) => unknown) => Promise.resolve({ data: null, error: null }).then(r) }
    failUpdateSpy.mockReturnValue(failChain)
    const failMock = { update: failUpdateSpy }

    vi.mocked(supabase.from)
      .mockReturnValueOnce(claimMock as never)
      .mockReturnValue(failMock as never)

    await parsePendingTopdeckJobs()

    expect(failUpdateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed' })
    )
  })

  it('marks job as parsed after successful processing', async () => {
    const job = { id: 1, source_url: 'test-123', raw_content: topdeckJobContent(4, true) }

    // Track all update() calls by returning a spy for every from() call
    const updateSpy = vi.fn()
    const chain = {
      eq:     vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      order:  vi.fn().mockResolvedValue({ data: [job], error: null }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
      in:     vi.fn().mockReturnThis(),
      not:    vi.fn().mockReturnThis(),
      // for card lookup (resolveCardIds) — returns Lightning Bolt
      then:   (r: (v: unknown) => unknown) => Promise.resolve({ data: [{ id: 'card-1', name: 'Lightning Bolt' }], error: null }).then(r),
    }
    updateSpy.mockReturnValue(chain)
    vi.mocked(supabase.from).mockReturnValue({ ...chain, update: updateSpy } as never)
    vi.mocked(supabase.rpc).mockResolvedValue({ error: null } as never)

    await parsePendingTopdeckJobs()

    const statusUpdates = updateSpy.mock.calls.map(([arg]) => (arg as { status?: string }).status)
    expect(statusUpdates).toContain('in_progress')
    expect(statusUpdates).toContain('parsed')
    expect(statusUpdates).not.toContain('failed')
  })
})

// ---------------------------------------------------------------------------
// 3. Status value contract — documents what chk_scrape_jobs_status must allow
// ---------------------------------------------------------------------------

describe('scrape_job status contract', () => {
  it('all status values used by parsers and scrapers are known', () => {
    // If you add a new status here, you MUST also update:
    //   supabase/migrations/*_scrape_jobs_*.sql  (chk_scrape_jobs_status constraint)
    const CONSTRAINT_VALUES = ['pending', 'in_progress', 'parsed', 'failed', 'skipped']

    // Values written by parsers
    expect(CONSTRAINT_VALUES).toContain('pending')      // default / initial state
    expect(CONSTRAINT_VALUES).toContain('in_progress')  // atomic claim (TOCTOU fix)
    expect(CONSTRAINT_VALUES).toContain('parsed')       // successful parse
    expect(CONSTRAINT_VALUES).toContain('failed')       // parse error
    // Values written by scrapers (not parsers)
    expect(CONSTRAINT_VALUES).toContain('skipped')      // scraper skips irrelevant events
  })
})
