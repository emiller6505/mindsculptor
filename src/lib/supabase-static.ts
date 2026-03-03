import { createClient } from '@supabase/supabase-js'

// Cookie-free Supabase client for build-time / static generation contexts
// (generateStaticParams, generateMetadata) where cookies() is not available.
// Uses the anon key — only for public read-only queries.
export function createStaticClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
