import { handlePortal } from '../server/billing.js'
import { vercelHandler } from '../server/vercel.js'

export default vercelHandler(handlePortal)
