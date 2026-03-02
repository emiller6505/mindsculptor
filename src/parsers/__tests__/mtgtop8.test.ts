import { describe, it, expect } from 'vitest'
import { parseDeckExport, extractTournamentMeta, extractStandings } from '../mtgtop8.js'

// ---------------------------------------------------------------------------
// parseDeckExport
// ---------------------------------------------------------------------------

describe('parseDeckExport', () => {
  it('parses a standard blank-line separated deck', () => {
    const text = `4 Lightning Bolt
4 Goblin Guide
3 Eidolon of the Great Revel

2 Leyline of Sanctity
1 Skullcrack`

    const { mainboard, sideboard } = parseDeckExport(text)

    expect(mainboard).toHaveLength(3)
    expect(mainboard).toContainEqual({ name: 'Lightning Bolt', qty: 4 })
    expect(mainboard).toContainEqual({ name: 'Eidolon of the Great Revel', qty: 3 })
    expect(sideboard).toHaveLength(2)
    expect(sideboard).toContainEqual({ name: 'Leyline of Sanctity', qty: 2 })
  })

  it('parses a deck with explicit Sideboard: marker', () => {
    const text = `4 Lightning Bolt
4 Goblin Guide
Sideboard:
2 Smash to Smithereens
1 Shard Volley`

    const { mainboard, sideboard } = parseDeckExport(text)

    expect(mainboard).toHaveLength(2)
    expect(sideboard).toHaveLength(2)
    expect(sideboard).toContainEqual({ name: 'Smash to Smithereens', qty: 2 })
  })

  it('returns empty mainboard and sideboard for empty input', () => {
    const { mainboard, sideboard } = parseDeckExport('')

    expect(mainboard).toHaveLength(0)
    expect(sideboard).toHaveLength(0)
  })

  it('ignores non-matching lines (headers, blank lines, junk)', () => {
    const text = `// Burn by gerry_t
4 Lightning Bolt
This line doesn't match
4 Goblin Guide
`
    const { mainboard } = parseDeckExport(text)

    expect(mainboard).toHaveLength(2)
    expect(mainboard).toContainEqual({ name: 'Lightning Bolt', qty: 4 })
  })

  it('returns empty sideboard when there is only one section', () => {
    const text = `4 Lightning Bolt\n4 Goblin Guide`

    const { sideboard } = parseDeckExport(text)

    expect(sideboard).toHaveLength(0)
  })

  it('handles card names with unicode characters', () => {
    const text = `4 Jötun Grunt\n2 Juzám Djinn`

    const { mainboard } = parseDeckExport(text)

    expect(mainboard).toContainEqual({ name: 'Jötun Grunt', qty: 4 })
    expect(mainboard).toContainEqual({ name: 'Juzám Djinn', qty: 2 })
  })

  it('captures card-name lines that contain HTML-like text without throwing', () => {
    // Lines starting with a digit ARE captured regardless of what follows.
    // XSS risk is mitigated downstream: Supabase uses parameterized queries,
    // and React escapes strings on render.
    const text = `4 <script>alert(1)</script>\n2 Normal Card`

    const { mainboard } = parseDeckExport(text)

    expect(mainboard).toHaveLength(2)
    expect(mainboard[0].name).toBe('<script>alert(1)</script>')
    expect(mainboard[1].name).toBe('Normal Card')
  })

  it('captures card-name lines with SQL-like content without throwing', () => {
    // Lines starting with a digit are captured as-is. SQL injection is not a risk
    // because all DB writes go through the Supabase SDK (parameterized queries).
    const text = `4 Lightning Bolt\n2 '; DROP TABLE decks; --`

    const { mainboard } = parseDeckExport(text)

    expect(mainboard).toHaveLength(2)
    expect(mainboard[0].name).toBe('Lightning Bolt')
    expect(mainboard[1].name).toBe("'; DROP TABLE decks; --")
  })

  it('parses large quantities correctly', () => {
    const text = `99 Sol Ring`

    const { mainboard } = parseDeckExport(text)

    expect(mainboard).toContainEqual({ name: 'Sol Ring', qty: 99 })
  })
})

// ---------------------------------------------------------------------------
// extractTournamentMeta
// ---------------------------------------------------------------------------

const MODERN_HTML = `<!--mtgtop8-format:modern-->
<html><head><title>Modern Challenge 32 | MTGTop8</title></head>
<body><div class="date">15/02/2026</div></body></html>`

describe('extractTournamentMeta', () => {
  it('extracts name, date and format from well-formed HTML', () => {
    const meta = extractTournamentMeta(MODERN_HTML, 'https://www.mtgtop8.com/event?e=12345')

    expect(meta).not.toBeNull()
    expect(meta!.name).toBe('Modern Challenge 32')
    expect(meta!.format).toBe('modern')
    expect(meta!.eventId).toBe('12345')
    expect(meta!.date).toBe('2026-02-15')  // DD/MM/YYYY → YYYY-MM-DD
  })

  it('returns null when format annotation is missing', () => {
    const html = `<html><head><title>Challenge 32</title></head><body>15/02/2026</body></html>`

    expect(extractTournamentMeta(html, 'https://www.mtgtop8.com/event?e=12345')).toBeNull()
  })

  it('returns null when event ID is absent from the URL', () => {
    expect(extractTournamentMeta(MODERN_HTML, 'https://www.mtgtop8.com/event')).toBeNull()
  })

  it('falls back to ISO date when no EU date pattern is present', () => {
    const html = `<!--mtgtop8-format:standard-->
<html><head><title>Standard Challenge</title></head>
<body>2026-03-01</body></html>`

    const meta = extractTournamentMeta(html, 'https://www.mtgtop8.com/event?e=99')

    expect(meta!.date).toBe('2026-03-01')
  })

  it('strips the site suffix from the tournament name', () => {
    const html = `<!--mtgtop8-format:modern-->
<html><head><title>Modern Showcase Challenge – MTGTop8</title></head>
<body>01/03/2026</body></html>`

    const meta = extractTournamentMeta(html, 'https://www.mtgtop8.com/event?e=1')

    expect(meta!.name).not.toContain('MTGTop8')
  })

  it('handles completely empty HTML without throwing', () => {
    expect(extractTournamentMeta('', 'https://www.mtgtop8.com/event?e=1')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// extractStandings
// ---------------------------------------------------------------------------

function makeStandingsHtml(decks: Array<{ placement: number; deckId: string; eventId: string; pilot: string; deckName: string }>): string {
  const rows = decks.map(d => `
    <tr>
      <td>${d.placement}</td>
      <td class="player">${d.pilot}</td>
      <td><span class="archetype">${d.deckName}</span>
        <a href="/mtgo?d=${d.deckId}&amp;e=${d.eventId}">Download</a>
      </td>
    </tr>`).join('\n')
  return `<!--mtgtop8-format:modern-->\n<table>${rows}</table>`
}

describe('extractStandings', () => {
  it('extracts standings from well-formed HTML', () => {
    const html = makeStandingsHtml([
      { placement: 1, deckId: '111', eventId: '999', pilot: 'gerry_t', deckName: 'Burn' },
      { placement: 2, deckId: '222', eventId: '999', pilot: 'bob', deckName: 'Tron' },
    ])

    const standings = extractStandings(html)

    expect(standings).toHaveLength(2)
    expect(standings[0].placement).toBe(1)
    expect(standings[0].deckId).toBe('111')
    expect(standings[1].deckId).toBe('222')
  })

  it('returns an empty array for HTML with no deck links', () => {
    expect(extractStandings('<html><body>No decks here</body></html>')).toHaveLength(0)
  })

  it('deduplicates the same deckId appearing multiple times', () => {
    const html = makeStandingsHtml([
      { placement: 1, deckId: '111', eventId: '999', pilot: 'alice', deckName: 'Burn' },
      { placement: 2, deckId: '111', eventId: '999', pilot: 'alice', deckName: 'Burn' },  // duplicate
    ])

    expect(extractStandings(html)).toHaveLength(1)
  })

  it('returns results sorted by placement ascending', () => {
    const html = makeStandingsHtml([
      { placement: 3, deckId: '333', eventId: '1', pilot: 'c', deckName: 'X' },
      { placement: 1, deckId: '111', eventId: '1', pilot: 'a', deckName: 'X' },
      { placement: 2, deckId: '222', eventId: '1', pilot: 'b', deckName: 'X' },
    ])

    const standings = extractStandings(html)

    expect(standings.map(s => s.placement)).toEqual([1, 2, 3])
  })

  it('skips decks with placement above MAX_DECK_FETCH (32)', () => {
    const html = makeStandingsHtml([
      { placement: 1,  deckId: '1',  eventId: '1', pilot: 'a', deckName: 'X' },
      { placement: 33, deckId: '33', eventId: '1', pilot: 'b', deckName: 'X' },
    ])

    const standings = extractStandings(html)

    expect(standings).toHaveLength(1)
    expect(standings[0].placement).toBe(1)
  })

  it('handles empty string without throwing', () => {
    expect(extractStandings('')).toHaveLength(0)
  })
})
