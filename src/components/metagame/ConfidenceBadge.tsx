const CONFIDENCE_COLORS: Record<string, string> = {
  'VERY HIGH': 'text-spark',
  'HIGH': 'text-spark',
  'MEDIUM': 'text-gold',
  'LOW': 'text-flame',
}

export function ConfidenceBadge({
  confidence,
  sampleSize,
}: {
  confidence: string
  sampleSize: number
}) {
  const color = CONFIDENCE_COLORS[confidence] ?? 'text-ash'

  return (
    <span
      className="text-xs text-ash"
      title="Confidence reflects sample size and recency of tournament data"
    >
      Based on {sampleSize} decks · <span className={color}>{confidence}</span>
    </span>
  )
}
