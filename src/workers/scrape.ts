/**
 * Scrape worker — orchestrates all scrapers.
 * Run: npx tsx src/workers/scrape.ts
 * Scheduled: every 12h via Render cron
 */
import 'dotenv/config'
import { scrapeNewMtgoEvents } from '../scrapers/mtgo.js'
import { parsePendingMtgoJobs } from '../parsers/mtgo.js'
import { scrapeNewMtggoldfishEvents } from '../scrapers/mtggoldfish.js'
import { parsePendingMtggoldfishJobs } from '../parsers/mtggoldfish.js'
import { scrapeNewMtgtop8Events } from '../scrapers/mtgtop8.js'
import { parsePendingMtgtop8Jobs } from '../parsers/mtgtop8.js'
import { scrapeNewTopdeckEvents } from '../scrapers/topdeck.js'
import { parsePendingTopdeckJobs } from '../parsers/topdeck.js'

let anyFailed = false

async function run(label: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn()
  } catch (err) {
    console.error(`[scrape] ${label} failed:`, err)
    anyFailed = true
  }
}

async function main() {
  console.log(`[scrape] Starting scrape run at ${new Date().toISOString()}`)

  await run('mtgo scrape',        scrapeNewMtgoEvents)
  await run('mtgo parse',         parsePendingMtgoJobs)
  await run('mtggoldfish scrape', scrapeNewMtggoldfishEvents)
  await run('mtggoldfish parse',  parsePendingMtggoldfishJobs)
  await run('mtgtop8 scrape',     scrapeNewMtgtop8Events)
  await run('mtgtop8 parse',      parsePendingMtgtop8Jobs)
  await run('topdeck scrape',     scrapeNewTopdeckEvents)
  await run('topdeck parse',      parsePendingTopdeckJobs)

  if (anyFailed) {
    console.error(`[scrape] Run completed with errors at ${new Date().toISOString()}`)
    process.exit(1)
  }
  console.log(`[scrape] Scrape run complete at ${new Date().toISOString()}`)
}

main().catch(err => {
  console.error('[scrape] Fatal error:', err)
  process.exit(1)
})
