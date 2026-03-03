import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cn, buttonVariants, Card } from '@/components/ui'

const FORMATS = ['modern', 'standard'] as const
type Format = typeof FORMATS[number]

const FORMAT_LABELS: Record<Format, string> = {
  modern:   'Modern',
  standard: 'Standard',
}

export function generateStaticParams() {
  return FORMATS.map(format => ({ format }))
}

export default async function FormatPage({ params }: { params: Promise<{ format: string }> }) {
  const { format } = await params
  if (!FORMATS.includes(format as Format)) notFound()

  const label = FORMAT_LABELS[format as Format]
  const other = format === 'modern' ? 'standard' : 'modern'
  const otherLabel = FORMAT_LABELS[other]

  return (
    <main className="max-w-4xl mx-auto px-6 py-12 space-y-10">

      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {label} Metagame
          </h1>
          <Link
            href={`/data/${other}`}
            className={buttonVariants({ variant: 'secondary', size: 'sm' })}
          >
            Switch to {otherLabel}
          </Link>
        </div>
        <p className="text-sm text-ash">
          Meta share, trends, and archetype breakdowns — updated every 12 hours from live tournament results.
        </p>
      </div>

      {/* Coming soon */}
      <Card className="bg-surface/40 p-12 text-center space-y-4">
        <div className="text-4xl text-spark/40">◈</div>
        <h2 className="text-lg font-medium text-ink">Charts coming soon</h2>
        <p className="text-sm text-ash max-w-sm mx-auto">
          Meta share bars, trend lines, and archetype detail pages are in progress.
          In the meantime, ask the oracle directly.
        </p>
        <Link
          href="/chat"
          className={cn(buttonVariants(), 'inline-block mt-2')}
        >
          Ask the Firemind →
        </Link>
      </Card>

    </main>
  )
}
