'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Nav() {
  const path = usePathname()

  return (
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
          <button className="text-sm text-ash hover:text-ink transition-colors px-3 py-1.5">
            Sign in
          </button>
          <button className="text-sm font-medium px-3 py-1.5 rounded-md border border-spark/20 bg-spark/10 text-spark hover:bg-spark/20 transition-colors">
            Go Spike ↑
          </button>
        </div>

      </div>
    </nav>
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
