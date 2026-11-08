/**
 * Réseaux sociaux du profil (partagé entre l'admin et le site public).
 * Chaque entrée de `profile.socials` : { network, value, label? }
 */

const handle = (base) => (v) => {
  const s = String(v || '').trim()
  if (/^https?:\/\//i.test(s)) return s
  const h = s.replace(/^@/, '').replace(/^\/+/, '')
  return h && /^[\w.-]+$/.test(h) ? `${base}${h}` : null
}
const url = (v) => {
  const s = String(v || '').trim()
  if (!s) return null
  const withProto = /^https?:\/\//i.test(s) ? s : `https://${s}`
  try {
    const u = new URL(withProto)
    return u.hostname.includes('.') ? u.href : null
  } catch {
    return null
  }
}

export const NETWORKS = [
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    placeholder: '+261 34 12 345 67',
    hint: 'Ton numéro, avec l’indicatif du pays',
    toUrl: (v) => {
      if (/^https?:\/\//i.test(String(v).trim())) return url(v)
      const digits = String(v || '').replace(/\D/g, '').replace(/^00/, '')
      return digits.length >= 8 && digits.length <= 15 ? `https://wa.me/${digits}` : null
    },
  },
  { id: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/… ou ton identifiant', toUrl: handle('https://facebook.com/') },
  { id: 'instagram', label: 'Instagram', placeholder: '@identifiant', toUrl: handle('https://instagram.com/') },
  { id: 'tiktok', label: 'TikTok', placeholder: '@identifiant', toUrl: (v) => handle('https://www.tiktok.com/@')(String(v || '').replace(/^@/, '')) },
  { id: 'youtube', label: 'YouTube', placeholder: '@chaine ou lien', toUrl: (v) => handle('https://youtube.com/@')(String(v || '').replace(/^@/, '')) },
  { id: 'telegram', label: 'Telegram', placeholder: '@identifiant', toUrl: handle('https://t.me/') },
  { id: 'behance', label: 'Behance', placeholder: 'identifiant ou lien', toUrl: handle('https://behance.net/') },
  { id: 'dribbble', label: 'Dribbble', placeholder: 'identifiant ou lien', toUrl: handle('https://dribbble.com/') },
  { id: 'malt', label: 'Malt', placeholder: 'https://malt.fr/profile/…', toUrl: url },
  { id: 'website', label: 'Site web', placeholder: 'https://…', toUrl: url },
  { id: 'other', label: 'Autre', placeholder: 'https://…', toUrl: url, customLabel: true },
]

export const networkById = (id) => NETWORKS.find((n) => n.id === id) || NETWORKS[NETWORKS.length - 1]

/** Lien final d'une entrée, ou null si la valeur est invalide. */
export function socialHref(entry) {
  if (!entry?.value) return null
  return networkById(entry.network).toUrl(entry.value)
}

/** Tous les liens à afficher : GitHub / LinkedIn / X puis les réseaux ajoutés. */
export function profileSocials(profile = {}) {
  const realLink = (u) => {
    try {
      return new URL(u).pathname.replace(/\/+$/, '').length > 1 ? u : null // « https://github.com/ » seul : ignoré
    } catch {
      return null
    }
  }
  const legacy = [
    { network: 'github', label: 'GitHub', href: realLink(profile.github) },
    { network: 'linkedin', label: 'LinkedIn', href: realLink(profile.linkedin) },
    { network: 'x', label: 'X / Twitter', href: realLink(profile.twitter) },
  ]
  const extra = (Array.isArray(profile.socials) ? profile.socials : []).map((s) => {
    const n = networkById(s.network)
    return { network: n.id, label: (n.customLabel && s.label?.trim()) || n.label, href: socialHref(s) }
  })
  return [...legacy, ...extra].filter((s) => s.href)
}
