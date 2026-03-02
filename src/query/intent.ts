import { llm } from '../lib/llm'
import { rcqPromptNote } from '../lib/rcq-schedule'

export interface Intent {
  format: 'modern' | 'standard' | null
  question_type: 'metagame' | 'deck_advice' | 'card_question' | 'matchup' | 'general'
  archetype: string | null      // primary archetype mentioned
  archetype_b: string | null    // second archetype (matchup questions only)
  card: string | null           // specific card name (card_question only)
  timeframe_days: 30 | 60 | 90  // lookback window; default 90
}

const SYSTEM_BASE = `You are a Magic: the Gathering query parser. Extract structured intent from the user's question.

Return ONLY valid JSON matching this exact schema — no prose, no markdown, no code fences:

{
  "format": "modern" | "standard" | null,
  "question_type": "metagame" | "deck_advice" | "card_question" | "matchup" | "general",
  "archetype": string | null,
  "archetype_b": string | null,
  "card": string | null,
  "timeframe_days": 30 | 60 | 90
}

Rules:
- format: infer from context ("rotation" or "Standard" → "standard", "Modern" → "modern"). For RCQ questions, use the current RCQ season format noted below — do NOT default to modern. null if still ambiguous.
- question_type: "metagame" = meta share/tier questions, "deck_advice" = what to play/build, "card_question" = specific card usage/value, "matchup" = archetype vs archetype, "general" = anything else.
- archetype: normalize to a common name (e.g. "Izzet Murktide" not "blue-red tempo"). null if not mentioned.
- archetype_b: only for matchup questions; null otherwise.
- card: canonical card name if this is a card question; null otherwise.
- timeframe_days: default 90. Use 30 if "this week", "recent", or "right now" is emphasized.`

export async function extractIntent(query: string): Promise<Intent> {
  const system = `${SYSTEM_BASE}\n\n${rcqPromptNote()}`
  const raw = await llm.complete(system, query, { maxTokens: 256, temperature: 0 })
  try {
    const cleaned = raw.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    const parsed = JSON.parse(cleaned)
    if (!parsed || typeof parsed !== 'object') throw new Error('not an object')
    return parsed as Intent
  } catch {
    throw new Error(`Intent parse failed. Raw response: ${raw}`)
  }
}
