import { describe, it, expect } from 'vitest'
import { assembleContext } from '../assemble.js'
import { INTENT_FIXTURE, DECK_SUMMARY_FIXTURE, CARD_FIXTURE } from './helpers.js'
import type { RetrievedData } from '../retrieval.js'

function makeData(overrides: Partial<RetrievedData> = {}): RetrievedData {
  return {
    format: 'modern',
    window_days: 90,
    tournaments_count: 2,
    top_decks: [DECK_SUMMARY_FIXTURE],
    card_info: null,
    confidence: 'HIGH',
    ...overrides,
  }
}

describe('assembleContext', () => {
  it('includes format and window size in the header', () => {
    const ctx = assembleContext(INTENT_FIXTURE, makeData())

    expect(ctx).toContain('modern')
    expect(ctx).toContain('90')
    expect(ctx).toContain('2')  // tournaments_count
  })

  it('renders deck pilot and placement', () => {
    const ctx = assembleContext(INTENT_FIXTURE, makeData())

    expect(ctx).toContain('gerry_t')
    expect(ctx).toContain('1')  // placement
    expect(ctx).toContain('Lightning Bolt')
  })

  it('includes sideboard when present', () => {
    const ctx = assembleContext(INTENT_FIXTURE, makeData())

    expect(ctx).toContain('Sideboard')
    expect(ctx).toContain('Leyline of Sanctity')
  })

  it('shows a no-data message when top_decks is empty', () => {
    const ctx = assembleContext(INTENT_FIXTURE, makeData({ top_decks: [] }))

    expect(ctx).toContain('No deck data found')
  })

  it('includes card info block when card_info is present', () => {
    const ctx = assembleContext(
      { ...INTENT_FIXTURE, question_type: 'card_question', card: 'Lightning Bolt' },
      makeData({ card_info: { ...CARD_FIXTURE, appearances: 42 } }),
    )

    expect(ctx).toContain('Lightning Bolt')
    expect(ctx).toContain('{R}')
    expect(ctx).toContain('42')  // appearances
    expect(ctx).toContain('3 damage')  // oracle_text excerpt
  })

  it('omits card info section when card_info is null', () => {
    const ctx = assembleContext(INTENT_FIXTURE, makeData({ card_info: null }))

    expect(ctx).not.toContain('Card:')
  })

  it('includes opponent framing note when opponent_archetype is set', () => {
    const ctx = assembleContext(
      { ...INTENT_FIXTURE, opponent_archetype: 'Tron' },
      makeData(),
    )

    expect(ctx).toContain('Query Framing')
    expect(ctx).toContain('AGAINST Tron')
    expect(ctx).toContain('NOT playing Tron')
  })

  it('omits framing note when opponent_archetype is null', () => {
    const ctx = assembleContext(INTENT_FIXTURE, makeData())

    expect(ctx).not.toContain('Query Framing')
  })
})
