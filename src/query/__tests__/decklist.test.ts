import { describe, it, expect } from 'vitest'
import { parseDecklist, validateDecklist, formatValidationWarning, fixCopyLimits, renderDecklist } from '../decklist.js'

describe('parseDecklist', () => {
  it('parses a standard decklist from a code block', () => {
    const text = `Here's the deck:

\`\`\`
4 Lightning Bolt
4 Goblin Guide
4 Monastery Swiftspear
4 Eidolon of the Great Revel
4 Lava Spike
4 Rift Bolt
4 Searing Blaze
4 Skullcrack
2 Light Up the Stage
2 Shard Volley
20 Mountain
4 Inspiring Vantage

Sideboard:
4 Leyline of the Void
3 Smash to Smithereens
2 Roiling Vortex
2 Searing Blood
2 Exquisite Firecraft
2 Path to Exile
\`\`\`

Good luck!`

    const result = parseDecklist(text)
    expect(result).not.toBeNull()
    expect(result!.main).toHaveLength(12)
    expect(result!.side).toHaveLength(6)
    expect(result!.main[0]).toEqual({ name: 'Lightning Bolt', qty: 4 })
    expect(result!.side[0]).toEqual({ name: 'Leyline of the Void', qty: 4 })
  })

  it('parses "4x Card Name" format', () => {
    const text = `\`\`\`
4x Lightning Bolt
4x Goblin Guide
4x Monastery Swiftspear
4x Eidolon of the Great Revel
4x Lava Spike
4x Rift Bolt
4x Searing Blaze
4x Skullcrack
2x Light Up the Stage
2x Shard Volley
20x Mountain
4x Inspiring Vantage
\`\`\``

    const result = parseDecklist(text)
    expect(result).not.toBeNull()
    expect(result!.main[0]).toEqual({ name: 'Lightning Bolt', qty: 4 })
  })

  it('handles // comments on card lines', () => {
    const text = `\`\`\`
4 Lightning Bolt // removal
4 Goblin Guide // one-drop
4 Monastery Swiftspear
4 Eidolon of the Great Revel
4 Lava Spike
4 Rift Bolt
4 Searing Blaze
4 Skullcrack
2 Light Up the Stage
2 Shard Volley
20 Mountain
4 Inspiring Vantage
\`\`\``

    const result = parseDecklist(text)
    expect(result).not.toBeNull()
    expect(result!.main[0]).toEqual({ name: 'Lightning Bolt', qty: 4 })
  })

  it('returns null when no decklist is found', () => {
    const text = 'Here is some analysis about the metagame. No decklist here.'
    expect(parseDecklist(text)).toBeNull()
  })

  it('returns null for non-decklist code blocks', () => {
    const text = `\`\`\`json
{"key": "value"}
\`\`\``
    expect(parseDecklist(text)).toBeNull()
  })

  it('picks the decklist code block when multiple blocks exist', () => {
    const text = `Here's some JSON:

\`\`\`json
{"format": "modern"}
\`\`\`

And here's the deck:

\`\`\`
4 Lightning Bolt
4 Goblin Guide
4 Monastery Swiftspear
4 Eidolon of the Great Revel
4 Lava Spike
4 Rift Bolt
4 Searing Blaze
4 Skullcrack
2 Light Up the Stage
2 Shard Volley
20 Mountain
4 Inspiring Vantage
\`\`\``

    const result = parseDecklist(text)
    expect(result).not.toBeNull()
    expect(result!.main[0]).toEqual({ name: 'Lightning Bolt', qty: 4 })
  })

  it('recognizes "sb:" as sideboard header', () => {
    const text = `\`\`\`
4 Lightning Bolt
4 Goblin Guide
4 Monastery Swiftspear
4 Eidolon of the Great Revel
4 Lava Spike
4 Rift Bolt
4 Searing Blaze
4 Skullcrack
2 Light Up the Stage
2 Shard Volley
20 Mountain
4 Inspiring Vantage

SB:
3 Smash to Smithereens
\`\`\``

    const result = parseDecklist(text)
    expect(result).not.toBeNull()
    expect(result!.side).toHaveLength(1)
    expect(result!.side[0]).toEqual({ name: 'Smash to Smithereens', qty: 3 })
  })
})

describe('validateDecklist', () => {
  const validMain = [
    { name: 'Lightning Bolt', qty: 4 },
    { name: 'Goblin Guide', qty: 4 },
    { name: 'Monastery Swiftspear', qty: 4 },
    { name: 'Eidolon of the Great Revel', qty: 4 },
    { name: 'Lava Spike', qty: 4 },
    { name: 'Rift Bolt', qty: 4 },
    { name: 'Searing Blaze', qty: 4 },
    { name: 'Skullcrack', qty: 4 },
    { name: 'Light Up the Stage', qty: 2 },
    { name: 'Shard Volley', qty: 2 },
    { name: 'Mountain', qty: 20 },
    { name: 'Inspiring Vantage', qty: 4 },
  ]

  it('returns empty array for a valid 60-card deck', () => {
    const errors = validateDecklist(validMain, [
      { name: 'Smash to Smithereens', qty: 3 },
      { name: 'Roiling Vortex', qty: 2 },
    ])
    expect(errors).toEqual([])
  })

  it('detects copy limit violation across main + side', () => {
    const errors = validateDecklist(validMain, [
      { name: 'Lightning Bolt', qty: 4 },
    ])
    const copyErrors = errors.filter(e => e.type === 'copy_limit')
    expect(copyErrors).toHaveLength(1)
    expect(copyErrors[0]).toEqual({
      type: 'copy_limit',
      card: 'Lightning Bolt',
      main_qty: 4,
      side_qty: 4,
      total: 8,
    })
  })

  it('exempts basic lands from copy limit', () => {
    const main = [
      ...validMain.filter(c => c.name !== 'Mountain'),
      { name: 'Mountain', qty: 20 },
    ]
    const side = [{ name: 'Mountain', qty: 5 }]
    const errors = validateDecklist(main, side)
    const copyErrors = errors.filter(e => e.type === 'copy_limit')
    expect(copyErrors).toHaveLength(0)
  })

  it('exempts snow-covered lands from copy limit', () => {
    const main = [
      ...validMain.filter(c => c.name !== 'Mountain'),
      { name: 'Snow-Covered Mountain', qty: 20 },
    ]
    const side = [{ name: 'Snow-Covered Mountain', qty: 5 }]
    const errors = validateDecklist(main, side)
    const copyErrors = errors.filter(e => e.type === 'copy_limit')
    expect(copyErrors).toHaveLength(0)
  })

  it('detects main deck under 60 cards', () => {
    const shortMain = [
      { name: 'Lightning Bolt', qty: 4 },
      { name: 'Mountain', qty: 16 },
    ]
    const errors = validateDecklist(shortMain, [])
    expect(errors.some(e => e.type === 'deck_size' && e.main_total === 20)).toBe(true)
  })

  it('detects sideboard over 15 cards', () => {
    const bigSide = [
      { name: 'Smash to Smithereens', qty: 4 },
      { name: 'Roiling Vortex', qty: 4 },
      { name: 'Searing Blood', qty: 4 },
      { name: 'Path to Exile', qty: 4 },
    ]
    const errors = validateDecklist(validMain, bigSide)
    expect(errors.some(e => e.type === 'sideboard_size' && e.side_total === 16)).toBe(true)
  })

  it('handles case-insensitive card name merging', () => {
    const main = [
      ...validMain.filter(c => c.name !== 'Lightning Bolt'),
      { name: 'lightning bolt', qty: 4 },
    ]
    const side = [{ name: 'Lightning Bolt', qty: 2 }]
    const errors = validateDecklist(main, side)
    const copyErrors = errors.filter(e => e.type === 'copy_limit')
    expect(copyErrors).toHaveLength(1)
    expect(copyErrors[0].type === 'copy_limit' && copyErrors[0].total).toBe(6)
  })
})

describe('formatValidationWarning', () => {
  it('formats a single error', () => {
    const msg = formatValidationWarning([
      { type: 'copy_limit', card: 'Sunspine Lynx', main_qty: 4, side_qty: 4, total: 8 },
    ])
    expect(msg).toContain('8 copies of Sunspine Lynx')
    expect(msg).toContain('max 4')
  })

  it('formats multiple errors as bullet list', () => {
    const msg = formatValidationWarning([
      { type: 'copy_limit', card: 'Sunspine Lynx', main_qty: 4, side_qty: 4, total: 8 },
      { type: 'sideboard_size', side_total: 16 },
    ])
    expect(msg).toContain('- ')
    expect(msg).toContain('Sunspine Lynx')
    expect(msg).toContain('16 cards')
  })
})

describe('fixCopyLimits', () => {
  it('reduces sideboard first when card exceeds 4 total', () => {
    const main = [{ name: 'Elusive Otter', qty: 4 }]
    const side = [{ name: 'Elusive Otter', qty: 4 }]
    const { main: fm, side: fs, changes } = fixCopyLimits(main, side)
    expect(fm).toEqual([{ name: 'Elusive Otter', qty: 4 }])
    expect(fs).toEqual([])
    expect(changes).toHaveLength(1)
    expect(changes[0]).toContain('sideboard from 4 to 0')
  })

  it('reduces main if side is already 0 and main > 4', () => {
    const main = [{ name: 'Elusive Otter', qty: 6 }]
    const side: { name: string; qty: number }[] = []
    const { main: fm, changes } = fixCopyLimits(main, side)
    expect(fm).toEqual([{ name: 'Elusive Otter', qty: 4 }])
    expect(changes).toHaveLength(1)
    expect(changes[0]).toContain('main from 6 to 4')
  })

  it('removes entries with qty 0', () => {
    const main = [{ name: 'Elusive Otter', qty: 4 }]
    const side = [{ name: 'Elusive Otter', qty: 2 }]
    const { side: fs } = fixCopyLimits(main, side)
    expect(fs).toEqual([])
  })

  it('returns empty changes when no violations', () => {
    const main = [{ name: 'Lightning Bolt', qty: 4 }]
    const side = [{ name: 'Roiling Vortex', qty: 2 }]
    const { changes } = fixCopyLimits(main, side)
    expect(changes).toEqual([])
  })

  it('handles multiple violations', () => {
    const main = [
      { name: 'Elusive Otter', qty: 4 },
      { name: 'Sunspine Lynx', qty: 3 },
    ]
    const side = [
      { name: 'Elusive Otter', qty: 4 },
      { name: 'Sunspine Lynx', qty: 3 },
    ]
    const { main: fm, side: fs, changes } = fixCopyLimits(main, side)
    expect(fm).toEqual([
      { name: 'Elusive Otter', qty: 4 },
      { name: 'Sunspine Lynx', qty: 3 },
    ])
    expect(fs).toEqual([{ name: 'Sunspine Lynx', qty: 1 }])
    expect(changes.length).toBeGreaterThanOrEqual(2)
  })

  it('skips basic lands', () => {
    const main = [{ name: 'Mountain', qty: 20 }]
    const side = [{ name: 'Mountain', qty: 5 }]
    const { main: fm, side: fs, changes } = fixCopyLimits(main, side)
    expect(fm).toEqual([{ name: 'Mountain', qty: 20 }])
    expect(fs).toEqual([{ name: 'Mountain', qty: 5 }])
    expect(changes).toEqual([])
  })
})

describe('renderDecklist', () => {
  it('outputs MTGA format with sideboard section', () => {
    const main = [
      { name: 'Lightning Bolt', qty: 4 },
      { name: 'Mountain', qty: 20 },
    ]
    const side = [{ name: 'Smash to Smithereens', qty: 3 }]
    const result = renderDecklist(main, side)
    expect(result).toBe(
      '4 Lightning Bolt\n20 Mountain\n\nSideboard:\n3 Smash to Smithereens',
    )
  })

  it('omits sideboard header when side is empty', () => {
    const main = [{ name: 'Lightning Bolt', qty: 4 }]
    const result = renderDecklist(main, [])
    expect(result).toBe('4 Lightning Bolt')
    expect(result).not.toContain('Sideboard')
  })
})
