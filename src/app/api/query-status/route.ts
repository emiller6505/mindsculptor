import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { USER_LIMIT, getResetsAt } from '@/lib/rate-limit-constants'

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
    remaining: Math.max(0, USER_LIMIT - used),
    resets_at: getResetsAt(),
  })
}
