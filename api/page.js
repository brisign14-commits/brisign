// Fonction serverless Vercel : GET /projets/:slug (via vercel.json) → index.html + aperçu de partage du projet
import { renderProjectPage } from '../server/ogPage.js'

export const config = { maxDuration: 10 }

export default async function handler(req, res) {
  const host = req.headers['x-forwarded-host'] || req.headers.host
  const proto = req.headers['x-forwarded-proto'] || 'https'
  const origin = `${proto}://${host}`
  const slug = String(req.query?.slug || '').slice(0, 120)

  let html
  try {
    // index.html est un fichier statique : il est servi directement, sans repasser par cette fonction
    const r = await fetch(`${origin}/index.html`)
    html = await r.text()
  } catch {
    res.setHeader('Location', '/')
    return res.status(302).end()
  }

  const out = slug ? await renderProjectPage({ html, slug, origin }) : { html }
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  // Cache court côté CDN : un projet modifié dans l'admin est à jour en quelques minutes
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400')
  res.status(200).send(out.html)
}
