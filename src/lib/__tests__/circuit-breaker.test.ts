import { describe, it, expect, beforeEach, vi } from 'vitest'
import { checkCircuitBreaker, DAILY_TOTAL_LIMIT, _resetForTest } from '../circuit-breaker'

function mockSupabase(totalQueries: number) {
  return {
    rpc: vi.fn().mockResolvedValue({ data: totalQueries }),
  } as any
}

beforeEach(() => {
  _resetForTest()
  vi.restoreAllMocks()
})

describe('checkCircuitBreaker', () => {
  it('returns true when under limit', async () => {
    expect(await checkCircuitBreaker(mockSupabase(10))).toBe(true)
  })

  it('returns false when total queries >= DAILY_TOTAL_LIMIT', async () => {
    expect(await checkCircuitBreaker(mockSupabase(DAILY_TOTAL_LIMIT))).toBe(false)
  })

  it('caches for 60s — no re-query within interval', async () => {
    const sb = mockSupabase(10)

    await checkCircuitBreaker(sb)
    expect(sb.rpc).toHaveBeenCalledTimes(1)

    await checkCircuitBreaker(sb)
    expect(sb.rpc).toHaveBeenCalledTimes(1) // still 1 — cached
  })

  it('re-queries after 60s interval expires', async () => {
    const sb = mockSupabase(10)

    await checkCircuitBreaker(sb)
    expect(sb.rpc).toHaveBeenCalledTimes(1)

    const realNow = Date.now
    Date.now = () => realNow() + 61_000
    await checkCircuitBreaker(sb)
    expect(sb.rpc).toHaveBeenCalledTimes(2)
    Date.now = realNow
  })
})
