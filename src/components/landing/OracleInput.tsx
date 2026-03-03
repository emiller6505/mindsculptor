'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Input } from '@/components/ui'

const SUGGESTED_PROMPTS = [
  "Top 3 decks in Modern?",
  "Best deck for RCQs?",
  "Mono-green decklist for Standard?",
  "Sideboard plan against Tron?"
]

export default function OracleInput() {
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
    <>
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
    </>
  )
}
