// Fonction Netlify : GET /projets/:slug → index.html + aperçu de partage du projet (même logique que api/page.js)
import { renderProjectPage } from '../../server/ogPage.js'
import { originOf } from '../shared/adapter.mjs'

export default async (req) => {
  const origin = originOf(req)
  const url = new URL(req.url)
  // Slug : paramètre de la règle de réécriture, sinon dernier segment de l'adresse
  const slug = (url.searchParams.get('slug') || decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() || '')).slice(0, 120)

  let html
  try {
    // index.html est un fichier statique : servi directement, sans repasser par cette fonction
    html = await (await fetch(`${origin}/index.html`)).text()
  } catch {
    return Response.redirect(`${origin}/`, 302)
  }
  const out = slug && slug !== 'page' ? await renderProjectPage({ html, slug, origin }) : { html }
  return new Response(out.html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
      // Cache court sur le CDN Netlify : un projet modifié dans l'admin est à jour en quelques minutes
      'Netlify-CDN-Cache-Control': 'public, s-maxage=300, stale-while-revalidate=86400',
    },
  })
}
