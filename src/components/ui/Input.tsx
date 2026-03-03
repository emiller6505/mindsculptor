import { cn } from './cn'

const base = 'w-full bg-surface border border-edge rounded-xl px-4 py-2.5 text-sm text-ink placeholder-ash focus:outline-none focus:border-spark/50 focus:glow-spark-sm disabled:opacity-50 transition-all'

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input className={cn(base, className)} {...props} />
  )
}
