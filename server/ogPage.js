/**
 * Aperçus de partage (Open Graph / Twitter) pour les pages projet.
 *
 * Facebook, LinkedIn, WhatsApp, X, Telegram… ne lisent pas le JavaScript : pour afficher
 * l'image et le titre d'un projet, la page /projets/:slug doit déjà contenir les balises
 * og:title, og:description, og:image… C'est ce que fait cette fonction : elle reprend
 * index.html et y remplace les balises par celles du projet (lu dans Supabase).
 *
 * Utilisé par la fonction Vercel `api/page.js`. En cas de problème, la page d'origine est
 * renvoyée telle quelle : le site ne casse jamais.
 */
const env = (k) => process.env[k] || process.env[`VITE_${k}`]

const esc = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

/** Coupe proprement un texte (aperçus : ~200 caractères). */
const clip = (s = '', max = 200) => {
  const t = String(s).replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  const cut = t.slice(0, max)
  return `${cut.slice(0, cut.lastIndexOf(' ') > 80 ? cut.lastIndexOf(' ') : max).replace(/[,;:.\s]+$/, '')}…`
}

async function rest(path) {
  const url = env('SUPABASE_URL')
  const key = env('SUPABASE_ANON_KEY')
  if (!url || !key) throw new Error('Configuration Supabase manquante.')
  const r = await fetch(`${url}/rest/v1/${path}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } })
  if (!r.ok) throw new Error(`Supabase ${r.status}`)
  return r.json()
}

/** Projet publié (par slug, ou par id pour les anciens liens). */
async function findProject(slug) {
  const select = 'title,slug,description,category,image_url,cover:media!projects_cover_media_id_fkey(url,width,height,alt)'
  const s = encodeURIComponent(slug)
  let rows = await rest(`projects?select=${select}&status=eq.published&slug=eq.${s}&limit=1`)
  if (!rows.length && /^[0-9a-f-]{36}$/i.test(slug)) rows = await rest(`projects?select=${select}&status=eq.published&id=eq.${s}&limit=1`)
  return rows[0] || null
}

/** Balises d'aperçu prêtes à insérer dans <head>. */
export function ogTags({ title, description, url, image, imageWidth, imageHeight, imageAlt, siteName, type = 'website' }) {
  const tags = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}" />`,
    `<link rel="canonical" href="${esc(url)}" />`,
    `<meta property="og:type" content="${type}" />`,
    `<meta property="og:site_name" content="${esc(siteName)}" />`,
    `<meta property="og:locale" content="fr_FR" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(description)}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}" />`,
    `<meta name="twitter:title" content="${esc(title)}" />`,
    `<meta name="twitter:description" content="${esc(description)}" />`,
  ]
  if (image) {
    tags.push(
      `<meta property="og:image" content="${esc(image)}" />`,
      `<meta property="og:image:secure_url" content="${esc(image)}" />`,
      `<meta property="og:image:alt" content="${esc(imageAlt || title)}" />`,
      `<meta name="twitter:image" content="${esc(image)}" />`,
    )
    if (imageWidth && imageHeight) tags.push(`<meta property="og:image:width" content="${imageWidth}" />`, `<meta property="og:image:height" content="${imageHeight}" />`)
  }
  return tags.join('\n    ')
}

/** Retire les balises d'aperçu existantes (celles de l'accueil) puis insère les nouvelles. */
export function injectTags(html, tags) {
  const clean = html
    .replace(/<title>[\s\S]*?<\/title>\s*/i, '')
    .replace(/<meta\s+name="description"[^>]*>\s*/gi, '')
    .replace(/<link\s+rel="canonical"[^>]*>\s*/gi, '')
    .replace(/<meta\s+property="og:[^"]*"[^>]*>\s*/gi, '')
    .replace(/<meta\s+name="twitter:[^"]*"[^>]*>\s*/gi, '')
  return clean.replace(/<\/head>/i, `    ${tags}\n  </head>`)
}

/**
 * Page projet avec ses balises d'aperçu.
 * @param {{ html: string, slug: string, origin: string }} p
 * @returns {Promise<{ html: string, found: boolean }>}
 */
export async function renderProjectPage({ html, slug, origin }) {
  try {
    const [project, [profile = {}] = []] = await Promise.all([findProject(slug), rest('profile?select=full_name,role&limit=1')])
    if (!project) return { html, found: false }
    const author = profile.full_name || 'Portfolio'
    const cover = project.cover?.url || project.image_url || null
    const image = cover ? (/^https?:\/\//.test(cover) ? cover : `${origin}${cover.startsWith('/') ? '' : '/'}${cover}`) : `${origin}/og-image.png`
    const tags = ogTags({
      title: `${project.title} — ${author}`,
      description: clip(project.description || [project.category, profile.role].filter(Boolean).join(' · ') || `Un projet de ${author}.`),
      url: `${origin}/projets/${project.slug || slug}`,
      image,
      imageWidth: cover ? project.cover?.width : 1200,
      imageHeight: cover ? project.cover?.height : 630,
      imageAlt: project.cover?.alt || project.title,
      siteName: [author, profile.role].filter(Boolean).join(' — '),
      type: 'article',
    })
    return { html: injectTags(html, tags), found: true }
  } catch (err) {
    console.error('[aperçu projet]', err.message)
    return { html, found: false }
  }
}
