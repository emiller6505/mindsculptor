import { Suspense } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { cn, buttonVariants, Card } from '@/components/ui'
import { ConfidenceBadge } from '@/components/metagame/ConfidenceBadge'
import { MetaShareBar } from '@/components/metagame/MetaShareBar'
import { TopMoversWidget } from '@/components/metagame/TopMoversWidget'
import { TrendLines } from '@/components/metagame/TrendLines'
import { OracleSummaryCard } from '@/components/metagame/OracleSummaryCard'
import { MetaShareBarSkeleton, TopMoversSkeleton, TrendLinesSkeleton } from '@/components/metagame/skeletons'
import {
  parseRange,
  fetchCurrentWindow,
  fetchTrendLines,
  fetchTopArchetypeNames,
  hasSnapshots,
  extractHeaderStats,
  extractMetaShare,
  extractTopMovers,
} from './queries'

export const revalidate = 3600

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const hours = Math.floor(ms / 3_600_000)
  if (hours < 1) return 'less than an hour ago'
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

const FORMATS = ['modern', 'standard'] as const
type Format = (typeof FORMATS)[number]

const FORMAT_LABELS: Record<Format, string> = {
  modern: 'Modern',
  standard: 'Standard',
}

const RANGES = ['30d', '60d', '90d'] as const

export function generateStaticParams() {
  return FORMATS.map(format => ({ format }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ format: string }>
}): Promise<Metadata> {
  const { format } = await params
  if (!FORMATS.includes(format as Format)) return {}

  const label = FORMAT_LABELS[format as Format]
  const topNames = await fetchTopArchetypeNames(format)
  const desc = topNames.length > 0
    ? `Top ${label} decks this week: ${topNames.join(', ')} leading the field.`
    : `${label} metagame data — meta share, trends, and archetype breakdowns.`

  return {
    title: `${label} Metagame — Firemind`,
    description: desc,
  }
}

async function MetaShareBarSection({ format, rangeDays }: { format: string; rangeDays: number }) {
  const rows = await fetchCurrentWindow(format, rangeDays)
  const headerStats = extractHeaderStats(rows)
  const metaShare = extractMetaShare(rows)

  if (metaShare.length === 0) return null

  return (
    <div className="space-y-3">
      {headerStats && (
        <div className="flex items-center gap-3 flex-wrap">
          <ConfidenceBadge confidence={headerStats.confidence} sampleSize={headerStats.sample_size} />
          <span className="text-xs text-ash">
            · {headerStats.window_start} — {headerStats.window_end}
          </span>
          <span className="text-xs text-ash">
            · Last updated {relativeTime(headerStats.computed_at)}
          </span>
        </div>
      )}
      <Card className="p-4">
        <MetaShareBar data={metaShare} format={format} />
      </Card>
    </div>
  )
}

async function TopMoversSection({ format, rangeDays }: { format: string; rangeDays: number }) {
  const rows = await fetchCurrentWindow(format, rangeDays)
  const { gainers, losers } = extractTopMovers(rows)

  return (
    <Card className="p-5">
      <h2 className="text-sm font-medium text-ink mb-3">Top Movers</h2>
      <TopMoversWidget gainers={gainers} losers={losers} format={format} />
    </Card>
  )
}

async function TrendLinesSection({ format }: { format: string }) {
  const trendData = await fetchTrendLines(format)

  return (
    <Card className="p-5">
      <h2 className="text-sm font-medium text-ink mb-3">Meta Share Trends</h2>
      <TrendLines data={trendData} format={format} />
    </Card>
  )
}

export default async function FormatPage({
  params,
  searchParams,
}: {
  params: Promise<{ format: string }>
  searchParams: Promise<{ range?: string }>
}) {
  const { format } = await params
  if (!FORMATS.includes(format as Format)) notFound()

  const { range } = await searchParams
  const rangeDays = parseRange(range)
  const activeRange = RANGES.includes(range as typeof RANGES[number]) ? range : '30d'

  const label = FORMAT_LABELS[format as Format]
  const hasData = await hasSnapshots(format)

  if (!hasData) {
    return (
      <main className="max-w-4xl mx-auto px-6 py-12 space-y-8">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            {FORMATS.map(f => (
              <Link
                key={f}
                href={`/data/${f}`}
                className={cn(
                  buttonVariants({ variant: f === format ? 'primary' : 'secondary', size: 'sm' }),
                )}
              >
                {FORMAT_LABELS[f]}
              </Link>
            ))}
          </div>
          <p className="text-sm text-ash">
            {label} metagame — updated every 12 hours from live tournament results.
          </p>
        </div>
        <Card className="bg-surface/40 p-10 text-center space-y-3">
          <div className="text-3xl text-spark/30">◈</div>
          <p className="text-sm text-ash">
            No data yet for {label} — check back after the next scrape runs (~12 hours)
          </p>
        </Card>
        <OracleSummaryCard format={format} />
      </main>
    )
  }

  return (
    <main className="max-w-4xl mx-auto px-6 py-12 space-y-8">
      {/* Header: format tabs + range tabs */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          {FORMATS.map(f => (
            <Link
              key={f}
              href={`/data/${f}${range ? `?range=${range}` : ''}`}
              className={cn(
                buttonVariants({ variant: f === format ? 'primary' : 'secondary', size: 'sm' }),
              )}
            >
              {FORMAT_LABELS[f]}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {RANGES.map(r => (
            <Link
              key={r}
              href={`/data/${format}?range=${r}`}
              className={cn(
                'text-xs px-3 py-1.5 rounded-md transition-colors',
                r === activeRange
                  ? 'bg-spark/10 text-spark border border-spark/20'
                  : 'text-ash hover:text-ink border border-edge',
              )}
            >
              {r}
            </Link>
          ))}
        </div>

        <p className="text-sm text-ash">
          {label} metagame — updated every 12 hours from live tournament results.
        </p>
      </div>

      {/* Meta Share Bar + Header Stats */}
      <Suspense fallback={<MetaShareBarSkeleton />}>
        <MetaShareBarSection format={format} rangeDays={rangeDays} />
      </Suspense>

      {/* Top Movers */}
      <Suspense fallback={<TopMoversSkeleton />}>
        <TopMoversSection format={format} rangeDays={rangeDays} />
      </Suspense>

      {/* Trend Lines */}
      <Suspense fallback={<TrendLinesSkeleton />}>
        <TrendLinesSection format={format} />
      </Suspense>

      {/* Oracle CTA */}
      <OracleSummaryCard format={format} />
    </main>
  )
}
