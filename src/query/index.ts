import { llm } from '../lib/llm'
import { extractIntent } from './intent'
import { retrieveContext } from './retrieval'
import { assembleContext, RESPONSE_SYSTEM } from './assemble'
import type { Intent } from './intent'
import type { RetrievedData } from './retrieval'

export interface QueryResponse {
  answer: string
  intent: Intent
  data: RetrievedData
}

export async function handleQuery(userQuery: string): Promise<QueryResponse> {
  const intent = await extractIntent(userQuery)
  const data = await retrieveContext(intent)
  const context = assembleContext(intent, data)

  const user = `Retrieved data:\n${context}\n\nUser question: ${userQuery}`
  const answer = await llm.complete(RESPONSE_SYSTEM, user, { maxTokens: 2048 })

  return { answer, intent, data }
}
