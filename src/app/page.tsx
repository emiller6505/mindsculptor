'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button, buttonVariants, Input } from '@/components/ui'

const SUGGESTED_PROMPTS = [
  "What's dominating Modern?",
  "Best deck for RCQs?",
  "Is Amulet Titan tier 1?",
  "Standard after the ban?",
]

// Placeholder meta bars — will be wired to live data when /data is built
const MODERN_META = [
  { name: 'Murktide Regent',  share: 18.4, trend: '↑' },
  { name: 'Amulet Titan',     share: 13.1, trend: '→' },
  { name: 'Boros Energy',     share:  9.7, trend: '↑↑' },
  { name: 'Living End',       share:  8.2, trend: '↓' },
]

const STANDARD_META = [
  { name: 'Domain Ramp',      share: 21.0, trend: '↑↑' },
  { name: 'Azorius Soldiers', share: 15.3, trend: '↑' },
  { name: 'Esper Midrange',   share: 11.8, trend: '→' },
  { name: 'Mono-Red Aggro',   share:  9.4, trend: '↓' },
]

function MetaBar({ name, share, trend }: { name: string; share: number; trend: string }) {
  const trendColor = trend.includes('↑') ? 'text-spark' : trend === '↓' ? 'text-flame' : 'text-ash'
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="w-full max-w-[120px] bg-edge rounded-full h-1.5 shrink-0">
        <div
          className="bg-spark/60 h-1.5 rounded-full"
          style={{ width: `${(share / 25) * 100}%` }}
        />
      </div>
      <span className="text-sm text-ink/80 w-40 shrink-0 truncate">{name}</span>
      <span className="text-xs text-ash tabular-nums w-10 shrink-0">{share}%</span>
      <span className={`text-xs font-medium ${trendColor}`}>{trend}</span>
    </div>
  )
}

export default function LandingPage() {
  const [input, setInput] = useState('')
  const router = useRouter()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const q = input.trim()
    if (!q) return
    router.push(`/chat?q=${encodeURIComponent(q)}`)
  }

  function handlePrompt(prompt: string) {
    router.push(`/chat?q=${encodeURIComponent(prompt)}`)
  }

  return (
    <main className="max-w-4xl mx-auto px-6 py-16 space-y-16">

      {/* Hero */}
      <div className="space-y-8">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight text-ink">
            Know what&apos;s winning.<br />
            <span className="text-ink/70 font-normal">Before you register.</span>
          </h1>
        </div>

        {/* Oracle input */}
        <form onSubmit={handleSubmit} className="flex gap-3">
          <Input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask about the metagame…"
            className="flex-1"
          />
          <Button type="submit" disabled={!input.trim()} className="shrink-0">
            Ask →
          </Button>
        </form>

        {/* Suggested prompts */}
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_PROMPTS.map(prompt => (
            <Button
              key={prompt}
              variant="secondary"
              size="sm"
              onClick={() => handlePrompt(prompt)}
            >
              {prompt}
            </Button>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-edge" />

      {/* Live meta snapshot — placeholder until /data is wired */}
      <div className="bg-surface border border-edge rounded-xl p-8 grid grid-cols-1 md:grid-cols-2 gap-10">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-ash uppercase tracking-widest">Modern</h2>
            <Link href="/data/modern" className="text-xs text-spark hover:text-spark/80 transition-colors">
              Full breakdown →
            </Link>
          </div>
          {MODERN_META.map(d => <MetaBar key={d.name} {...d} />)}
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-ash uppercase tracking-widest">Standard</h2>
            <Link href="/data/standard" className="text-xs text-spark hover:text-spark/80 transition-colors">
              Full breakdown →
            </Link>
          </div>
          {STANDARD_META.map(d => <MetaBar key={d.name} {...d} />)}
        </div>
      </div>

      {/* CTAs */}
      <div className="flex items-center gap-4">
        <Link href="/chat" className={buttonVariants()}>
          Ask the Firemind — it&apos;s free
        </Link>
        <Link href="/data" className={buttonVariants({ variant: 'secondary' })}>
          See metagame charts →
        </Link>
      </div>

    </main>
  )
}
