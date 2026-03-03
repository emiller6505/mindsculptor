import { NextRequest, NextResponse } from 'next/server'
import { handleQuery } from '@/query/index'
import type { ConversationMessage } from '@/query/index'

const MAX_HISTORY = 6

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

  try {
    const result = await handleQuery(body.query, history)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[api/query]', err)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }
}
