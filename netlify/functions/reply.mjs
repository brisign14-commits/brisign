// Fonction Netlify : POST /api/reply  { messageId, text }  (réservée aux admins) — même logique que api/reply.js (Vercel)
import { handleReplyRequest } from '../../server/reply.js'
import { jsonFunction } from '../shared/adapter.mjs'

export default jsonFunction(handleReplyRequest)
