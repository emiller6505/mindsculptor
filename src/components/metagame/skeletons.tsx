import { Skeleton } from '@/components/ui'

export function MetaShareBarSkeleton() {
  const widths = [85, 72, 68, 55, 50, 42, 35, 28]
  return (
    <div className="space-y-2.5 py-4">
      {widths.map((w, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-4 w-28 shrink-0" />
          <Skeleton className="h-6 rounded" style={{ width: `${w}%` }} />
        </div>
      ))}
    </div>
  )
}

export function TopMoversSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-6 py-4">
      {[0, 1].map(col => (
        <div key={col} className="space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-3/5" />
        </div>
      ))}
    </div>
  )
}

export function TrendLinesSkeleton() {
  return (
    <div className="py-4">
      <Skeleton className="h-[300px] w-full rounded-lg" />
    </div>
  )
}
