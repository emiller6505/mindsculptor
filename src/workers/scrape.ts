/**
 * Scrape worker — orchestrates all scrapers.
 * Run: npx tsx src/workers/scrape.ts
 * Scheduled: every 12h via Render cron
 */
import 'dotenv/config'
import { scrapeNewMtgoEvents } from '../scrapers/mtgo.js'
import { parsePendingMtgoJobs } from '../parsers/mtgo.js'

async function main() {
  console.log(`[scrape] Starting scrape run at ${new Date().toISOString()}`)

  await scrapeNewMtgoEvents()
  await parsePendingMtgoJobs()

  // Future scrapers added here:
  // await scrapeNewMtggoldfishEvents()
  // await scrapeNewMtgtop8Events()

  console.log(`[scrape] Scrape run complete at ${new Date().toISOString()}`)
}

main().catch(err => {
  console.error('[scrape] Fatal error:', err)
  process.exit(1)
})
