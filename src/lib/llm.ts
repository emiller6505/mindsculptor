import Anthropic from '@anthropic-ai/sdk'

export interface LLMOptions {
  maxTokens?: number
  temperature?: number
  model?: string
  onRetry?: () => void
}

export type HistoryMessage = { role: 'user' | 'assistant'; content: string }

export interface LLMProvider {
  complete(system: string, user: string, opts?: LLMOptions): Promise<string>
  completeWithHistory(system: string, messages: HistoryMessage[], opts?: LLMOptions): Promise<string>
  completeStream(system: string, user: string, opts?: LLMOptions): AsyncIterable<string>
  completeStreamWithHistory(system: string, messages: HistoryMessage[], opts?: LLMOptions): AsyncIterable<string>
}

const DEFAULT_MODEL = 'claude-sonnet-4-6'
const MAX_RETRIES = 3
const INITIAL_BACKOFF_MS = 2000

function isRetryable(err: unknown): boolean {
  return err instanceof Anthropic.APIError && (err.status === 429 || err.status === 529)
}

async function withRetry<T>(fn: () => Promise<T>, onRetry?: () => void): Promise<T> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (!isRetryable(err) || attempt === MAX_RETRIES) throw err
      if (attempt === 0) onRetry?.()
      const delay = INITIAL_BACKOFF_MS * 2 ** attempt
      console.log(`[llm] rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`)
      await new Promise(r => setTimeout(r, delay))
    }
  }
  throw new Error('unreachable')
}

class ClaudeProvider implements LLMProvider {
  private client: Anthropic

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('Missing ANTHROPIC_API_KEY env var')
    this.client = new Anthropic({ apiKey })
  }

  async complete(system: string, user: string, opts: LLMOptions = {}): Promise<string> {
    return withRetry(async () => {
      const msg = await this.client.messages.create({
        model: opts.model ?? DEFAULT_MODEL,
        max_tokens: opts.maxTokens ?? 1024,
        temperature: opts.temperature ?? 1,
        system,
        messages: [{ role: 'user', content: user }],
      })
      const block = msg.content[0]
      if (!block || block.type !== 'text') throw new Error('Unexpected response type from Claude')
      return block.text
    }, opts.onRetry)
  }

  async completeWithHistory(system: string, messages: HistoryMessage[], opts: LLMOptions = {}): Promise<string> {
    return withRetry(async () => {
      const msg = await this.client.messages.create({
        model: opts.model ?? DEFAULT_MODEL,
        max_tokens: opts.maxTokens ?? 1024,
        temperature: opts.temperature ?? 1,
        system,
        messages,
      })
      const block = msg.content[0]
      if (!block || block.type !== 'text') throw new Error('Unexpected response type from Claude')
      return block.text
    }, opts.onRetry)
  }

  async *completeStream(system: string, user: string, opts: LLMOptions = {}): AsyncIterable<string> {
    const createStream = () => withRetry(async () => {
      return this.client.messages.stream({
        model: opts.model ?? DEFAULT_MODEL,
        max_tokens: opts.maxTokens ?? 1024,
        temperature: opts.temperature ?? 1,
        system,
        messages: [{ role: 'user', content: user }],
      })
    }, opts.onRetry)

    const stream = await createStream()
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield event.delta.text
      }
    }
  }

  async *completeStreamWithHistory(system: string, messages: HistoryMessage[], opts: LLMOptions = {}): AsyncIterable<string> {
    const createStream = () => withRetry(async () => {
      return this.client.messages.stream({
        model: opts.model ?? DEFAULT_MODEL,
        max_tokens: opts.maxTokens ?? 1024,
        temperature: opts.temperature ?? 1,
        system,
        messages,
      })
    }, opts.onRetry)

    const stream = await createStream()
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield event.delta.text
      }
    }
  }
}

export const llm: LLMProvider = new ClaudeProvider()
