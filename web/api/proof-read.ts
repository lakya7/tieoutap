/** Deployed serverless entry point for AI proof-document transcription. */
import { handleProofRead } from '../server/proofRead.js'
import { vercelHandler } from '../server/vercel.js'

export default vercelHandler(handleProofRead)
