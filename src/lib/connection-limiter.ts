const MAX_CONCURRENT = 3

const connections = new Map<string, number>()

export function acquireConnection(ip: string): boolean {
  const current = connections.get(ip) ?? 0
  if (current >= MAX_CONCURRENT) return false
  connections.set(ip, current + 1)
  return true
}

export function releaseConnection(ip: string): void {
  const current = connections.get(ip) ?? 0
  if (current <= 1) {
    connections.delete(ip)
  } else {
    connections.set(ip, current - 1)
  }
}

export function _resetForTest(): void {
  connections.clear()
}
