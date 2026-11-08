// Fonction serverless Vercel : POST /api/reply  { messageId, text }  (réservée aux admins)
import { handleReplyRequest } from '../server/reply.js'

export const config = { maxDuration: 30 }

export default async function handler(req, res) {
  let body = req.body
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body)
    } catch {
      body = null
    }
  }
  const origin = `https://${req.headers['x-forwarded-host'] || req.headers.host}`
  const { status, json } = await handleReplyRequest({ method: req.method, authorization: req.headers.authorization, body, origin })
  res.setHeader('Cache-Control', 'no-store')
  res.status(status).json(json)
}
