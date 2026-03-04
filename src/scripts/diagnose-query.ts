import 'dotenv/config'
import { extractIntent } from '../query/intent.js'
import { retrieveContext } from '../query/retrieval.js'
import type { DeckSummary } from '../query/retrieval.js'
import { assembleContext, buildResponseSystem } from '../query/assemble.js'
import { llm } from '../lib/llm.js'
import { supabase } from '../lib/supabase.js'

const args = process.argv.slice(2)
const flags = new Set(args.filter(a => a.startsWith('--')))
const query = args.find(a => !a.startsWith('--'))

if (!query) {
  console.error('Usage: npx tsx src/scripts/diagnose-query.ts "query" [--context] [--llm]')
  process.exit(1)
}

const showContext = flags.has('--context')
const showLlm = flags.has('--llm')
const hr = '─'.repeat(60)

// 1. Intent
console.log(`\n${hr}\nQuery: ${query}\n${hr}`)
const intent = await extractIntent(query)
console.log(`\n=== Intent ===`)
console.log(JSON.stringify(intent, null, 2))

// 2. Retrieval
const data = await retrieveContext(intent)

console.log(`\n=== Retrieval Stats ===`)
console.log(`Tournaments: ${data.tournaments_count}`)
console.log(`Decks: ${data.top_decks.length}`)
console.log(`Confidence: ${data.confidence}`)
console.log(`Window: ${data.window_days} days`)

if (data.top_decks.length > 0) {
  // Archetype breakdown
  const byArchetype = new Map<string, { count: number; placements: number[] }>()
  for (const d of data.top_decks) {
    const key = d.archetype ?? '(unlabeled)'
    const entry = byArchetype.get(key) ?? { count: 0, placements: [] }
    entry.count++
    if (d.placement != null) entry.placements.push(d.placement)
    byArchetype.set(key, entry)
  }
  console.log(`\nArchetype breakdown:`)
  const sorted = [...byArchetype.entries()].sort((a, b) => b[1].count - a[1].count)
  for (const [name, { count, placements }] of sorted) {
    const avg = placements.length > 0
      ? (placements.reduce((a, b) => a + b, 0) / placements.length).toFixed(1)
      : 'n/a'
    console.log(`  ${name}: ${count} decks, avg placement ${avg}`)
  }

  // Tier distribution
  const byTier = new Map<string, number>()
  for (const d of data.top_decks) {
    const key = d.tier ?? '(none)'
    byTier.set(key, (byTier.get(key) ?? 0) + 1)
  }
  console.log(`\nTier distribution:`)
  for (const [tier, count] of [...byTier.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${tier}: ${count}`)
  }
}

// 3. Price coverage
console.log(`\n=== Price Coverage ===`)
if (data.top_decks.length > 0) {
  const byArch = new Map<string, { total: number; hasUsd: number; hasTix: number }>()
  let globalTotal = 0, globalUsd = 0, globalTix = 0
  for (const d of data.top_decks) {
    const key = d.archetype ?? '(unlabeled)'
    const entry = byArch.get(key) ?? { total: 0, hasUsd: 0, hasTix: 0 }
    entry.total++
    if (d.deck_cost_usd != null) entry.hasUsd++
    if (d.deck_cost_tix != null) entry.hasTix++
    byArch.set(key, entry)
    globalTotal++
    if (d.deck_cost_usd != null) globalUsd++
    if (d.deck_cost_tix != null) globalTix++
  }
  for (const [name, { total, hasUsd, hasTix }] of [...byArch.entries()].sort((a, b) => b[1].total - a[1].total)) {
    console.log(`  ${name}: ${hasUsd}/${total} USD, ${hasTix}/${total} tix`)
  }
  console.log(`  Global: ${globalUsd}/${globalTotal} USD, ${globalTix}/${globalTotal} tix`)

  // Missing card names
  await reportMissingCards(data.top_decks)
} else {
  console.log('  No decks to check')
}

// 4. Context string (--context or --llm)
let contextStr: string | undefined
if (showContext || showLlm) {
  contextStr = assembleContext(intent, data)
  if (showContext) {
    const charCount = contextStr.length
    const estTokens = Math.round(charCount / 4)
    console.log(`\n=== Context String (${charCount} chars, ~${estTokens} tokens) ===`)
    console.log(contextStr)
  }
}

// 5. LLM response + quality checks (--llm)
if (showLlm) {
  contextStr ??= assembleContext(intent, data)
  const system = buildResponseSystem()
  const userMsg = `${contextStr}\n\nUser question: ${query}`
  console.log(`\n=== LLM Response ===`)
  const answer = await llm.complete(system, userMsg, { maxTokens: 2048 })
  console.log(answer)

  console.log(`\n=== Quality Checks ===`)
  runQualityChecks(answer, intent, data)
}

console.log('')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function reportMissingCards(decks: DeckSummary[]) {
  const allNames = [...new Set(decks.flatMap(d => d.mainboard.map(c => c.name)))]
  if (allNames.length === 0) return

  const found = new Set<string>()

  // Use the RPC to avoid PostgREST row-limit issues with heavily-reprinted cards
  const { data: rpcData } = await supabase.rpc('lookup_card_prices', { p_names: allNames })
  if (rpcData) for (const r of rpcData as { name: string }[]) found.add(r.name)

  // Split card normalization ("Wear/Tear" → "Wear // Tear")
  const notFound = allNames.filter(n => !found.has(n))
  const splitNames = notFound.filter(n => n.includes('/') && !n.includes(' // '))
  if (splitNames.length > 0) {
    const normalized = splitNames.map(n => n.replace('/', ' // '))
    const { data } = await supabase.rpc('lookup_card_prices', { p_names: normalized })
    if (data) for (const r of data as { name: string }[]) {
      const original = splitNames[normalized.indexOf(r.name)]
      if (original) found.add(original)
    }
  }

  // DFC pass for remaining (front-face and back-face patterns)
  const stillMissing = allNames.filter(n => !found.has(n))
  if (stillMissing.length > 0) {
    await Promise.all(
      stillMissing.map(async name => {
        const { data: front } = await supabase.from('cards').select('name').like('name', `${name} // %`).limit(1)
        if (front && front.length > 0) { found.add(name); return }
        const { data: back } = await supabase.from('cards').select('name').like('name', `% // ${name}`).limit(1)
        if (back && back.length > 0) found.add(name)
      })
    )
  }

  // Alias pass: check remaining names against card_name_aliases
  const afterDfc = allNames.filter(n => !found.has(n))
  if (afterDfc.length > 0) {
    const { data: aliasData } = await supabase
      .from('card_name_aliases')
      .select('alias')
      .in('alias', afterDfc)
    if (aliasData) for (const r of aliasData) found.add(r.alias)
  }

  const missing = allNames.filter(n => !found.has(n))
  if (missing.length > 0) {
    console.log(`\n  Missing from cards table (${missing.length}):`)
    for (const name of missing) console.log(`    - ${name}`)
  } else {
    console.log(`  All ${allNames.length} unique card names found in cards table`)
  }
}

function runQualityChecks(answer: string, intent: ReturnType<typeof extractIntent> extends Promise<infer T> ? T : never, data: typeof globalThis extends never ? never : Awaited<ReturnType<typeof retrieveContext>>) {
  const archetypes = [...new Set(data.top_decks.map(d => d.archetype).filter(Boolean))] as string[]
  const hasArchetypeRef = archetypes.length === 0 || archetypes.some(a => answer.toLowerCase().includes(a.toLowerCase()))
  check('References archetype names from data', hasArchetypeRef)

  check('States confidence level', /confidence/i.test(answer) || new RegExp(data.confidence, 'i').test(answer))

  const hasCostedDecks = data.top_decks.some(d => d.deck_cost_usd != null || d.deck_cost_tix != null)
  const mentionsCost = /\$[\d,]+|tix|cost|price|budget|cheap/i.test(answer)
  check('Mentions cost data (when decks have costs)', !hasCostedDecks || mentionsCost)

  const hasCodeBlock = /```/.test(answer)
  check('Contains code block (deck_advice)', intent.question_type !== 'deck_advice' || hasCodeBlock)

  check('No emoji', !/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u.test(answer))

  // Card fabrication check
  const cardNamesInData = new Set(data.top_decks.flatMap(d => d.mainboard.map(c => c.name)))
  if (data.card_info) cardNamesInData.add(data.card_info.name)
  const cardPattern = /\d+x?\s+([A-Z][a-z]+(?:\s+[A-Za-z',\-]+){1,5})/g
  const mentionedCards: string[] = []
  let match
  while ((match = cardPattern.exec(answer)) !== null) {
    mentionedCards.push(match[1]!)
  }
  const fabricated = mentionedCards.filter(c => !cardNamesInData.has(c))
  if (fabricated.length === 0) {
    check('No fabricated card names', true)
  } else {
    check(`No fabricated card names (possibly fabricated: ${fabricated.join(', ')})`, false)
  }
}

function check(label: string, pass: boolean) {
  console.log(`  ${pass ? '✓' : '✗'} ${label}`)
}
