import type { NextRequest } from 'next/server'

export function getClientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for')
  if (!xff) return req.headers.get('x-real-ip') ?? 'unknown'
  const ips = xff.split(',').map(s => s.trim())
  // Rightmost IP is added by Render's proxy — not client-controlled
  return ips[ips.length - 1] ?? 'unknown'
}
