import {
  chunkArticle,
  extractCardNames,
  loadKnownCardNames,
  loadArchetypeNames,
  extractArchetypes,
} from './mtggoldfish-articles.js'

export { resetCaches } from './mtggoldfish-articles.js'

const TAG = '[tcgplayer-articles]'

export function extractTcgplayerCardNames(html: string, knownNames: Set<string>): string[] {
  const found = new Set<string>()

  // <card-hover-link card-name="Lightning Bolt">
  const hoverRe = /<card-hover-link[^>]*card-name="([^"]+)"/g
  let m: RegExpExecArray | null
  while ((m = hoverRe.exec(html)) !== null) {
    found.add(m[1].trim())
  }

  // Fall back to generic card name matching from known names
  const text = html.replace(/<[^>]+>/g, '')
  for (const name of extractCardNames(text, knownNames)) {
    found.add(name)
  }

  return [...found]
}

export async function parseAndStoreTcgplayerArticle(articleId: string, body: string): Promise<void> {
  const chunks = chunkArticle(body)
  if (chunks.length === 0) {
    console.log(`${TAG} No chunks extracted for article ${articleId}`)
    return
  }

  const [knownNames, archetypeNames] = await Promise.all([
    loadKnownCardNames(),
    loadArchetypeNames(),
  ])

  let vectors: number[][] = []
  try {
    const { embed } = await import('../lib/voyage.js')
    vectors = await embed(chunks)
  } catch (err) {
    console.warn(`${TAG} Embedding failed for article ${articleId}:`, err)
  }

  const rows = chunks.map((content, i) => ({
    article_id: articleId,
    chunk_index: i,
    content,
    embedding: vectors[i] ? JSON.stringify(vectors[i]) : null,
    archetypes: extractArchetypes(content, archetypeNames),
    cards_mentioned: extractTcgplayerCardNames(content, knownNames),
  }))

  const { supabase } = await import('../lib/supabase.js')
  const { error } = await supabase
    .from('article_chunks')
    .insert(rows)

  if (error) throw new Error(`article_chunks insert: ${error.message}`)
  console.log(`${TAG} Stored ${rows.length} chunks for article ${articleId}`)
}
