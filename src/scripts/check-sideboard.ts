import 'dotenv/config'
import { supabase } from '../lib/supabase.js'

async function main() {
  const { count: sideCount } = await supabase
    .from('deck_cards')
    .select('*', { count: 'exact', head: true })
    .eq('is_sideboard', true)

  const { count: mainCount } = await supabase
    .from('deck_cards')
    .select('*', { count: 'exact', head: true })
    .eq('is_sideboard', false)

  console.log('mainboard entries:', mainCount)
  console.log('sideboard entries:', sideCount)

  // Sample a deck with sideboard entries if any
  if ((sideCount ?? 0) > 0) {
    const { data } = await supabase
      .from('deck_cards')
      .select('deck_id, card_name, quantity')
      .eq('is_sideboard', true)
      .limit(5)
    console.log('sample sideboard cards:', data)
  } else {
    // Check raw_list on a deck to see if sideboard data is there
    const { data } = await supabase
      .from('decks')
      .select('pilot, placement, raw_list')
      .order('placement')
      .limit(3)
    data?.forEach(d => {
      const sb = (d.raw_list as any)?.sideboard
      console.log(`${d.pilot} (rank ${d.placement}) sideboard in raw_list: ${sb?.length ?? 0} entries`)
      if (sb?.length) console.log('  sample:', sb.slice(0, 2))
    })
  }
}

main().catch(err => { console.error(err); process.exit(1) })
