import { cn } from './cn'

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('bg-edge animate-pulse rounded-md', className)}
      {...props}
    />
  )
}
