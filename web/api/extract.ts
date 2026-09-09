/** Deployed serverless entry point for PDF/image statement extraction. */
import { handleExtract } from '../server/extract.js'
import { vercelHandler } from '../server/vercel.js'

export default vercelHandler(handleExtract)
