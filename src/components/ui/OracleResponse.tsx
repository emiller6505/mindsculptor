import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from './cn'

export function OracleResponse({
  content,
  className,
}: {
  content: string
  className?: string
}) {
  return (
    <div className={cn('oracle-border pl-4', className)}>
      <span className="text-xs font-medium text-copper tracking-wide uppercase">
        Firemind
      </span>
      <div className="prose-oracle font-body mt-2">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>
    </div>
  )
}
