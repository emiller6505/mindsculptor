'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase-browser'
import AuthModal from './AuthModal'

export default function Nav() {
  const path = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [showAuth, setShowAuth] = useState(false)

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

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    setUser(null)
  }

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
            <NavLink href="/chat" active={path.startsWith('/chat')}>Oracle</NavLink>
            <NavLink href="/data" active={path.startsWith('/data')}>Metagame</NavLink>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {user ? (
              <>
                <span className="text-sm text-ash truncate max-w-[200px]">
                  {user.email}
                </span>
                <button
                  onClick={signOut}
                  className="text-sm text-ash hover:text-ink transition-colors px-3 py-1.5"
                >
                  Sign out
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowAuth(true)}
                className="text-sm text-ash hover:text-ink transition-colors px-3 py-1.5"
              >
                Sign in
              </button>
            )}
            <button className="text-sm font-medium px-3 py-1.5 rounded-md border border-spark/20 bg-spark/10 text-spark hover:bg-spark/20 transition-colors">
              Go Spike ↑
            </button>
          </div>

        </div>
      </nav>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
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
