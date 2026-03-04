export type CardEntry = { name: string; qty: number }

export type ValidationError =
  | { type: 'copy_limit'; card: string; main_qty: number; side_qty: number; total: number }
  | { type: 'deck_size'; main_total: number }
  | { type: 'sideboard_size'; side_total: number }

const BASIC_LANDS = new Set([
  'plains', 'island', 'swamp', 'mountain', 'forest',
  'snow-covered plains', 'snow-covered island', 'snow-covered swamp',
  'snow-covered mountain', 'snow-covered forest', 'wastes',
])

const CARD_LINE = /^(\d+)x?\s+(.+?)(?:\s*\/\/.*)?$/

const SIDEBOARD_HEADER = /^(?:sideboard:?|side\s*board:?|sb:)$/i

function isCodeBlockDecklist(block: string): boolean {
  const lines = block.trim().split('\n').filter(l => l.trim())
  if (lines.length < 5) return false
  let cardLines = 0
  for (const line of lines) {
    if (CARD_LINE.test(line.trim()) || SIDEBOARD_HEADER.test(line.trim())) cardLines++
  }
  return cardLines / lines.length > 0.5
}

export function parseDecklist(text: string): { main: CardEntry[]; side: CardEntry[] } | null {
  const codeBlockRegex = /```[^\n]*\n([\s\S]*?)```/g
  let match: RegExpExecArray | null
  let bestBlock: string | null = null

  while ((match = codeBlockRegex.exec(text)) !== null) {
    const block = match[1]
    if (isCodeBlockDecklist(block)) {
      bestBlock = block
      break
    }
  }

  if (!bestBlock) return null

  const main: CardEntry[] = []
  const side: CardEntry[] = []
  let inSideboard = false

  for (const rawLine of bestBlock.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue

    if (SIDEBOARD_HEADER.test(line) || /^\/\/\s*sideboard/i.test(line)) {
      inSideboard = true
      continue
    }

    const m = CARD_LINE.exec(line)
    if (!m) continue

    const entry: CardEntry = { name: m[2].trim(), qty: parseInt(m[1], 10) }
    if (inSideboard) {
      side.push(entry)
    } else {
      main.push(entry)
    }
  }

  if (main.length === 0 && side.length === 0) return null

  return { main, side }
}

export function validateDecklist(main: CardEntry[], side: CardEntry[]): ValidationError[] {
  const errors: ValidationError[] = []

  const mainTotal = main.reduce((sum, c) => sum + c.qty, 0)
  if (mainTotal < 60) {
    errors.push({ type: 'deck_size', main_total: mainTotal })
  }

  const sideTotal = side.reduce((sum, c) => sum + c.qty, 0)
  if (sideTotal > 15) {
    errors.push({ type: 'sideboard_size', side_total: sideTotal })
  }

  const mainCounts = new Map<string, number>()
  for (const c of main) {
    const key = c.name.toLowerCase()
    mainCounts.set(key, (mainCounts.get(key) ?? 0) + c.qty)
  }

  const sideCounts = new Map<string, number>()
  for (const c of side) {
    const key = c.name.toLowerCase()
    sideCounts.set(key, (sideCounts.get(key) ?? 0) + c.qty)
  }

  const allCards = new Set([...mainCounts.keys(), ...sideCounts.keys()])
  for (const card of allCards) {
    if (BASIC_LANDS.has(card)) continue
    const mq = mainCounts.get(card) ?? 0
    const sq = sideCounts.get(card) ?? 0
    const total = mq + sq
    if (total > 4) {
      const displayName = [...main, ...side].find(c => c.name.toLowerCase() === card)?.name ?? card
      errors.push({ type: 'copy_limit', card: displayName, main_qty: mq, side_qty: sq, total })
    }
  }

  return errors
}

export function fixCopyLimits(
  main: CardEntry[],
  side: CardEntry[],
): { main: CardEntry[]; side: CardEntry[]; changes: string[] } {
  const mainCounts = new Map<string, number>()
  for (const c of main) {
    const key = c.name.toLowerCase()
    mainCounts.set(key, (mainCounts.get(key) ?? 0) + c.qty)
  }

  const sideCounts = new Map<string, number>()
  for (const c of side) {
    const key = c.name.toLowerCase()
    sideCounts.set(key, (sideCounts.get(key) ?? 0) + c.qty)
  }

  const changes: string[] = []
  const allCards = new Set([...mainCounts.keys(), ...sideCounts.keys()])

  for (const card of allCards) {
    if (BASIC_LANDS.has(card)) continue
    const mq = mainCounts.get(card) ?? 0
    const sq = sideCounts.get(card) ?? 0
    if (mq + sq <= 4) continue

    const displayName = [...main, ...side].find(c => c.name.toLowerCase() === card)?.name ?? card

    // Reduce sideboard first
    const newSq = Math.max(0, 4 - mq)
    if (newSq !== sq) {
      sideCounts.set(card, newSq)
      changes.push(`${displayName}: reduced sideboard from ${sq} to ${newSq}`)
    }

    // If still over, reduce main
    const newMq = Math.min(mq, 4 - newSq)
    if (newMq !== mq) {
      mainCounts.set(card, newMq)
      changes.push(`${displayName}: reduced main from ${mq} to ${newMq}`)
    }
  }

  const fixedMain = main
    .map(c => ({ name: c.name, qty: scaleQty(c, mainCounts) }))
    .filter(c => c.qty > 0)

  const fixedSide = side
    .map(c => ({ name: c.name, qty: scaleQty(c, sideCounts) }))
    .filter(c => c.qty > 0)

  return { main: fixedMain, side: fixedSide, changes }
}

function scaleQty(entry: CardEntry, targetCounts: Map<string, number>): number {
  const key = entry.name.toLowerCase()
  const target = targetCounts.get(key)
  if (target === undefined) return entry.qty
  if (target <= 0) return 0
  // If there are duplicate lines for the same card, proportionally scale
  // but for simplicity, first line gets the full target, rest get 0
  const remaining = target
  targetCounts.set(key, 0) // consume the budget
  return remaining
}

export function renderDecklist(main: CardEntry[], side: CardEntry[]): string {
  const lines = main.map(c => `${c.qty} ${c.name}`)
  if (side.length > 0) {
    lines.push('', 'Sideboard:', ...side.map(c => `${c.qty} ${c.name}`))
  }
  return lines.join('\n')
}

export function formatValidationWarning(errors: ValidationError[]): string {
  const lines = errors.map(e => {
    switch (e.type) {
      case 'copy_limit':
        return `${e.total} copies of ${e.card} across main and sideboard (max 4)`
      case 'deck_size':
        return `Main deck has ${e.main_total} cards (minimum 60)`
      case 'sideboard_size':
        return `Sideboard has ${e.side_total} cards (maximum 15)`
    }
  })

  if (lines.length === 1) {
    return `Decklist issue: ${lines[0]}. Review before importing.`
  }

  return `Decklist issues:\n${lines.map(l => `- ${l}`).join('\n')}\nReview before importing.`
}
