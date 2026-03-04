import { Badge } from '@/components/ui'

type Result = {
  pilot: string | null
  placement: number
  record: string | null
  event_name: string
  date: string
  tier: string | null
  source_url: string | null
}

function placementColor(placement: number): string {
  if (placement === 1) return 'text-gold'
  if (placement <= 4) return 'text-spark'
  return 'text-ash'
}

function placementLabel(placement: number): string {
  if (placement === 1) return '1st'
  if (placement === 2) return '2nd'
  if (placement === 3) return '3rd'
  return `${placement}th`
}

function tierVariant(tier: string | null): 'spark' | 'gold' | 'copper' | 'default' {
  if (!tier) return 'default'
  const t = tier.toLowerCase()
  if (t === 'challenge') return 'spark'
  if (t === 'preliminary') return 'gold'
  if (t === 'rcq') return 'copper'
  return 'default'
}

function EventLink({ result }: { result: Result }) {
  return result.source_url ? (
    <a
      href={result.source_url}
      target="_blank"
      rel="noopener noreferrer"
      className="hover:text-spark transition-colors"
    >
      {result.event_name}
    </a>
  ) : (
    <>{result.event_name}</>
  )
}

export function RecentResults({ results }: { results: Result[] }) {
  if (results.length === 0) {
    return (
      <p className="text-sm text-ash italic py-4 text-center">
        No results recorded yet for this archetype
      </p>
    )
  }

  return (
    <>
      {/* Mobile: stacked cards */}
      <div className="sm:hidden space-y-3">
        {results.map((r, i) => (
          <div key={i} className="border border-edge/50 rounded-lg px-4 py-3 space-y-1.5">
            <div className="flex items-center gap-3">
              <span className={`text-lg font-bold ${placementColor(r.placement)}`}>
                {placementLabel(r.placement)}
              </span>
              <span className="text-sm text-ink truncate flex-1">
                <EventLink result={r} />
              </span>
              <span className="text-xs text-ash shrink-0">{r.date}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-ash">
              {r.tier && <Badge variant={tierVariant(r.tier)}>{r.tier}</Badge>}
              <span>{r.pilot ?? '—'}</span>
              {r.record && <span className="ml-auto">{r.record}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-ash border-b border-edge">
              <th className="text-left py-2 pr-3 font-medium">Place</th>
              <th className="text-left py-2 pr-3 font-medium">Event</th>
              <th className="text-left py-2 pr-3 font-medium">Tier</th>
              <th className="text-left py-2 pr-3 font-medium">Pilot</th>
              <th className="text-left py-2 pr-3 font-medium">Date</th>
              <th className="text-left py-2 font-medium">Record</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r, i) => (
              <tr key={i} className="border-b border-edge/50 last:border-0">
                <td className={`py-2 pr-3 font-medium ${placementColor(r.placement)}`}>
                  {placementLabel(r.placement)}
                </td>
                <td className="py-2 pr-3 text-ink">
                  <EventLink result={r} />
                </td>
                <td className="py-2 pr-3">
                  {r.tier && <Badge variant={tierVariant(r.tier)}>{r.tier}</Badge>}
                </td>
                <td className="py-2 pr-3 text-ash">{r.pilot ?? '—'}</td>
                <td className="py-2 pr-3 text-ash">{r.date}</td>
                <td className="py-2 text-ash">{r.record ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
