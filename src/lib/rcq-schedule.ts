/**
 * RCQ season schedule — update when Wizards announces new rounds.
 * Source: magic.gg/news
 *
 * Each window is [start, end) — end is exclusive (first day of the gap/next season).
 * Gaps between seasons have no RCQs running; treat as unknown.
 */

export type RcqFormat = 'modern' | 'standard' | 'pioneer'

interface RcqWindow {
  start: string    // YYYY-MM-DD inclusive
  end:   string    // YYYY-MM-DD exclusive
  format: RcqFormat
  label: string    // human-readable season name
}

const RCQ_SCHEDULE: RcqWindow[] = [
  // 2025-26 Round 3: Standard — Nov 29 2025 through Mar 22 2026
  {
    start:  '2025-11-29',
    end:    '2026-03-23',
    format: 'standard',
    label:  '2025-26 Round 3 (feeds Pro Tour Secrets of Strixhaven, May 2026)',
  },
  // 2026-27 Round 1: Modern — Apr 4 2026 through Aug 2 2026
  {
    start:  '2026-04-04',
    end:    '2026-08-03',
    format: 'modern',
    label:  '2026-27 Round 1 (feeds Fall 2026 Regional Championships)',
  },
]

export interface RcqContext {
  format: RcqFormat
  label: string
  endsOn: string   // YYYY-MM-DD (last day, inclusive)
}

/**
 * Returns the active RCQ format for the given date, or null if between seasons.
 */
export function currentRcqContext(date: Date = new Date()): RcqContext | null {
  const today = date.toISOString().split('T')[0]

  for (const window of RCQ_SCHEDULE) {
    if (today >= window.start && today < window.end) {
      // end is exclusive, so last day = day before end
      const lastDay = new Date(new Date(window.end).getTime() - 86_400_000)
        .toISOString().split('T')[0]
      return { format: window.format, label: window.label, endsOn: lastDay }
    }
  }

  return null  // between seasons or schedule not yet defined
}

/**
 * A short sentence suitable for injection into LLM prompts.
 */
export function rcqPromptNote(date: Date = new Date()): string {
  const ctx = currentRcqContext(date)
  if (!ctx) return 'The current RCQ season dates are unknown — do not assume a format for RCQ questions.'
  return `Current RCQ season format: ${ctx.format.toUpperCase()} (${ctx.label}; season runs through ${ctx.endsOn}). When a user asks about RCQs without specifying a format, use ${ctx.format}.`
}
