import { cn } from './cn'

const base = 'w-full bg-surface border border-edge rounded-xl px-4 py-2.5 text-sm text-ink placeholder-ash focus:outline-none focus:border-spark/50 focus:glow-spark-sm disabled:opacity-50 transition-all resize-none'

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea className={cn(base, className)} {...props} />
  )
}
