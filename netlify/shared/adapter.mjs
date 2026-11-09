/**
 * Adaptateur Netlify Functions (format Request / Response) → logique serveur partagée (dossier server/).
 * Les mêmes fonctions tournent sur Vercel (dossier api/) et en local (vite.config.js).
 */

/** Adresse publique du site (https://…) telle que vue par le visiteur. */
export function originOf(req) {
  const url = new URL(req.url)
  const host = req.headers.get('x-forwarded-host') || url.host
  return `https://${host}`
}

/**
 * Transforme un gestionnaire `({ method, body, ip, origin, authorization }) => { status, json }`
 * en fonction Netlify qui répond en JSON.
 */
export function jsonFunction(handler) {
  return async (req, context) => {
    let body = null
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const raw = await req.text()
      try {
        body = raw ? JSON.parse(raw) : null
      } catch {
        body = null // corps invalide : le gestionnaire renverra son erreur habituelle
      }
    }
    const ip = String(context?.ip || req.headers.get('x-nf-client-connection-ip') || req.headers.get('x-forwarded-for') || '')
      .split(',')[0]
      .trim()
    try {
      const { status, json } = await handler({
        method: req.method,
        body,
        ip,
        origin: originOf(req),
        authorization: req.headers.get('authorization') || undefined,
      })
      return Response.json(json, { status, headers: { 'Cache-Control': 'no-store' } })
    } catch (err) {
      console.error('[fonction]', err)
      return Response.json({ error: 'Une erreur est survenue. Réessaie dans un instant.' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
    }
  }
}
