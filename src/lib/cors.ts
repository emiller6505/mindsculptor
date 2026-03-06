const ALLOWED_ORIGINS = new Set([
  process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  'https://firemind.gg',
  'https://www.firemind.gg',
])

export function isAllowedOrigin(req: Request): boolean {
  const origin = req.headers.get('origin')
  if (!origin) return true
  return ALLOWED_ORIGINS.has(origin)
}

export function corsHeaders(origin: string | null): Record<string, string> {
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return {}
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}
