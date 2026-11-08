// Fonction serverless Vercel : POST /api/brand-extract  { url }  (réservée aux admins)
import { handleBrandRequest } from '../server/brandExtract.js'

export const config = { maxDuration: 60 }

export default async function handler(req, res) {
  let body = req.body
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body)
    } catch {
      body = null
    }
  }
  const { status, json } = await handleBrandRequest({ method: req.method, authorization: req.headers.authorization, body })
  res.setHeader('Cache-Control', 'no-store')
  res.status(status).json(json)
}
