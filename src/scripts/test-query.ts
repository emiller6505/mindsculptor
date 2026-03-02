import 'dotenv/config'
import { handleQuery } from '../query/index.js'

const query = process.argv[2] ?? "What are the best decks in Modern right now?"

console.log(`\nQuery: ${query}\n${'─'.repeat(60)}`)

const result = await handleQuery(query)

console.log(`\nIntent: ${JSON.stringify(result.intent, null, 2)}`)
console.log(`\nData: ${result.data.tournaments_count} tournament(s), ${result.data.top_decks.length} deck(s) analyzed (last ${result.data.window_days}d)`)
console.log(`\n${'─'.repeat(60)}\n${result.answer}\n${'─'.repeat(60)}`)
