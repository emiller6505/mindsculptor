import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

const DAILY_LIMIT = 10

function getResetsAt(): string {
  const now = new Date()
  const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
  return tomorrow.toISOString()
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ remaining: null, resets_at: getResetsAt() })
  }

  const today = new Date().toISOString().slice(0, 10)
  const { data: row } = await supabase
    .from('oracle_queries')
    .select('count')
    .eq('user_id', user.id)
    .eq('date', today)
    .single()

  const used = row?.count ?? 0
  return NextResponse.json({
    remaining: Math.max(0, DAILY_LIMIT - used),
    resets_at: getResetsAt(),
  })
}
