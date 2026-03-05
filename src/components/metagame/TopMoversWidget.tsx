import Link from 'next/link'
import type { MoverEntry } from '@/app/data/[format]/queries'

function MoverRow({ entry, format, positive }: { entry: MoverEntry; format: string; positive: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <Link
        href={`/data/${format}/${entry.archetype_id}`}
        className="text-sm text-ink hover:text-spark truncate mr-3"
      >
        {entry.archetype_name}
      </Link>
      <span className={`text-sm font-medium tabular-nums ${positive ? 'text-spark text-glow' : 'text-flame'}`}>
        {positive ? '+' : ''}{entry.trend_delta.toFixed(1)}%
      </span>
    </div>
  )
}

export function TopMoversWidget({
  gainers,
  losers,
  format,
}: {
  gainers: MoverEntry[]
  losers: MoverEntry[]
  format: string
}) {
  if (gainers.length === 0 && losers.length === 0) {
    return (
      <div className="text-sm text-ash py-6 text-center">
        Trend data appears after multiple events — check back soon
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-6">
      <div>
        <h3 className="text-xs font-medium text-ash uppercase tracking-wide mb-2 font-display">Gainers</h3>
        {gainers.length === 0 ? (
          <p className="text-xs text-ash">None this window</p>
        ) : (
          gainers.map(g => <MoverRow key={g.archetype_id} entry={g} format={format} positive />)
        )}
      </div>
      <div>
        <h3 className="text-xs font-medium text-ash uppercase tracking-wide mb-2 font-display">Losers</h3>
        {losers.length === 0 ? (
          <p className="text-xs text-ash">None this window</p>
        ) : (
          losers.map(l => <MoverRow key={l.archetype_id} entry={l} format={format} positive={false} />)
        )}
      </div>
    </div>
  )
}
