import { Suspense } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { Card, Badge } from '@/components/ui'
import { ConfidenceBadge } from '@/components/metagame/ConfidenceBadge'
import { ShareOverTime } from '@/components/metagame/ShareOverTime'
import { WinRateOverTime } from '@/components/metagame/WinRateOverTime'
import { RecentResults } from '@/components/metagame/RecentResults'
import {
  ArchetypeHeaderSkeleton,
  ShareOverTimeSkeleton,
  RecentResultsSkeleton,
} from '@/components/metagame/skeletons'
import {
  fetchArchetype,
  fetchLatestSnapshot,
  fetchShareHistory,
  fetchHasMatches,
  fetchRecentResults,
  fetchAllArchetypeIds,
  trendArrow,
} from './queries'

export const revalidate = 3600

const FORMAT_LABELS: Record<string, string> = {
  modern: 'Modern',
  standard: 'Standard',
}

const TIER_COLORS: Record<string, string> = {
  S: 'spark',
  A: 'gold',
  B: 'copper',
  C: 'default',
}

export async function generateStaticParams() {
  const ids = await fetchAllArchetypeIds()
  return ids
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ format: string; archetype: string }>
}): Promise<Metadata> {
  const { archetype: archetypeId } = await params
  const [arch, snapshot] = await Promise.all([
    fetchArchetype(archetypeId),
    fetchLatestSnapshot(archetypeId),
  ])
  if (!arch) return {}

  const formatLabel = FORMAT_LABELS[arch.format] ?? arch.format
  const desc = snapshot
    ? `${arch.name} is a Tier ${arch.tier} deck in ${formatLabel} with ${snapshot.meta_share.toFixed(1)}% meta share. See recent results, trends, and oracle analysis.`
    : `${arch.name} meta share, win rate, and recent tournament results in ${formatLabel}.`

  return {
    title: `${arch.name} — ${formatLabel} Metagame — Firemind`,
    description: desc,
  }
}

async function ArchetypeHeader({ archetypeId }: { archetypeId: string }) {
  const [archetype, snapshot] = await Promise.all([
    fetchArchetype(archetypeId),
    fetchLatestSnapshot(archetypeId),
  ])

  if (!archetype) return null

  const formatLabel = FORMAT_LABELS[archetype.format] ?? archetype.format
  const tierVariant = TIER_COLORS[archetype.tier] ?? 'default'
  const trend = snapshot ? trendArrow(snapshot.trend_delta) : null

  return (
    <div className="space-y-3">
      {/* Breadcrumb */}
      <nav className="text-s text-ash flex items-center gap-1.5">
        <Link href="/data" className="hover:text-ink transition-colors">/ Data</Link>
        <span>/</span>
        <Link href={`/data/${archetype.format}`} className="hover:text-ink transition-colors">
          {formatLabel}
        </Link>
        <span>/</span>
        <span className="text-ink">{archetype.name}</span>
      </nav>

      {/* Title + badges */}
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-2xl font-semibold text-ink">{archetype.name}</h1>
        <Badge variant="spark">
          {formatLabel}
        </Badge>
        <Badge variant={tierVariant as 'spark' | 'gold' | 'copper' | 'default'}>
          Tier {archetype.tier}
        </Badge>
        <button
          disabled
          title="Sign in to set alerts"
          className="ml-auto inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-edge text-ash/50 cursor-not-allowed"
          aria-label="Set alerts (requires sign in)"
        >
          Alerts <span>&#x1F514;</span>
        </button>
      </div>

      {/* Stats row */}
      <div className="flex items-baseline gap-4 flex-wrap">
        {snapshot ? (
          <>
            <span className="text-3xl font-bold text-ink">
              {snapshot.meta_share.toFixed(1)}%
            </span>
            {trend && (
              <span className={`text-lg font-medium ${trend.color}`}>
                {trend.label}
              </span>
            )}
            <span className="text-sm text-ash">meta share</span>
          </>
        ) : (
          <span className="text-sm italic text-ash">No snapshot data yet</span>
        )}
      </div>

      {/* Confidence */}
      {snapshot && (
        <ConfidenceBadge confidence={snapshot.confidence} sampleSize={snapshot.sample_size} />
      )}

      {/* Win rate — always pending for now */}
      <p className="text-sm italic text-ash">Win rate pending</p>

      {/* Description */}
      {archetype.description && (
        <p className="text-sm text-ash">{archetype.description}</p>
      )}
    </div>
  )
}

async function ShareOverTimeSection({ archetypeId }: { archetypeId: string }) {
  const history = await fetchShareHistory(archetypeId)
  const data = history.map(h => ({ window_end: h.window_end, meta_share: h.meta_share }))

  return (
    <Card className="p-5">
      <h2 className="text-sm font-medium text-ink mb-3">Meta Share Over Time</h2>
      <ShareOverTime data={data} />
    </Card>
  )
}

async function WinRateOverTimeSection() {
  const hasMatches = await fetchHasMatches()

  return (
    <Card className="p-5">
      <h2 className="text-sm font-medium text-ink mb-3">Win Rate Over Time</h2>
      <WinRateOverTime hasMatches={hasMatches} data={[]} />
    </Card>
  )
}

async function RecentResultsSection({ archetypeId }: { archetypeId: string }) {
  const results = await fetchRecentResults(archetypeId)

  return (
    <Card className="p-5">
      <h2 className="text-sm font-medium text-ink mb-3">Recent Results</h2>
      <RecentResults results={results} />
    </Card>
  )
}

export default async function ArchetypePage({
  params,
}: {
  params: Promise<{ format: string; archetype: string }>
}) {
  const { format, archetype: archetypeId } = await params

  const arch = await fetchArchetype(archetypeId)
  if (!arch) notFound()
  if (arch.format !== format) notFound()

  const encodedName = encodeURIComponent(arch.name)

  return (
    <main className="max-w-4xl mx-auto px-6 py-8 md:py-12 space-y-8">
      <Suspense fallback={<ArchetypeHeaderSkeleton />}>
        <ArchetypeHeader archetypeId={archetypeId} />
      </Suspense>

      <Suspense fallback={<RecentResultsSkeleton />}>
        <RecentResultsSection archetypeId={archetypeId} />
      </Suspense>

      <Suspense fallback={<ShareOverTimeSkeleton />}>
        <ShareOverTimeSection archetypeId={archetypeId} />
      </Suspense>

      <Suspense fallback={<ShareOverTimeSkeleton />}>
        <WinRateOverTimeSection />
      </Suspense>

      {/* Oracle CTAs */}
      <Card className="p-5 space-y-3">
        <h2 className="text-sm font-medium text-ink">Ask the Firemind</h2>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/chat?q=Tell me about ${encodedName} in the current meta`}
            className="text-xs px-3 py-1.5 rounded-md bg-spark/10 text-spark border border-spark/20 hover:bg-spark/20 transition-colors"
          >
            Ask about {arch.name}
          </Link>
          <Link
            href={`/chat?q=Generate a sample ${encodedName} deck list`}
            className="text-xs px-3 py-1.5 rounded-md bg-spark/10 text-spark border border-spark/20 hover:bg-spark/20 transition-colors"
          >
            Generate sample deck list
          </Link>
          <Link
            href={`/chat?q=Sideboard plan for ${encodedName} vs the field`}
            className="text-xs px-3 py-1.5 rounded-md bg-spark/10 text-spark border border-spark/20 hover:bg-spark/20 transition-colors"
          >
            Sideboard plan vs the field
          </Link>
        </div>
      </Card>
    </main>
  )
}
