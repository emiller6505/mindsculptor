'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase-browser'
import { Button, Drawer } from '@/components/ui'
import AuthModal from './AuthModal'

export default function Nav() {
  const path = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [showAuth, setShowAuth] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [alertsOpen, setAlertsOpen] = useState(false)
  const [avatarOpen, setAvatarOpen] = useState(false)
  const avatarRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getUser().then(({ data }) => setUser(data.user))

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null)
        if (session?.user) setShowAuth(false)
      },
    )

    return () => subscription.unsubscribe()
  }, [])

  const closeAvatar = useCallback(() => setAvatarOpen(false), [])

  useEffect(() => {
    if (!avatarOpen) return

    function handleClick(e: MouseEvent) {
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) {
        closeAvatar()
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeAvatar()
    }

    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [avatarOpen, closeAvatar])

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    setUser(null)
    setAvatarOpen(false)
  }

  const initials = user?.email?.[0]?.toUpperCase() ?? '?'

  return (
    <>
      <nav className="sticky top-0 z-50 border-b border-edge bg-canvas/90 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 h-12 flex items-center gap-6">

          <Link href="/" className="flex items-center gap-1.5 shrink-0 group">
            <span className="text-spark text-base leading-none">⚡</span>
            <span className="font-semibold tracking-tight text-ink group-hover:text-spark transition-colors">
              Firemind
            </span>
          </Link>

          <div className="flex items-center gap-1">
            <NavLink href="/chat" active={path.startsWith('/chat')}>Chat</NavLink>
            <NavLink href="/data" active={path.startsWith('/data')}>Metagame Data</NavLink>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {user ? (
              <>
                <IconButton
                  label="History"
                  onClick={() => setHistoryOpen(true)}
                >
                  🕐
                </IconButton>
                <IconButton
                  label="Alerts"
                  onClick={() => setAlertsOpen(true)}
                >
                  🔔
                </IconButton>
                <div ref={avatarRef} className="relative">
                  <button
                    onClick={() => setAvatarOpen(o => !o)}
                    className="w-8 h-8 rounded-full bg-edge text-ink text-sm font-medium flex items-center justify-center hover:bg-ash/20 transition-colors"
                    aria-label="Account menu"
                  >
                    {initials}
                  </button>
                  {avatarOpen && (
                    <div className="absolute right-0 top-10 w-56 rounded-md border border-edge bg-surface shadow-lg py-1 z-50">
                      <div className="px-3 py-2 text-xs text-ash truncate">
                        {user.email}
                      </div>
                      <div className="border-t border-edge" />
                      <button
                        onClick={signOut}
                        className="w-full text-left px-3 py-2 text-sm text-ink hover:bg-edge transition-colors"
                      >
                        Sign out
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setShowAuth(true)}>
                Sign in
              </Button>
            )}
            <button className="text-sm font-medium px-3 py-1.5 rounded-md border border-spark/20 bg-spark/10 text-spark hover:bg-spark/20 transition-colors">
              Go Spike ↑
            </button>
          </div>

        </div>
      </nav>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}

      <Drawer open={historyOpen} onClose={() => setHistoryOpen(false)} title="History">
        <p className="text-sm text-ash">Coming in toy.8</p>
      </Drawer>

      <Drawer open={alertsOpen} onClose={() => setAlertsOpen(false)} title="Alerts">
        <p className="text-sm text-ash">Coming soon</p>
      </Drawer>
    </>
  )
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string
  active: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className={`text-sm px-3 py-1.5 rounded-md transition-colors ${
        active
          ? 'text-ink bg-edge'
          : 'text-ash hover:text-ink hover:bg-surface'
      }`}
    >
      {children}
    </Link>
  )
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="w-8 h-8 flex items-center justify-center rounded-md text-ash hover:text-ink hover:bg-surface transition-colors"
    >
      {children}
    </button>
  )
}
