/** Deployed serverless entry point for AI findings summaries. */
import { handleSummarize } from '../server/summarize.js'
import { vercelHandler } from '../server/vercel.js'

export default vercelHandler(handleSummarize)
