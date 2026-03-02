import { VoyageAIClient } from 'voyageai'

const client = new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY ?? '' })

export async function embed(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []
  const response = await client.embed({ input: texts, model: 'voyage-3' })
  return (response.data ?? []).map(d => d.embedding ?? [])
}
