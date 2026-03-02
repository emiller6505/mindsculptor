/**
 * One-off remediation: remove non-competitive Topdeck events (prerelease, sealed,
 * draft, 2HG, commander) that were scraped before the isCompetitiveConstructed()
 * filter was added.
 *
 * Cascade: tournaments → decks → deck_cards + deck_archetypes (all ON DELETE CASCADE)
 * scrape_jobs rows are preserved so future runs skip these TIDs.
 */
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const EXCLUDE_PATTERNS = [
  'prerelease', '2 headed', '2-headed', '2hg', 'sealed', 'draft', 'commander',
]

async function main() {
  // Preview: show what will be deleted
  const { data: preview, error: previewErr } = await supabase
    .from('tournaments')
    .select('id, name, format, date')
    .eq('source', 'topdeck')
    .or(EXCLUDE_PATTERNS.map(p => `name.ilike.%${p}%`).join(','))
    .order('name')

  if (previewErr) throw new Error(`Preview query failed: ${previewErr.message}`)

  if (!preview?.length) {
    console.log('No non-competitive tournaments found — nothing to delete.')
    return
  }

  console.log(`Found ${preview.length} tournament(s) to delete:`)
  for (const t of preview) {
    console.log(`  [${t.format}] ${t.name} (${t.date})`)
  }

  // Delete (cascade handles decks, deck_cards, deck_archetypes)
  const { error: deleteErr, count } = await supabase
    .from('tournaments')
    .delete({ count: 'exact' })
    .eq('source', 'topdeck')
    .or(EXCLUDE_PATTERNS.map(p => `name.ilike.%${p}%`).join(','))

  if (deleteErr) throw new Error(`Delete failed: ${deleteErr.message}`)
  console.log(`\nDeleted ${count} tournament(s) (cascades applied).`)
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
