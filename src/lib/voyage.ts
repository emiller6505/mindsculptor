import { VoyageAIClient } from 'voyageai'

const apiKey = process.env.VOYAGE_API_KEY
if (!apiKey) {
  throw new Error('Missing VOYAGE_API_KEY env var')
}

const client = new VoyageAIClient({ apiKey })

export async function embed(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []
  const response = await client.embed({ input: texts, model: 'voyage-3' })
  return (response.data ?? []).map(d => d.embedding ?? [])
}
