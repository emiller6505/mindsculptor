import { cn } from './cn'

const base = 'inline-flex items-center justify-center font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed'

const variants = {
  primary:   'bg-spark hover:bg-spark/90 text-canvas',
  secondary: 'border border-edge text-ash hover:text-ink hover:border-spark/30',
  ghost:     'text-ash hover:text-ink',
} as const

const sizes = {
  sm: 'text-sm px-3 py-1.5 rounded-lg',
  md: 'text-sm px-5 py-2.5 rounded-xl',
} as const

type Variant = keyof typeof variants
type Size = keyof typeof sizes

export function buttonVariants({
  variant = 'primary',
  size = 'md',
}: { variant?: Variant; size?: Size } = {}) {
  return cn(base, variants[variant], sizes[size])
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
}) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
}
