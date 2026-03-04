import { describe, it, expect } from 'vitest'
import { chunkArticle, extractCardNames } from '../mtggoldfish-articles.js'

// ---------------------------------------------------------------------------
// chunkArticle
// ---------------------------------------------------------------------------

describe('chunkArticle', () => {
  it('splits on H2/H3 header boundaries', () => {
    const introText = 'Intro paragraph about the Modern metagame. '.repeat(5)
    const sectionText = 'Section One covers Burn and its role in the current metagame with many card choices. '.repeat(5)
    const html = `
      <p>${introText}</p>
      <h2>Section One</h2>
      <p>${sectionText}</p>
    `
    const chunks = chunkArticle(html)
    expect(chunks.length).toBeGreaterThanOrEqual(2)
    expect(chunks.some(c => c.includes('Intro paragraph'))).toBe(true)
    expect(chunks.some(c => c.includes('Section One'))).toBe(true)
  })

  it('applies window splitting for long sections', () => {
    const longParagraph = 'This is a sentence about Magic the Gathering strategy. '.repeat(100)
    const html = `<p>${longParagraph}</p>`
    const chunks = chunkArticle(html)
    expect(chunks.length).toBeGreaterThan(1)
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(2200)
    }
  })

  it('skips chunks shorter than 100 characters', () => {
    const html = `
      <h2>A</h2>
      <p>Short.</p>
      <h2>Real Section</h2>
      <p>${'This is a real section with actual content about Modern burn strategies. '.repeat(5)}</p>
    `
    const chunks = chunkArticle(html)
    expect(chunks.every(c => c.length >= 100)).toBe(true)
  })

  it('handles articles with no headers (pure window splitting)', () => {
    const text = 'A deep dive into the Modern metagame reveals interesting patterns. '.repeat(80)
    const html = `<p>${text}</p>`
    const chunks = chunkArticle(html)
    expect(chunks.length).toBeGreaterThan(1)
  })

  it('returns empty array for empty input', () => {
    expect(chunkArticle('')).toEqual([])
  })

  it('strips HTML tags from output', () => {
    const html = `<p>This is a <strong>bold</strong> claim about <a href="/price/card">Lightning Bolt</a> in the current Modern metagame and its role in aggro strategies.</p>`.repeat(3)
    const chunks = chunkArticle(html)
    for (const chunk of chunks) {
      expect(chunk).not.toMatch(/<[^>]+>/)
    }
  })
})

// ---------------------------------------------------------------------------
// extractCardNames
// ---------------------------------------------------------------------------

describe('extractCardNames', () => {
  it('finds linked card names in markdown format', () => {
    const text = 'Run [Lightning Bolt](/price/paper/Lightning+Bolt) and [Goblin Guide](/price/paper/Goblin+Guide) in Burn.'
    const names = extractCardNames(text, new Set())
    expect(names).toContain('Lightning Bolt')
    expect(names).toContain('Goblin Guide')
  })

  it('finds linked card names in HTML format', () => {
    const text = 'Run <a href="/price/paper/Lightning+Bolt">Lightning Bolt</a> in your deck.'
    const names = extractCardNames(text, new Set())
    expect(names).toContain('Lightning Bolt')
  })

  it('finds unlinked card names from known set', () => {
    const known = new Set(['Counterspell', 'Force of Will', 'Brainstorm'])
    const text = 'You should always run Counterspell and Force of Will in your blue decks.'
    const names = extractCardNames(text, known)
    expect(names).toContain('Counterspell')
    expect(names).toContain('Force of Will')
    expect(names).not.toContain('Brainstorm')
  })

  it('deduplicates card names', () => {
    const known = new Set(['Lightning Bolt'])
    const text = '[Lightning Bolt](/price/paper/Lightning+Bolt) is great. Lightning Bolt is the best.'
    const names = extractCardNames(text, known)
    const bolts = names.filter(n => n === 'Lightning Bolt')
    expect(bolts).toHaveLength(1)
  })

  it('returns empty array for text with no cards', () => {
    const names = extractCardNames('Just a regular sentence about nothing.', new Set())
    expect(names).toEqual([])
  })

  it('skips very short known names to avoid false positives', () => {
    const known = new Set(['Ox', 'Lightning Bolt'])
    const text = 'An ox ran across the field. Lightning Bolt hit it.'
    const names = extractCardNames(text, known)
    expect(names).toContain('Lightning Bolt')
    expect(names).not.toContain('Ox')
  })
})
