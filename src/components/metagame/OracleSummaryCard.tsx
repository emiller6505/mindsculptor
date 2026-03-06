import Link from 'next/link'
import { Card, buttonVariants, cn } from '@/components/ui'

const FORMAT_LABELS: Record<string, string> = {
  modern: 'Modern',
  standard: 'Standard',
}

export function OracleSummaryCard({ format }: { format: string }) {
  const label = FORMAT_LABELS[format] ?? format
  const query = encodeURIComponent(`What's dominating ${label} right now?`)

  return (
    <Card className="bg-surface/40 p-8 text-center space-y-3">
      <div className="text-2xl">⚡</div>
      <h2 className="text-base font-medium text-ink font-display">
        Ask the Firemind about {label}
      </h2>
      <Link
        href={`/chat`}
        className={cn(buttonVariants(), 'inline-block')}
      >
        Ask the Oracle →
      </Link>
    </Card>
  )
}
