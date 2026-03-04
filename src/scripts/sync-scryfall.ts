import 'dotenv/config'
/**
 * Scryfall bulk sync
 * Streams the latest default-cards bulk export and upserts into the cards table.
 * Safe to re-run — uses upsert on primary key (Scryfall UUID).
 * Run: npx tsx src/scripts/sync-scryfall.ts
 */
import { Readable } from 'node:stream'
import { createRequire } from 'node:module'
import { supabase } from '../lib/supabase.js'

const require = createRequire(import.meta.url)
const { parser } = require('stream-json')
const { streamArray } = require('stream-json/streamers/StreamArray')

const SCRYFALL_BULK_API = 'https://api.scryfall.com/bulk-data'
const BATCH_SIZE = 500
const RELEVANT_FORMATS = ['modern', 'standard']

interface ScryfallBulkEntry {
  type: string
  download_uri: string
}

interface ScryfallCard {
  id: string
  oracle_id: string
  name: string
  printed_name?: string
  oracle_text?: string
  type_line?: string
  mana_cost?: string
  cmc?: number
  colors?: string[]
  color_identity?: string[]
  legalities: Record<string, string>
  set: string
  collector_number: string
  rarity: string
  image_uris?: { normal?: string }
  card_faces?: Array<{ image_uris?: { normal?: string }; oracle_text?: string }>
  prices?: { usd?: string | null; tix?: string | null }
}

interface AliasRow {
  alias: string
  canonical: string
  oracle_id: string
  source: string
}

async function getBulkDownloadUrl(): Promise<string> {
  const res = await fetch(SCRYFALL_BULK_API)
  if (!res.ok) throw new Error(`Scryfall bulk API error: ${res.status}`)
  const data = await res.json() as { data: ScryfallBulkEntry[] }
  const entry = data.data.find(d => d.type === 'default_cards')
  if (!entry) throw new Error('Could not find default_cards bulk entry')
  return entry.download_uri
}

function toCardRow(c: ScryfallCard) {
  // For double-faced cards, grab oracle text from first face
  const oracleText = c.oracle_text ?? c.card_faces?.[0]?.oracle_text ?? null
  const imageUri = c.image_uris?.normal ?? c.card_faces?.[0]?.image_uris?.normal ?? null

  return {
    id: c.id,
    oracle_id: c.oracle_id,
    name: c.name,
    oracle_text: oracleText,
    type_line: c.type_line ?? null,
    mana_cost: c.mana_cost ?? null,
    cmc: c.cmc ?? null,
    colors: c.colors ?? [],
    color_identity: c.color_identity ?? [],
    legalities: c.legalities,
    set_code: c.set,
    collector_number: c.collector_number,
    rarity: c.rarity,
    image_uri: imageUri,
    usd: c.prices?.usd ? parseFloat(c.prices.usd) : null,
    tix: c.prices?.tix ? parseFloat(c.prices.tix) : null,
    updated_at: new Date().toISOString(),
  }
}

function isRelevant(card: ScryfallCard): boolean {
  return RELEVANT_FORMATS.some(
    fmt => card.legalities[fmt] === 'legal' || card.legalities[fmt] === 'restricted'
  )
}

async function upsertBatch(batch: ReturnType<typeof toCardRow>[]) {
  const { error } = await supabase
    .from('cards')
    .upsert(batch, { onConflict: 'id' })
  if (error) throw new Error(`Upsert error: ${error.message}`)
}

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = []
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size))
  return result
}

async function main() {
  console.log('Fetching Scryfall bulk data URL...')
  const url = await getBulkDownloadUrl()
  console.log(`Streaming from: ${url}`)

  const res = await fetch(url)
  if (!res.ok) throw new Error(`Download failed: ${res.status}`)
  if (!res.body) throw new Error('No response body')

  const nodeStream = Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0])
  const pipeline = nodeStream.pipe(parser()).pipe(streamArray())

  let batch: ReturnType<typeof toCardRow>[] = []
  let upserted = 0
  let total = 0
  const aliases = new Map<string, AliasRow>()

  for await (const { value } of pipeline) {
    const card = value as ScryfallCard
    total++
    if (!isRelevant(card)) continue

    batch.push(toCardRow(card))

    if (card.printed_name && card.printed_name !== card.name) {
      aliases.set(card.printed_name, {
        alias: card.printed_name,
        canonical: card.name,
        oracle_id: card.oracle_id,
        source: 'scryfall_printed_name',
      })
    }

    if (batch.length >= BATCH_SIZE) {
      await upsertBatch(batch)
      upserted += batch.length
      batch = []
      process.stdout.write(`\rUpserted ${upserted} cards (scanned ${total})...`)
    }
  }

  if (batch.length > 0) {
    await upsertBatch(batch)
    upserted += batch.length
  }

  // Upsert card name aliases
  if (aliases.size > 0) {
    const aliasBatches = chunk([...aliases.values()], BATCH_SIZE)
    for (const ab of aliasBatches) {
      const { error } = await supabase
        .from('card_name_aliases')
        .upsert(ab, { onConflict: 'alias' })
      if (error) throw new Error(`Alias upsert error: ${error.message}`)
    }
    console.log(`\nUpserted ${aliases.size} card name aliases`)
  }

  console.log(`Scryfall sync complete. ${upserted} cards upserted from ${total} total in export.`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
