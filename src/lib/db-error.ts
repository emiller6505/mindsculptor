export class DbError extends Error {
  constructor(
    public readonly code: string,
    originalMessage: string,
  ) {
    console.error(`[db-error] ${code}:`, originalMessage)
    super(code)
    this.name = 'DbError'
  }
}
