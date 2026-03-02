import 'dotenv/config'
import { supabase } from '../lib/supabase.js'

async function main() {
  const { data } = await supabase
    .from('scrape_jobs')
    .select('id, source, source_url, status, error, fetched_at')
    .order('id')
  data?.forEach(r => console.log(
    `${r.id}`.padStart(4), r.status.padEnd(8),
    r.source_url?.split('/').pop()?.padEnd(50),
    r.error ?? ''
  ))
  console.log('\ntotal:', data?.length)
}
main().catch(err => { console.error(err); process.exit(1) })
