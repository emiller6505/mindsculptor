import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import Nav from '@/components/Nav'
import './globals.css'

export const metadata: Metadata = {
  title: 'Firemind — MTG Metagame Oracle',
  description: 'Know what\'s winning before you register. MTG metagame oracle powered by real tournament data.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="bg-canvas text-ink antialiased min-h-screen font-sans">
        <Nav />
        {children}
      </body>
    </html>
  )
}
