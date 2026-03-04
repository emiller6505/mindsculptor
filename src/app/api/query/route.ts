import { NextRequest, NextResponse } from 'next/server'
import { handleQuery } from '@/query/index'
import type { ConversationMessage } from '@/query/index'
import { createClient } from '@/lib/supabase-server'

const MAX_HISTORY = 6
const DAILY_LIMIT = 10

function getResetsAt(): string {
  const now = new Date()
  const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
  return tomorrow.toISOString()
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

  if (user) {
    const today = new Date().toISOString().slice(0, 10)
    const { data: row } = await supabase
      .from('oracle_queries')
      .select('count')
      .eq('user_id', user.id)
      .eq('date', today)
      .single()

    const currentCount = row?.count ?? 0

    if (currentCount >= DAILY_LIMIT) {
      return NextResponse.json({
        error: 'rate_limit_exceeded',
        rate_limit: { remaining: 0, resets_at: resetsAt, tier: 'user' },
      }, { status: 429 })
    }

    try {
      const result = await handleQuery(body.query, history)

      await supabase
        .from('oracle_queries')
        .upsert(
          { user_id: user.id, date: today, count: currentCount + 1 },
          { onConflict: 'user_id,date' },
        )

      return NextResponse.json({
        ...result,
        rate_limit: { remaining: DAILY_LIMIT - currentCount - 1, resets_at: resetsAt, tier: 'user' },
      })
    } catch (err) {
      console.error('[api/query]', err)
      return NextResponse.json({ error: 'Query failed' }, { status: 500 })
    }
  }

  // Anonymous path — no server enforcement
  try {
    const result = await handleQuery(body.query, history)
    return NextResponse.json({
      ...result,
      rate_limit: { remaining: null, resets_at: resetsAt, tier: 'anon' },
    })
  } catch (err) {
    console.error('[api/query]', err)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }
}
