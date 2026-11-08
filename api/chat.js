// Fonction serverless Vercel : POST /api/chat  { messages: [{ role, content }] }
import { handleChatRequest } from '../server/chatbot.js'

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
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim()
  const { status, json } = await handleChatRequest({ method: req.method, body, ip })
  res.setHeader('Cache-Control', 'no-store')
  res.status(status).json(json)
}
