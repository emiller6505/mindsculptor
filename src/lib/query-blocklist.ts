const BLOCKED_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /(system|original)\s+prompt/i,
  /developer\s+mode/i,
  /<\|endoftext\|>/i,
  /\[INST\]/i,
  /<\/s>/i,
  /reveal\s.*?(password|connection\s*string|api\s*key|secret)/i,
]

export function checkBlocklist(query: string): { blocked: boolean; pattern: string } {
  for (const re of BLOCKED_PATTERNS) {
    if (re.test(query)) {
      return { blocked: true, pattern: re.source }
    }
  }
  return { blocked: false, pattern: '' }
}
