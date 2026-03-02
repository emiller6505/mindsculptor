import 'dotenv/config'
import { parsePendingMtgoJobs } from '../parsers/mtgo.js'
parsePendingMtgoJobs().catch(err => { console.error(err); process.exit(1) })
