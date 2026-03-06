import { supabase } from '../lib/supabase'
import { llm } from '../lib/llm'

const JACCARD_THRESHOLD = 0.5
const CENTROID_MIN_FREQ = 0.5      // card must appear in ≥50% of members to be in centroid
const MAX_REFINEMENT_ITERS = 10
const MIN_CLUSTER_SIZE = 2
const DEFAULT_WINDOW_DAYS = 90
const LLM_LABEL_DELAY_MS = 500    // pause between LLM archetype label calls to avoid rate limits

interface DeckRecord {
  id: string
  cardSet: Set<string>
  mainboard: { name: string; qty: number }[]
}

interface Cluster {
  decks: DeckRecord[]
}

export async function clusterArchetypes(format: string, windowDays = DEFAULT_WINDOW_DAYS): Promise<void> {
  const cutoff = new Date(Date.now() - windowDays * 86_400_000).toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('decks')
    .select('id, raw_list, tournaments!inner(format, date)')
    .eq('tournaments.format', format)
    .gte('tournaments.date', cutoff)
    .not('placement', 'is', null)
    .lte('placement', 32)

  if (error) throw new Error(`Cluster fetch error: ${error.message}`)
  if (!data || data.length === 0) {
    console.log(`[cluster] No decks found for ${format} in last ${windowDays} days`)
    return
  }

  const rawDecks: DeckRecord[] = data.flatMap(row => {
    const rawList = row.raw_list as { mainboard: { name: string; qty: number }[] } | null
    if (!rawList?.mainboard?.length) return []
    return [{ id: row.id, cardSet: new Set(rawList.mainboard.map(c => c.name)), mainboard: rawList.mainboard }]
  })

  // Option C: sort by typicality so the most representative decks seed first.
  // Score each deck by summing the global pool frequency of each of its cards.
  // Higher-scoring decks share more cards with the broader field — better seeds.
  const globalFreq = new Map<string, number>()
  for (const deck of rawDecks) {
    for (const card of deck.cardSet) globalFreq.set(card, (globalFreq.get(card) ?? 0) + 1)
  }
  const decks = [...rawDecks].sort((a, b) => {
    const scoreA = [...a.cardSet].reduce((s, c) => s + (globalFreq.get(c) ?? 0), 0)
    const scoreB = [...b.cardSet].reduce((s, c) => s + (globalFreq.get(c) ?? 0), 0)
    return scoreB - scoreA
  })

  console.log(`[cluster] ${format}: clustering ${decks.length} decks`)

  // Greedy Jaccard clustering — compare each deck against the current cluster centroid.
  // Centroid cache is kept per cluster and updated incrementally as decks join.
  const clusters: Cluster[] = []
  const centroidCache = new Map<Cluster, Set<string>>()

  for (const deck of decks) {
    let bestCluster: Cluster | null = null
    let bestScore = 0

    for (const cluster of clusters) {
      const centroid = centroidCache.get(cluster)!
      const score = jaccard(deck.cardSet, centroid)
      if (score > bestScore) {
        bestScore = score
        bestCluster = cluster
      }
    }

    if (bestCluster && bestScore >= JACCARD_THRESHOLD) {
      bestCluster.decks.push(deck)
      // Invalidate cached centroid — recompute lazily on next use
      centroidCache.set(bestCluster, computeCentroid(bestCluster))
    } else {
      const newCluster: Cluster = { decks: [deck] }
      clusters.push(newCluster)
      centroidCache.set(newCluster, deck.cardSet)  // single-deck centroid = its own cards
    }
  }

  // Option A: iterative refinement — recompute centroids and reassign until stable
  let iters = 0
  for (; iters < MAX_REFINEMENT_ITERS; iters++) {
    const centroids = clusters.map(computeCentroid)

    // Assign each deck to its best-scoring centroid (or nowhere if below threshold)
    const newMembers: DeckRecord[][] = clusters.map(() => [])
    let orphaned = 0
    for (const deck of decks) {
      let bestIdx = -1
      let bestScore = 0
      for (let i = 0; i < clusters.length; i++) {
        const score = jaccard(deck.cardSet, centroids[i])
        if (score > bestScore) { bestScore = score; bestIdx = i }
      }
      if (bestIdx >= 0 && bestScore >= JACCARD_THRESHOLD) {
        newMembers[bestIdx].push(deck)
      } else {
        orphaned++
      }
    }
    if (orphaned > 0) console.log(`[cluster] ${format}: iter ${iters} — ${orphaned} decks orphaned (below threshold against all centroids)`)

    // Check for convergence
    const changed = clusters.some((c, i) => {
      const oldIds = new Set(c.decks.map(d => d.id))
      const newIds = new Set(newMembers[i].map(d => d.id))
      return oldIds.size !== newIds.size || [...oldIds].some(id => !newIds.has(id))
    })

    for (let i = 0; i < clusters.length; i++) clusters[i].decks = newMembers[i]
    if (!changed) break
  }

  // Drop clusters that became empty or too small after refinement
  const viable = clusters.filter(c => c.decks.length >= MIN_CLUSTER_SIZE)

  console.log(`[cluster] ${format}: ${viable.length} clusters after ${iters} refinement iterations`)

  // Clear stale jaccard assignments for decks in this window before writing fresh ones
  const deckIds = decks.map(d => d.id)
  await supabase
    .from('deck_archetypes')
    .delete()
    .in('deck_id', deckIds)
    .eq('method', 'jaccard')

  // Load existing archetype names so the LLM can match against known names
  const { data: existingArchetypes } = await supabase
    .from('archetypes')
    .select('name')
    .eq('format', format)
  const knownNames = (existingArchetypes ?? []).map(a => a.name)

  for (let i = 0; i < viable.length; i++) {
    if (i > 0) await new Promise(resolve => setTimeout(resolve, LLM_LABEL_DELAY_MS))
    const cluster = viable[i]
    const archetypeId = await labelAndUpsertArchetype(cluster, format, knownNames)
    if (!archetypeId) continue

    const rows = cluster.decks.map(d => ({
      deck_id: d.id,
      archetype_id: archetypeId,
      confidence: parseFloat(avgJaccard(d, cluster).toFixed(4)),
      method: 'jaccard',
    }))

    const { error: upsertErr } = await supabase
      .from('deck_archetypes')
      .upsert(rows, { onConflict: 'deck_id,archetype_id' })

    if (upsertErr) console.error(`[cluster] deck_archetypes upsert error: ${upsertErr.message}`)
  }

  console.log(`[cluster] ${format}: done`)
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1
  if (a.size === 0 || b.size === 0) return 0
  let intersection = 0
  for (const card of a) if (b.has(card)) intersection++
  return intersection / (a.size + b.size - intersection)
}

// Centroid: cards appearing in ≥50% of cluster members
function computeCentroid(cluster: Cluster): Set<string> {
  const counts = new Map<string, number>()
  for (const deck of cluster.decks) {
    for (const card of deck.cardSet) counts.set(card, (counts.get(card) ?? 0) + 1)
  }
  const minCount = cluster.decks.length * CENTROID_MIN_FREQ
  const centroid = new Set<string>()
  for (const [card, count] of counts) {
    if (count >= minCount) centroid.add(card)
  }
  return centroid
}

function avgJaccard(deck: DeckRecord, cluster: Cluster): number {
  const others = cluster.decks.filter(d => d.id !== deck.id)
  if (others.length === 0) return 1
  const sum = others.reduce((acc, d) => acc + jaccard(deck.cardSet, d.cardSet), 0)
  return sum / others.length
}

function clusterCardFrequency(cluster: Cluster): { name: string; freq: number; avgQty: number }[] {
  const counts = new Map<string, number>()
  const qtyTotals = new Map<string, number>()
  for (const deck of cluster.decks) {
    for (const card of deck.cardSet) counts.set(card, (counts.get(card) ?? 0) + 1)
    for (const entry of deck.mainboard) {
      qtyTotals.set(entry.name, (qtyTotals.get(entry.name) ?? 0) + entry.qty)
    }
  }
  return [...counts.entries()]
    .map(([name, count]) => ({
      name,
      freq: count / cluster.decks.length,
      avgQty: parseFloat(((qtyTotals.get(name) ?? 0) / count).toFixed(1)),
    }))
    .sort((a, b) => b.freq - a.freq)
    .slice(0, 15)
}

interface CardMetadata {
  mana_cost: string | null
  oracle_text: string | null
  type_line: string | null
}

async function fetchCardMetadata(cardNames: string[]): Promise<Map<string, CardMetadata>> {
  const { data } = await supabase.from('cards').select('name, mana_cost, oracle_text, type_line').in('name', cardNames)
  const map = new Map<string, CardMetadata>()
  for (const row of data ?? []) {
    map.set(row.name, { mana_cost: row.mana_cost, oracle_text: row.oracle_text, type_line: row.type_line })
  }
  return map
}

function deriveColorIdentityFromMetadata(metadata: Map<string, CardMetadata>): string {
  const colors = new Set<string>()
  for (const card of metadata.values()) {
    for (const m of (card.mana_cost ?? '').matchAll(/[WUBRG]/g)) colors.add(m[0])
  }
  if (colors.size === 0) return 'Colorless'
  const COLOR_ORDER = ['W', 'U', 'B', 'R', 'G']
  const sorted = COLOR_ORDER.filter(c => colors.has(c))
  if (sorted.length === 1) {
    const full: Record<string, string> = { W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green' }
    return `Mono-${full[sorted[0]]}`
  }
  return sorted.join('')
}

function truncateOracle(text: string | null): string {
  if (!text) return ''
  return text.length > 120 ? text.slice(0, 117) + '...' : text
}

async function labelAndUpsertArchetype(cluster: Cluster, format: string, knownNames: string[]): Promise<string | null> {
  const topCards = clusterCardFrequency(cluster)
  const metadata = await fetchCardMetadata(topCards.map(c => c.name))
  const colorIdentity = deriveColorIdentityFromMetadata(metadata)

  const cardLines = topCards.map(c => {
    const meta = metadata.get(c.name)
    const typeLine = meta?.type_line ?? 'Unknown'
    const oracle = truncateOracle(meta?.oracle_text ?? null)
    return `${c.name} | ${c.avgQty}x | ${Math.round(c.freq * 100)}% | ${typeLine} | ${oracle}`
  }).join('\n')

  const knownList = knownNames.length > 0 ? knownNames.join(', ') : '(none yet)'

  const raw = await llm.complete(
    `You are labeling Magic: the Gathering archetypes for competitive tournament data. Return ONLY the canonical archetype name — nothing else. No explanation, no punctuation, no quotes.

Rules:
- Use the name competitive players actually use, not a description of the cards.
- Use the provided color identity — do NOT infer colors from card names or historic deck associations.
- Use guild/shard names for the provided colors (Boros = WR, Izzet = UR, Grixis = UBR, Azorius = WU, etc.).
- If this cluster matches a known archetype from the reference list, use that exact name.
- Prefer known names over inventing new ones.
- Only invent a new name if the cluster clearly doesn't match any known archetype.
- Card quantities matter: 4x of a card = core engine piece, 1x = toolbox/utility.
- Name after the deck's strategy or engine, not individual card names.
- Examples: "Izzet Murktide", "Mono-Red Burn", "Amulet Titan", "Eldrazi Ramp", "Boros Energy", "Domain Zoo", "Living End".`,
    `Format: ${format}
Color identity: ${colorIdentity}
Cluster size: ${cluster.decks.length} decks

Known archetypes in ${format}: [${knownList}]

Top mainboard cards (name | avg qty | % of decks | type | oracle text):
${cardLines}`,
    { maxTokens: 32, temperature: 0 },
  )

  const name = raw.trim().replace(/^["']|["']$/g, '')
  if (!name) return null

  const id = slugify(name) + '-' + format
  const keyCards = topCards.filter(c => c.freq >= 0.6).map(c => c.name)

  // Don't overwrite admin-managed archetypes' names
  const { data: existing } = await supabase
    .from('archetypes')
    .select('is_overridden')
    .eq('id', id)
    .maybeSingle()

  if (existing?.is_overridden) {
    const { error } = await supabase
      .from('archetypes')
      .update({ key_cards: keyCards, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('is_overridden', false)  // no-op if overridden
    if (error) console.error(`[cluster] archetype update error: ${error.message}`)
  } else {
    const { error } = await supabase
      .from('archetypes')
      .upsert({
        id,
        name,
        format,
        key_cards: keyCards,
        is_overridden: false,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' })
    if (error) {
      console.error(`[cluster] archetype upsert error: ${error.message}`)
      return null
    }
  }

  console.log(`[cluster] ${format}: "${name}" — ${cluster.decks.length} decks, key cards: ${keyCards.slice(0, 5).join(', ')}`)
  return id
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}
