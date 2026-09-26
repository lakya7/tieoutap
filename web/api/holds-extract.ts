/** Deployed serverless entry point for AI reading of PDF/image on-hold reports. */
import { handleHoldsExtract } from '../server/holdsExtract.js'
import { vercelHandler } from '../server/vercel.js'

export default vercelHandler(handleHoldsExtract)
