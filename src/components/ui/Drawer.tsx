'use client'

import { useEffect, useCallback } from 'react'
import { cn } from './cn'

export function Drawer({
  open,
  onClose,
  title,
  className,
  children,
}: {
  open: boolean
  onClose: () => void
  title?: string
  className?: string
  children: React.ReactNode
}) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose],
  )

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, handleKeyDown])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={cn(
          'absolute right-0 top-0 h-full w-full max-w-md bg-surface border-l border-edge shadow-xl',
          'animate-in slide-in-from-right duration-200',
          className,
        )}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-edge px-6 py-4">
            <h2 className="text-sm font-medium text-ink font-display">{title}</h2>
            <button
              onClick={onClose}
              className="text-ash hover:text-ink transition-colors"
            >
              ✕
            </button>
          </div>
        )}
        <div className="overflow-y-auto h-full p-6">{children}</div>
      </div>
    </div>
  )
}
