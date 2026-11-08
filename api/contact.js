// Fonction serverless Vercel : POST /api/contact  { name, email, subject, message }
import { handleContactRequest } from '../server/contact.js'

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
  const origin = `https://${req.headers['x-forwarded-host'] || req.headers.host}`
  const { status, json } = await handleContactRequest({ method: req.method, body, ip, origin })
  res.setHeader('Cache-Control', 'no-store')
  res.status(status).json(json)
}
