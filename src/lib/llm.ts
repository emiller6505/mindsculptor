import Anthropic from '@anthropic-ai/sdk'

export interface LLMOptions {
  maxTokens?: number
  temperature?: number
  model?: string
}

export type HistoryMessage = { role: 'user' | 'assistant'; content: string }

export interface LLMProvider {
  complete(system: string, user: string, opts?: LLMOptions): Promise<string>
  completeWithHistory(system: string, messages: HistoryMessage[], opts?: LLMOptions): Promise<string>
  completeStream(system: string, user: string, opts?: LLMOptions): AsyncIterable<string>
  completeStreamWithHistory(system: string, messages: HistoryMessage[], opts?: LLMOptions): AsyncIterable<string>
}

const DEFAULT_MODEL = 'claude-sonnet-4-6'

class ClaudeProvider implements LLMProvider {
  private client: Anthropic

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('Missing ANTHROPIC_API_KEY env var')
    this.client = new Anthropic({ apiKey })
  }

  async complete(system: string, user: string, opts: LLMOptions = {}): Promise<string> {
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
  }

  async completeWithHistory(system: string, messages: HistoryMessage[], opts: LLMOptions = {}): Promise<string> {
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
  }

  async *completeStream(system: string, user: string, opts: LLMOptions = {}): AsyncIterable<string> {
    const stream = this.client.messages.stream({
      model: opts.model ?? DEFAULT_MODEL,
      max_tokens: opts.maxTokens ?? 1024,
      temperature: opts.temperature ?? 1,
      system,
      messages: [{ role: 'user', content: user }],
    })
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield event.delta.text
      }
    }
  }

  async *completeStreamWithHistory(system: string, messages: HistoryMessage[], opts: LLMOptions = {}): AsyncIterable<string> {
    const stream = this.client.messages.stream({
      model: opts.model ?? DEFAULT_MODEL,
      max_tokens: opts.maxTokens ?? 1024,
      temperature: opts.temperature ?? 1,
      system,
      messages,
    })
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield event.delta.text
      }
    }
  }
}

export const llm: LLMProvider = new ClaudeProvider()
