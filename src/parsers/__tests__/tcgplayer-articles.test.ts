import { describe, it, expect } from 'vitest'
import { extractTcgplayerCardNames } from '../tcgplayer-articles.js'

describe('extractTcgplayerCardNames', () => {
  it('extracts card names from card-hover-link elements', () => {
    const html = `
      <p>Running <card-hover-link card-name="Lightning Bolt">Lightning Bolt</card-hover-link> is essential.</p>
      <p>Pair it with <card-hover-link card-name="Goblin Guide">Goblin Guide</card-hover-link>.</p>
    `
    const names = extractTcgplayerCardNames(html, new Set())
    expect(names).toContain('Lightning Bolt')
    expect(names).toContain('Goblin Guide')
  })

  it('also finds known card names from plain text', () => {
    const known = new Set(['Counterspell', 'Force of Will'])
    const html = '<p>Counterspell is great in this meta but Force of Will is better.</p>'
    const names = extractTcgplayerCardNames(html, known)
    expect(names).toContain('Counterspell')
    expect(names).toContain('Force of Will')
  })

  it('deduplicates between hover links and known names', () => {
    const known = new Set(['Lightning Bolt'])
    const html = '<p><card-hover-link card-name="Lightning Bolt">Lightning Bolt</card-hover-link> is the best card. Lightning Bolt does it all.</p>'
    const names = extractTcgplayerCardNames(html, known)
    const bolts = names.filter(n => n === 'Lightning Bolt')
    expect(bolts).toHaveLength(1)
  })

  it('returns empty array for text with no cards', () => {
    const names = extractTcgplayerCardNames('<p>Just a regular sentence.</p>', new Set())
    expect(names).toEqual([])
  })

  it('handles card-hover-link with extra attributes', () => {
    const html = '<card-hover-link card-name="Snapcaster Mage" class="some-class" data-id="123">Snapcaster Mage</card-hover-link>'
    const names = extractTcgplayerCardNames(html, new Set())
    expect(names).toContain('Snapcaster Mage')
  })
})
