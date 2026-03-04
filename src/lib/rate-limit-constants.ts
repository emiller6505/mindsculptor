export const ANON_LIMIT = 5
export const USER_LIMIT = 10
export const ANON_STORAGE_KEY = 'fm_anon_queries'
export const CHAT_STORAGE_KEY = 'fm_chat_messages'

export function getTodayUTC(): string {
  return new Date().toISOString().slice(0, 10)
}

export function getResetsAt(): string {
  const now = new Date()
  const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
  return tomorrow.toISOString()
}
