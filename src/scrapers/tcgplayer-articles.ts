import 'dotenv/config'
import { supabase } from '../lib/supabase.js'
import { parseAndStoreTcgplayerArticle, resetCaches } from '../parsers/tcgplayer-articles.js'

const API_BASE = 'https://infinite-api.tcgplayer.com'
const RATE_LIMIT_MS = 2000
const PAGE_SIZE = 50
const MAX_PAGES = 20
const TAG = '[tcgplayer-articles]'

const RELEVANT_TAGS = new Set(['competitive', 'strategy', 'casual', 'budget'])

interface ArticleListing {
  uuid: string
  title: string
  authorName: string | null
  dateTime: string
  format: string | null
  tags?: string[]
  vertical?: string
  canonicalURL: string
}

interface ArticleDetail {
  article: {
    body: string
    title: string
    dateTime: string
    format: string | null
  }
  author: {
    name: string
  } | null
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchJson<T>(url: string): Promise<T | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30_000)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) {
      console.error(`${TAG} API_ERROR: GET ${url} returned HTTP ${res.status}`)
      return null
    }
    return await res.json() as T
  } catch (err) {
    console.error(`${TAG} API_ERROR: GET ${url} failed:`, err)
    return null
  } finally {
    clearTimeout(timeout)
  }
}

function buildArticleUrl(canonicalURL: string): string {
  return `https://www.tcgplayer.com/content${canonicalURL}`
}

function normalizeFormat(format: string | null): string | null {
  if (!format) return null
  const lower = format.toLowerCase()
  if (['standard', 'modern', 'pioneer', 'legacy', 'vintage', 'pauper', 'historic', 'commander'].includes(lower)) {
    return lower
  }
  if (lower === 'edh' || lower === 'cedh') return 'commander'
  return null
}

function hasRelevantTag(tags: string[] | undefined): boolean {
  if (!tags || !Array.isArray(tags)) return false
  return tags.some(t => RELEVANT_TAGS.has(t.toLowerCase()))
}

async function getAlreadyScrapedUrls(): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('articles')
    .select('url, article_chunks!inner(id)')
  if (error) throw new Error(`DB error: ${error.message}`)
  return new Set((data ?? []).map(r => r.url))
}

export async function scrapeNewTcgplayerArticles(): Promise<void> {
  const alreadyScraped = await getAlreadyScrapedUrls()
  let totalNew = 0, totalSkipped = 0, totalErrors = 0, apiFailures = 0

  for (let page = 0; page < MAX_PAGES; page++) {
    const offset = page * PAGE_SIZE
    const listUrl = `${API_BASE}/c/articles?vertical=magic&rows=${PAGE_SIZE}&offset=${offset}`
    console.log(`${TAG} Fetching listing page ${page + 1} (offset ${offset})...`)

    const data = await fetchJson<{ total: number; count: number; result: ArticleListing[] }>(listUrl)

    if (!data) {
      apiFailures++
      console.error(`${TAG} API_ERROR: listing request failed, stopping pagination`)
      break
    }

    if (!data.result || !Array.isArray(data.result)) {
      apiFailures++
      console.error(`${TAG} API_SCHEMA_CHANGE: /c/articles response missing field "result" — expected array, got ${typeof data.result}`)
      break
    }

    if (data.result.length === 0) {
      if (page === 0) {
        console.error(`${TAG} API_EMPTY: /c/articles returned 0 articles — API may have changed or be rate-limiting`)
        apiFailures++
      }
      break
    }

    const articles = data.result.filter(a =>
      a.vertical?.toLowerCase() === 'magic' && hasRelevantTag(a.tags)
    )

    let allKnown = true
    for (const listing of articles) {
      const url = buildArticleUrl(listing.canonicalURL)
      if (alreadyScraped.has(url)) {
        totalSkipped++
        continue
      }
      allKnown = false

      try {
        await sleep(RATE_LIMIT_MS)

        const detail = await fetchJson<{ result: ArticleDetail }>(`${API_BASE}/c/article/${listing.uuid}`)
        if (!detail?.result?.article?.body) {
          if (!detail) {
            apiFailures++
          } else {
            console.error(`${TAG} API_SCHEMA_CHANGE: /c/article/${listing.uuid} response missing "result.article.body"`)
            apiFailures++
          }
          totalErrors++
          continue
        }

        const article = detail.result.article
        const format = normalizeFormat(article.format ?? listing.format)
        const author = detail.result.author?.name ?? listing.authorName ?? null
        const publishedAt = article.dateTime ?? listing.dateTime

        const { data: inserted, error: insertErr } = await supabase
          .from('articles')
          .insert({
            source: 'tcgplayer',
            url,
            title: listing.title.trim(),
            author,
            published_at: publishedAt,
            format,
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
              console.log(`${TAG} Reprocessing incomplete article: ${listing.title}`)
              await parseAndStoreTcgplayerArticle(existing.id, article.body)
              totalNew++
            }
            alreadyScraped.add(url)
            continue
          }
          console.error(`${TAG} Insert error for ${url}: ${insertErr.message}`)
          totalErrors++
          continue
        }

        await parseAndStoreTcgplayerArticle(inserted.id, article.body)
        totalNew++
        alreadyScraped.add(url)
        console.log(`${TAG} Stored: ${listing.title}`)
      } catch (err) {
        console.error(`${TAG} Error processing ${listing.title}:`, err)
        totalErrors++
      }
    }

    if (allKnown && articles.length > 0) {
      console.log(`${TAG} All articles on page ${page + 1} already scraped — stopping`)
      break
    }

    if (data.result.length < PAGE_SIZE) break
    await sleep(RATE_LIMIT_MS)
  }

  resetCaches()
  console.log(`${TAG} SYNC_COMPLETE: new=${totalNew}, skipped=${totalSkipped}, errors=${totalErrors}, api_failures=${apiFailures}`)
}
