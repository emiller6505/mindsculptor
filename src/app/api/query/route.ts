import { NextRequest, NextResponse } from 'next/server'
import { handleQueryStream } from '@/query/index'
import type { ConversationMessage } from '@/query/index'
import { cacheGet, cacheSet } from '@/lib/query-cache'
import type { QueryResponse } from '@/query/index'
import { createClient } from '@/lib/supabase-server'

const MAX_HISTORY = 6
const DAILY_LIMIT = 10

function getResetsAt(): string {
  const now = new Date()
  const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
  return tomorrow.toISOString()
}

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body?.query || typeof body.query !== 'string') {
    return NextResponse.json({ error: 'query string is required' }, { status: 400 })
  }
  if (body.query.length > 1000) {
    return NextResponse.json({ error: 'query too long (max 1000 chars)' }, { status: 400 })
  }

  const rawMessages = Array.isArray(body.messages) ? body.messages : []
  const history: ConversationMessage[] = rawMessages
    .filter((m: unknown) => m && typeof (m as Record<string, unknown>).role === 'string' && typeof (m as Record<string, unknown>).content === 'string')
    .slice(-MAX_HISTORY)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const resetsAt = getResetsAt()

  let currentCount = 0
  if (user) {
    const today = new Date().toISOString().slice(0, 10)
    const { data: row } = await supabase
      .from('oracle_queries')
      .select('count')
      .eq('user_id', user.id)
      .eq('date', today)
      .single()

    currentCount = row?.count ?? 0

    if (currentCount >= DAILY_LIMIT) {
      return NextResponse.json({
        error: 'rate_limit_exceeded',
        rate_limit: { remaining: 0, resets_at: resetsAt, tier: 'user' },
      }, { status: 429 })
    }
  }

  const key = body.query.trim().toLowerCase()
  const cached = cacheGet<QueryResponse>(key)

  if (cached) {
    const rateLimit = user
      ? { remaining: DAILY_LIMIT - currentCount - 1, resets_at: resetsAt, tier: 'user' }
      : { remaining: null, resets_at: resetsAt, tier: 'anon' }

    if (user) {
      const today = new Date().toISOString().slice(0, 10)
      await supabase
        .from('oracle_queries')
        .upsert(
          { user_id: user.id, date: today, count: currentCount + 1 },
          { onConflict: 'user_id,date' },
        )
    }

    const readable = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder()
        controller.enqueue(encoder.encode(sseEvent('meta', { intent: cached.intent, data: cached.data, rate_limit: rateLimit })))
        controller.enqueue(encoder.encode(sseEvent('delta', { text: cached.answer })))
        controller.enqueue(encoder.encode(sseEvent('done', {})))
        controller.close()
      },
    })

    return new Response(readable, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
    })
  }

  try {
    const result = await handleQueryStream(body.query, history)

    const rateLimit = user
      ? { remaining: DAILY_LIMIT - currentCount - 1, resets_at: resetsAt, tier: 'user' }
      : { remaining: null, resets_at: resetsAt, tier: 'anon' }

    const readable = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        controller.enqueue(encoder.encode(sseEvent('meta', { intent: result.intent, data: result.data, rate_limit: rateLimit })))

        let fullAnswer = ''
        try {
          for await (const chunk of result.stream) {
            fullAnswer += chunk
            controller.enqueue(encoder.encode(sseEvent('delta', { text: chunk })))
          }
          controller.enqueue(encoder.encode(sseEvent('done', {})))

          cacheSet(key, { answer: fullAnswer, intent: result.intent, data: result.data })

          if (user) {
            const today = new Date().toISOString().slice(0, 10)
            await supabase
              .from('oracle_queries')
              .upsert(
                { user_id: user.id, date: today, count: currentCount + 1 },
                { onConflict: 'user_id,date' },
              )
          }
        } catch (err) {
          console.error('[api/query] stream error', err)
          controller.enqueue(encoder.encode(sseEvent('error', { error: 'Stream failed' })))
        } finally {
          controller.close()
        }
      },
    })

    return new Response(readable, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
    })
  } catch (err) {
    console.error('[api/query]', err)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }
}
