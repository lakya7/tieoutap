/** Deployed serverless entry point for AI column mapping. */
import { handleMap } from '../server/map.js'
import { vercelHandler } from '../server/vercel.js'

export default vercelHandler(handleMap)
