import { cn } from './cn'

const variants = {
  default: 'bg-edge/10 text-ash border-edge/20',
  spark:   'bg-spark/10 text-spark border-spark/20',
  flame:   'bg-flame/10 text-flame border-flame/20',
  gold:    'bg-gold/10 text-gold border-gold/20',
  copper:  'bg-copper/10 text-copper border-copper/20',
} as const

type Variant = keyof typeof variants

export function Badge({
  variant = 'default',
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: Variant }) {
  return (
    <span
      className={cn(
        'inline-flex items-center text-xs px-2 py-0.5 rounded-md border',
        variants[variant],
        className,
      )}
      {...props}
    />
  )
}
