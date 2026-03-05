import { scrapeNewMtggoldfishArticles } from '../scrapers/mtggoldfish-articles.js'
import { scrapeNewTcgplayerArticles } from '../scrapers/tcgplayer-articles.js'
import { resetCaches } from '../parsers/mtggoldfish-articles.js'

async function main() {
  console.log(`[sync-articles] Starting at ${new Date().toISOString()}`)
  await scrapeNewMtggoldfishArticles()
  await scrapeNewTcgplayerArticles()
  resetCaches()
  console.log(`[sync-articles] Done at ${new Date().toISOString()}`)
}

main().catch(err => {
  console.error('[sync-articles] Fatal error:', err)
  process.exit(1)
})
