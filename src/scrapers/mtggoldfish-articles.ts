import 'dotenv/config'
import { supabase } from '../lib/supabase.js'
import { parseAndStoreArticle } from '../parsers/mtggoldfish-articles.js'

const BASE_URL = 'https://www.mtggoldfish.com'
const RATE_LIMIT_MS = 2000
const USER_AGENT = 'Mozilla/5.0 (compatible; firemind-bot/1.0; +https://github.com/emiller6505/firemind)'
const MAX_PAGES = 10

const TAG = '[mtggoldfish-articles]'

async function fetchText(url: string): Promise<string> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30_000)
  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: controller.signal })
    if (!res.ok) {
      console.error(`${TAG} API_ERROR: GET ${url} returned HTTP ${res.status}`)
      throw new Error(`HTTP ${res.status} fetching ${url}`)
    }
    return res.text()
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('HTTP ')) throw err
    console.error(`${TAG} API_ERROR: GET ${url} failed:`, err)
    throw err
  } finally {
    clearTimeout(timeout)
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function extractArticleUrls(html: string): string[] {
  const re = /href="(\/articles\/[^"]+)"/g
  const urls = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const path = m[1]
    // Skip search/tag/page links — only want actual article pages
    if (path.includes('/search') || path.includes('?tag=') || path.includes('?page=')) continue
    urls.add(BASE_URL + path)
  }
  return [...urls]
}

const MONTHS: Record<string, string> = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
}

export function extractArticleMeta(html: string): { title: string; author: string | null; publishedAt: string | null; format: string | null } {
  // Title: first <h1> or <h2> with class containing "title"
  const titleMatch = html.match(/<h[12][^>]*>([^<]+)</) ?? html.match(/<title>([^<|]+)/)
  const title = titleMatch?.[1]?.trim() ?? 'Untitled'

  // Author: link text from author search link
  const authorMatch = html.match(/\/articles\/search\?author=[^"]*"[^>]*>([^<]+)</)
  const author = authorMatch?.[1]?.trim() ?? null

  // Date: "Mon DD, YYYY" pattern near author area
  const dateMatch = html.match(/([A-Z][a-z]{2})\s+(\d{1,2}),\s+(\d{4})/)
  let publishedAt: string | null = null
  if (dateMatch) {
    const month = MONTHS[dateMatch[1]]
    if (month) {
      const day = dateMatch[2].padStart(2, '0')
      publishedAt = `${dateMatch[3]}-${month}-${day}`
    }
  }

  // Format: check title and surrounding text for format keywords
  const lower = (title + ' ' + html.slice(0, 5000)).toLowerCase()
  let format: string | null = null
  if (lower.includes('modern')) format = 'modern'
  else if (lower.includes('standard')) format = 'standard'
  else if (lower.includes('pioneer')) format = 'pioneer'
  else if (lower.includes('legacy')) format = 'legacy'
  else if (lower.includes('vintage')) format = 'vintage'
  else if (lower.includes('pauper')) format = 'pauper'
  else if (lower.includes('historic')) format = 'historic'
  else if (lower.includes('commander') || lower.includes('edh') || lower.includes('cedh')) format = 'commander'

  return { title, author, publishedAt, format }
}

async function getAlreadyScrapedUrls(): Promise<Set<string>> {
  // Inner join: only articles that have at least one chunk are considered done.
  // Orphaned articles (row exists, no chunks) will be retried.
  const { data, error } = await supabase
    .from('articles')
    .select('url, article_chunks!inner(id)')
  if (error) throw new Error(`DB error: ${error.message}`)
  return new Set((data ?? []).map(r => r.url))
}

export async function scrapeNewMtggoldfishArticles(): Promise<void> {
  const alreadyScraped = await getAlreadyScrapedUrls()
  let totalNew = 0, totalSkipped = 0, totalErrors = 0, apiFailures = 0

  for (let page = 1; page <= MAX_PAGES; page++) {
    const listingUrl = `${BASE_URL}/articles?page=${page}`
    console.log(`${TAG} Fetching listing page ${page}...`)

    let listingHtml: string
    try {
      listingHtml = await fetchText(listingUrl)
    } catch {
      apiFailures++
      console.error(`${TAG} API_ERROR: listing page ${page} failed, stopping pagination`)
      break
    }

    const allUrls = extractArticleUrls(listingHtml)

    if (allUrls.length === 0) {
      if (page === 1) {
        console.error(`${TAG} API_SCHEMA_CHANGE: listing page returned 0 article URLs — HTML structure may have changed`)
        apiFailures++
      }
      break
    }

    console.log(`${TAG} Found ${allUrls.length} article URLs on page ${page}`)

    const newUrls = allUrls.filter(u => !alreadyScraped.has(u))
    if (newUrls.length === 0) {
      totalSkipped += allUrls.length
      console.log(`${TAG} All URLs on page ${page} already scraped — stopping`)
      break
    }
    totalSkipped += allUrls.length - newUrls.length

    for (const [i, url] of newUrls.entries()) {
      try {
        console.log(`${TAG} Fetching ${url}`)
        const html = await fetchText(url)
        const meta = extractArticleMeta(html)

        if (!meta.publishedAt) {
          console.warn(`${TAG} Skipping ${url} — no date found`)
          continue
        }

        const { data: article, error: insertErr } = await supabase
          .from('articles')
          .insert({
            source: 'mtggoldfish',
            url,
            title: meta.title,
            author: meta.author,
            published_at: meta.publishedAt,
            format: meta.format,
          })
          .select('id')
          .single()

        if (insertErr) {
          if (insertErr.code === '23505') {
            const { data: existing } = await supabase
              .from('articles')
              .select('id')
              .eq('url', url)
              .single()
            if (existing) {
              console.log(`${TAG} Reprocessing incomplete article: ${url}`)
              await parseAndStoreArticle(existing.id, html)
              totalNew++
            }
            alreadyScraped.add(url)
            continue
          }
          console.error(`${TAG} Insert error for ${url}: ${insertErr.message}`)
          totalErrors++
          continue
        }

        await parseAndStoreArticle(article.id, html)
        totalNew++
        alreadyScraped.add(url)
        console.log(`${TAG} Stored: ${meta.title}`)
      } catch (err) {
        console.error(`${TAG} Error processing ${url}:`, err)
        totalErrors++
      }

      if (i < newUrls.length - 1) await sleep(RATE_LIMIT_MS)
    }

    await sleep(RATE_LIMIT_MS)
  }

  console.log(`${TAG} SYNC_COMPLETE: new=${totalNew}, skipped=${totalSkipped}, errors=${totalErrors}, api_failures=${apiFailures}`)
}
