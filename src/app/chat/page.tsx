'use client'

import { useState, useRef, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'
import type { User } from '@supabase/supabase-js'
import { Button, Input, Card } from '@/components/ui'
import { createClient } from '@/lib/supabase-browser'

const SUGGESTED_PROMPTS = [
  "What's dominating Modern right now?",
  "What should I play at my RCQ this weekend?",
  "Is Murktide still the deck to beat?",
  "Build me a sideboard plan vs Amulet Titan",
]

const ANON_LIMIT = 5
const USER_LIMIT = 10
const ANON_STORAGE_KEY = 'fm_anon_queries'
const CHAT_STORAGE_KEY = 'fm_chat_messages'

function getTodayUTC(): string {
  return new Date().toISOString().slice(0, 10)
}

// --- useCountdown hook ---
function useCountdown(resetsAt: string | null): string | null {
  const [display, setDisplay] = useState<string | null>(null)

  useEffect(() => {
    if (!resetsAt) { setDisplay(null); return }

    function tick() {
      const diff = new Date(resetsAt!).getTime() - Date.now()
      if (diff <= 0) { setDisplay('00:00:00'); return }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setDisplay(
        `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
      )
    }

    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [resetsAt])

  return display
}

// --- Anon localStorage helpers ---
function getAnonCount(): number {
  try {
    const raw = localStorage.getItem(ANON_STORAGE_KEY)
    if (!raw) return 0
    const parsed = JSON.parse(raw) as { count: number; date: string }
    if (parsed.date !== getTodayUTC()) return 0
    return parsed.count
  } catch { return 0 }
}

function setAnonCount(count: number) {
  localStorage.setItem(ANON_STORAGE_KEY, JSON.stringify({ count, date: getTodayUTC() }))
}

// --- Google SVG (shared with AuthModal) ---
function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  )
}

function CodeBlock({ children }: { children: string }) {
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const copy = useCallback(() => {
    navigator.clipboard.writeText(children).then(() => {
      setCopied(true)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setCopied(false), 2000)
    })
  }, [children])

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  return (
    <div className="relative group my-3">
      <pre className="bg-canvas border border-edge rounded-lg px-4 py-3 text-sm text-ink/80 font-mono overflow-x-auto whitespace-pre">
        {children}
      </pre>
      <button
        onClick={copy}
        className="absolute top-2 right-2 text-xs text-ash hover:text-ink bg-surface border border-edge rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}

const mdComponents: Components = {
  code({ className, children, ...props }) {
    if (String(children).trim().includes('\n')) {
      return <CodeBlock>{String(children).replace(/\n$/, '')}</CodeBlock>
    }
    return (
      <code className="text-spark bg-surface px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
        {children}
      </code>
    )
  },
}

type Confidence = 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY HIGH'

const CONFIDENCE_COLORS: Record<Confidence, string> = {
  'VERY HIGH': 'text-spark',
  'HIGH':      'text-spark',
  'MEDIUM':    'text-gold',
  'LOW':       'text-flame',
}

interface Message {
  role: 'user' | 'oracle'
  content: string
  meta?: {
    format: string | null
    window_days: number
    decks_analyzed: number
    confidence?: Confidence
    remaining?: number | null
  }
}

const THINKING_QUIPS = [
  'The Firemind is considering',
  'The Firemind is brainstorming',
  'The Firemind is preordaining',
  'The Firemind is pondering',
  'The Firemind is surveilling',
  'The Firemind is scrying',
  'The Firemind is consulting the serum visions',
  'The Firemind is peering through the aether',
  'The Firemind is opting',
]

function OracleThinking() {
  const [quipIdx, setQuipIdx] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setQuipIdx(i => (i + 1) % THINKING_QUIPS.length), 2500)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-spark text-xs">⚡</span>
        <span className="text-xs font-medium text-copper tracking-wide uppercase">Firemind</span>
      </div>
      <div className="oracle-border pl-4 py-3 flex items-center gap-2">
        <span className="text-sm text-ash italic">{THINKING_QUIPS[quipIdx]}</span>
        <span className="flex gap-1 self-end mb-0.5">
          <span className="w-1.5 h-1.5 bg-spark/60 rounded-full animate-bounce [animation-delay:0ms]" />
          <span className="w-1.5 h-1.5 bg-spark/60 rounded-full animate-bounce [animation-delay:150ms]" />
          <span className="w-1.5 h-1.5 bg-spark/60 rounded-full animate-bounce [animation-delay:300ms]" />
        </span>
      </div>
    </div>
  )
}

function remainingColor(remaining: number): string {
  if (remaining >= 3) return 'text-ash'
  if (remaining === 2) return 'text-gold'
  return 'text-flame'
}

function AuthPromptCard({ resetsAt, messages }: { resetsAt: string | null; messages: Message[] }) {
  const countdown = useCountdown(resetsAt)

  async function handleSignIn() {
    try {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages))
    } catch { /* best effort */ }

    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/auth/callback' },
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-spark text-xs">⚡</span>
        <span className="text-xs font-medium text-copper tracking-wide uppercase">Firemind</span>
      </div>
      <div
        className="pl-4 py-4 pr-4 bg-surface/40 rounded-r-lg border-l-2"
        style={{ borderImage: 'linear-gradient(to bottom, #B87333, #D4552A) 1' }}
      >
        <p className="text-sm text-ink font-medium mb-1">You&apos;ve got good questions.</p>
        <p className="text-sm text-ink/70 mb-4">Create a free account to keep going. No credit card, ever.</p>

        <Button
          variant="secondary"
          onClick={handleSignIn}
          className="w-full gap-3 py-3 bg-surface text-ink hover:bg-edge"
        >
          <GoogleIcon />
          Sign in with Google
        </Button>

        {countdown && (
          <p className="text-xs text-ash text-center mt-3">
            or wait &middot; resets in <span className="font-mono tabular-nums">{countdown}</span>
          </p>
        )}
      </div>
    </div>
  )
}

function ChatPageInner() {
  const searchParams = useSearchParams()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [anonCount, setAnonCountState] = useState(0)
  const [remaining, setRemaining] = useState<number | null>(null)
  const [resetsAt, setResetsAt] = useState<string | null>(null)
  const [showAuthCard, setShowAuthCard] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const didAutoSubmit = useRef(false)
  const authInitialized = useRef(false)

  const countdown = useCountdown(remaining === 0 && user ? resetsAt : null)

  // Auth state
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      setUser(u)
      authInitialized.current = true
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Restore messages after auth redirect
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CHAT_STORAGE_KEY)
      if (saved) {
        setMessages(JSON.parse(saved))
        localStorage.removeItem(CHAT_STORAGE_KEY)
      }
    } catch { /* ignore */ }
  }, [])

  // Init anon count
  useEffect(() => {
    setAnonCountState(getAnonCount())
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading, showAuthCard])

  // Auto-submit query passed from landing page
  useEffect(() => {
    if (didAutoSubmit.current) return
    const q = searchParams.get('q')
    if (q) {
      didAutoSubmit.current = true
      submit(q)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isAnon = !user
  const anonAtLimit = isAnon && anonCount >= ANON_LIMIT
  const userAtLimit = !isAnon && remaining === 0
  const atLimit = anonAtLimit || userAtLimit

  async function submit(query: string) {
    const q = query.trim()
    if (!q || loading || atLimit) return

    // Anon pre-check
    if (isAnon) {
      const current = getAnonCount()
      if (current >= ANON_LIMIT) {
        setAnonCountState(current)
        return
      }
    }

    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: q }])
    setLoading(true)

    const currentMessages = [...messages, { role: 'user' as const, content: q }]
    const history = currentMessages
      .map(m => ({ role: m.role === 'oracle' ? 'assistant' as const : 'user' as const, content: m.content }))
      .slice(-6)

    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, messages: history }),
      })
      const data = await res.json()

      if (res.status === 429) {
        setRemaining(0)
        setResetsAt(data.rate_limit?.resets_at ?? null)
        setMessages(prev => [...prev, {
          role: 'oracle',
          content: "You've reached today's limit. Your queries reset at midnight UTC.",
        }])
        return
      }

      if (!res.ok) throw new Error(data.error ?? 'Unknown error')

      // Update rate limit state from response
      if (data.rate_limit) {
        setResetsAt(data.rate_limit.resets_at)
        if (data.rate_limit.tier === 'user' && data.rate_limit.remaining != null) {
          setRemaining(data.rate_limit.remaining)
        }
      }

      // Anon: increment localStorage
      if (isAnon) {
        const newCount = getAnonCount() + 1
        setAnonCount(newCount)
        setAnonCountState(newCount)
        if (newCount >= ANON_LIMIT) {
          setShowAuthCard(true)
        }
      }

      const queryRemaining = isAnon
        ? ANON_LIMIT - (getAnonCount())
        : data.rate_limit?.remaining ?? null

      setMessages(prev => [...prev, {
        role: 'oracle',
        content: data.answer,
        meta: {
          format: data.intent?.format,
          window_days: data.data?.window_days,
          decks_analyzed: data.data?.top_decks?.length ?? 0,
          confidence: data.data?.confidence,
          remaining: queryRemaining,
        },
      }])
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'oracle',
        content: `Something went wrong. ${err instanceof Error ? err.message : 'Please try again.'}`,
      }])
    } finally {
      setLoading(false)
    }
  }

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault()
    submit(input)
  }

  // Compute counter display
  const limit = isAnon ? ANON_LIMIT : USER_LIMIT
  const used = isAnon ? anonCount : (remaining != null ? limit - remaining : 0)
  const displayRemaining = limit - used

  // Placeholder for disabled input
  let placeholder = 'Ask the Firemind…'
  if (anonAtLimit) placeholder = 'Sign in to keep going…'
  else if (userAtLimit) placeholder = 'Resets at midnight UTC'

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)]">

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">

          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
              <div className="space-y-8 w-full max-w-lg">
                <div className="text-center space-y-2">
                  <p className="text-ink/75 text-sm">Ask about the current metagame, what to play, or how decks and cards perform.</p>
                </div>
                <div
                  className="grid grid-cols-2 gap-3 py-16 -my-16 px-12 -mx-12"
                  style={{ background: 'radial-gradient(ellipse at 50% 50%, rgba(79,142,247,0.10) 0%, transparent 70%)' }}
                >
                  {SUGGESTED_PROMPTS.map(prompt => (
                    <Button
                      key={prompt}
                      variant="secondary"
                      onClick={() => submit(prompt)}
                      className="justify-start text-left text-ink/80 bg-surface hover:bg-edge px-4 py-3.5 hover:glow-spark-sm"
                    >
                      {prompt}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i}>
              {msg.role === 'user' ? (
                <div className="flex justify-end">
                  <Card className="rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[80%] text-sm text-ink">
                    {msg.content}
                  </Card>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Oracle label */}
                  <div className="flex items-center gap-2">
                    <span className="text-spark text-xs">⚡</span>
                    <span className="text-xs font-medium text-copper tracking-wide uppercase">Firemind</span>
                  </div>
                  {/* Response body */}
                  <div className="oracle-border pl-4 bg-surface/40 rounded-r-lg py-3 pr-4">
                    <div className="prose prose-invert prose-sm max-w-none
                      prose-headings:font-semibold prose-headings:text-ink
                      prose-p:text-ink/80 prose-p:leading-relaxed
                      prose-strong:text-ink
                      prose-ul:text-ink/80 prose-ol:text-ink/80
                      prose-li:my-0.5
                      prose-table:text-sm prose-th:text-ink/70 prose-td:text-ink/60
                      prose-code:text-spark prose-code:bg-surface prose-code:px-1 prose-code:rounded">
                      <ReactMarkdown remarkPlugins={[[remarkGfm, { singleTilde: false }]]} components={mdComponents}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                  {/* Meta footer */}
                  {msg.meta && (
                    <p className="text-xs text-ash pl-4">
                      {[
                        msg.meta.format,
                        msg.meta.window_days && `last ${msg.meta.window_days}d`,
                        msg.meta.decks_analyzed && `${msg.meta.decks_analyzed} decks`,
                      ].filter(Boolean).join(' · ')}
                      {msg.meta.confidence && (
                        <span className={`ml-2 font-medium ${CONFIDENCE_COLORS[msg.meta.confidence]}`}>
                          {msg.meta.confidence}
                        </span>
                      )}
                      {msg.meta.remaining != null && (
                        <span className={`ml-2 ${remainingColor(msg.meta.remaining)}`}>
                          {msg.meta.remaining} remaining
                        </span>
                      )}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}

          {loading && <OracleThinking />}

          {showAuthCard && !loading && <AuthPromptCard resetsAt={resetsAt} messages={messages} />}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input bar */}
      <div className="border-t border-edge bg-canvas/80 backdrop-blur-sm flex-shrink-0">
        <div className="max-w-3xl mx-auto px-6 py-4 space-y-2">
          {!atLimit && (
            <p className="text-xs text-ash text-center">
              {displayRemaining} {displayRemaining === 1 ? 'query' : 'queries'} left today
            </p>
          )}
          {userAtLimit && countdown && (
            <p className="text-xs text-ash text-center font-mono tabular-nums">
              Resets in {countdown}
            </p>
          )}
          <form onSubmit={handleFormSubmit} className="flex gap-3">
            <Input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={placeholder}
              disabled={loading || atLimit}
              className="flex-1"
            />
            <Button disabled={loading || !input.trim() || atLimit}>
              Ask
            </Button>
          </form>
        </div>
      </div>

    </div>
  )
}

export default function ChatPage() {
  return (
    <Suspense>
      <ChatPageInner />
    </Suspense>
  )
}
