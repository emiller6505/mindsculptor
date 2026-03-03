import { cn } from './cn'

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('bg-surface border border-edge rounded-xl', className)} {...props} />
  )
}
