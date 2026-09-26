/** Deployed serverless entry point for AI reads of hold reports. */
import { handleHoldsRead } from '../server/holdsRead.js'
import { vercelHandler } from '../server/vercel.js'

export default vercelHandler(handleHoldsRead)
