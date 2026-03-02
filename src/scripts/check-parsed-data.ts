import 'dotenv/config'
import { supabase } from '../lib/supabase.js'

async function main() {
  const [tournaments, decks, deckCards, scrapeJobs] = await Promise.all([
    supabase.from('tournaments').select('id, name, format, date, tier').order('date', { ascending: false }),
    supabase.from('decks').select('id, tournament_id, pilot, placement').order('placement', { ascending: true }).limit(10),
    supabase.from('deck_cards').select('*', { count: 'exact', head: true }),
    supabase.from('scrape_jobs').select('status', { count: 'exact' }).eq('status', 'pending'),
  ])

  console.log('=== Tournaments ===')
  tournaments.data?.forEach(t => console.log(`  ${t.format.padEnd(10)} ${t.date} ${t.tier?.padEnd(12)} ${t.name}`))

  console.log('\n=== Top placements (sample) ===')
  decks.data?.forEach(d => console.log(`  rank ${String(d.placement ?? '?').padStart(3)}  ${d.pilot}`))

  console.log(`\n=== deck_cards total: ${deckCards.count}`)
  console.log(`=== pending scrape_jobs remaining: ${scrapeJobs.count}`)

  // Spot-check: look up a specific deck with its cards
  const { data: modernTop } = await supabase
    .from('decks')
    .select('pilot, placement, deck_cards(card_name, quantity, is_sideboard)')
    .eq('placement', 1)
    .limit(1)
    .single()

  if (modernTop) {
    const main = (modernTop.deck_cards as any[]).filter(c => !c.is_sideboard)
    const side = (modernTop.deck_cards as any[]).filter(c => c.is_sideboard)
    const mainQty = main.reduce((s: number, c: any) => s + c.quantity, 0)
    console.log(`\n=== 1st place deck: ${modernTop.pilot} (placement ${modernTop.placement})`)
    console.log(`    mainboard: ${main.length} entries, ${mainQty} cards`)
    console.log(`    sideboard: ${side.length} entries`)
    console.log(`    sample cards: ${main.slice(0, 4).map((c: any) => `${c.quantity}x ${c.card_name}`).join(', ')}`)
  }
}

main().catch(err => { console.error(err); process.exit(1) })
