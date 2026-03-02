import { supabase } from '../lib/supabase'
import { embed } from '../lib/voyage'

const MODEL = 'voyage-3'
// Voyage AI allows up to 128 texts per request
const BATCH_SIZE = 64

export async function embedArchetypes(format?: string): Promise<void> {
  let query = supabase.from('archetypes').select('id, name, format, key_cards, description')
  if (format) query = query.eq('format', format)

  const { data, error } = await query
  if (error) throw new Error(`Embed fetch error: ${error.message}`)
  if (!data || data.length === 0) {
    console.log('[embed] No archetypes to embed')
    return
  }

  // Only embed archetypes that don't already have an up-to-date embedding
  const { data: existing } = await supabase
    .from('embeddings')
    .select('entity_id')
    .eq('entity_type', 'archetype')
    .eq('model', MODEL)
    .in('entity_id', data.map(a => a.id))

  const alreadyEmbedded = new Set((existing ?? []).map(e => e.entity_id))
  const toEmbed = data.filter(a => !alreadyEmbedded.has(a.id))

  if (toEmbed.length === 0) {
    console.log('[embed] All archetypes already embedded')
    return
  }

  console.log(`[embed] Embedding ${toEmbed.length} archetypes`)

  for (let i = 0; i < toEmbed.length; i += BATCH_SIZE) {
    const batch = toEmbed.slice(i, i + BATCH_SIZE)
    const texts = batch.map(a => archetypeText(a))
    const vectors = await embed(texts)

    const rows = batch.map((a, idx) => ({
      entity_type: 'archetype',
      entity_id: a.id,
      model: MODEL,
      embedding: JSON.stringify(vectors[idx]),  // Supabase stores as JSON array
    }))

    const { error: insertErr } = await supabase
      .from('embeddings')
      .upsert(rows, { onConflict: 'entity_type,entity_id,model' })

    if (insertErr) throw new Error(`Embed insert error: ${insertErr.message}`)
    console.log(`[embed] Stored embeddings ${i + 1}–${Math.min(i + BATCH_SIZE, toEmbed.length)}`)
  }

  console.log('[embed] Done')
}

function archetypeText(a: { name: string; format: string; key_cards: string[] | null; description: string | null }): string {
  const parts = [`${a.format} archetype: ${a.name}`]
  if (a.key_cards?.length) parts.push(`Key cards: ${a.key_cards.join(', ')}`)
  if (a.description) parts.push(a.description)
  return parts.join('. ')
}
