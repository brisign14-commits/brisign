/**
 * Extraction d'identité de marque d'un site web — SANS IA.
 *
 * Lit la page et ses feuilles de style, puis en déduit : nom, accroche, logo, icône,
 * polices, palette (rôles déduits des noms de variables CSS + fréquence d'usage),
 * rayon des coins et bibliothèque d'icônes. Les captures d'écran (ordinateur + mobile)
 * viennent de Microlink. Les images sont renvoyées en data URL pour être dessinées
 * dans un <canvas> côté admin sans problème de CORS.
 *
 * Utilisé par la fonction Vercel `api/brand-extract.js` et par le serveur de dev Vite.
 */
import { lookup } from 'node:dns/promises'
import net from 'node:net'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 BrandBoardBot/1.0'
const MAX_HTML = 3 * 1024 * 1024
const MAX_CSS = 2 * 1024 * 1024
const MAX_IMG = 3 * 1024 * 1024
const MAX_FONT = 400 * 1024

export class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

/* ------------------------------------------------------------------ */
/* Sécurité : authentification admin + refus des adresses internes      */
/* ------------------------------------------------------------------ */

const env = (k) => process.env[k] || process.env[`VITE_${k}`]

/** Vérifie que le jeton Supabase appartient à un administrateur (fonction SQL is_admin). */
export async function assertAdmin(authHeader) {
  const url = env('SUPABASE_URL')
  const key = env('SUPABASE_ANON_KEY')
  if (!url || !key) throw new HttpError(500, 'Configuration Supabase manquante côté serveur.')
  const token = /^Bearer\s+(.+)$/i.exec(authHeader || '')?.[1]
  if (!token) throw new HttpError(401, 'Connexion requise.')
  const r = await fetch(`${url}/rest/v1/rpc/is_admin`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: '{}',
  })
  if (r.status === 401) throw new HttpError(401, 'Session expirée, reconnecte-toi.')
  if (!r.ok || (await r.json()) !== true) throw new HttpError(403, 'Réservé aux administrateurs.')
}

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number)
    return (
      a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19)) || a >= 224
    )
  }
  const v = ip.toLowerCase()
  if (v === '::' || v === '::1') return true
  if (v.startsWith('::ffff:')) return isPrivateIp(v.slice(7))
  return /^(fc|fd|fe8|fe9|fea|feb)/.test(v)
}

async function assertPublicUrl(u) {
  let url
  try {
    url = new URL(u)
  } catch {
    throw new HttpError(400, 'Lien invalide.')
  }
  if (!/^https?:$/.test(url.protocol)) throw new HttpError(400, 'Seuls les liens http(s) sont acceptés.')
  if (url.username || url.password) throw new HttpError(400, 'Lien invalide.')
  const host = url.hostname.replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) throw new HttpError(400, 'Adresse non autorisée.')
  const addrs = net.isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => [])
  if (!addrs.length) throw new HttpError(400, 'Site introuvable (nom de domaine inconnu).')
  if (addrs.some((a) => isPrivateIp(a.address))) throw new HttpError(400, 'Adresse non autorisée.')
  return url
}

/** fetch qui revérifie chaque redirection et limite la taille de la réponse. */
async function safeFetch(u, { max = MAX_HTML, accept = '*/*', timeout = 15000 } = {}) {
  let current = u
  for (let hop = 0; hop < 5; hop++) {
    const url = await assertPublicUrl(current)
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), timeout)
    let r
    try {
      r = await fetch(url, { redirect: 'manual', signal: ctrl.signal, headers: { 'User-Agent': UA, Accept: accept, 'Accept-Language': 'fr,en;q=0.8' } })
    } catch (e) {
      clearTimeout(t)
      throw new HttpError(502, e.name === 'AbortError' ? 'Le site met trop de temps à répondre.' : 'Impossible de joindre le site.')
    }
    if (r.status >= 300 && r.status < 400 && r.headers.get('location')) {
      clearTimeout(t)
      current = new URL(r.headers.get('location'), url).href
      continue
    }
    try {
      if (!r.ok) throw new HttpError(502, `Le site a répondu ${r.status}.`)
      const len = Number(r.headers.get('content-length') || 0)
      if (len > max) throw new HttpError(413, 'Fichier trop lourd.')
      const reader = r.body.getReader()
      const chunks = []
      let size = 0
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        size += value.length
        if (size > max) {
          ctrl.abort()
          throw new HttpError(413, 'Fichier trop lourd.')
        }
        chunks.push(value)
      }
      return { buf: Buffer.concat(chunks), type: (r.headers.get('content-type') || '').split(';')[0].trim(), url: url.href, headers: Object.fromEntries(r.headers) }
    } finally {
      clearTimeout(t)
    }
  }
  throw new HttpError(502, 'Trop de redirections.')
}

const tryFetch = (u, opts) => safeFetch(u, opts).catch(() => null)

/* ------------------------------------------------------------------ */
/* Couleurs                                                             */
/* ------------------------------------------------------------------ */

const clamp01 = (x) => Math.max(0, Math.min(1, x))
const toHex = ({ r, g, b }) => '#' + [r, g, b].map((v) => Math.round(clamp01(v) * 255).toString(16).padStart(2, '0')).join('').toUpperCase()

function oklchToRgb(L, C, H) {
  const a = C * Math.cos((H * Math.PI) / 180)
  const b = C * Math.sin((H * Math.PI) / 180)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  const lin = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s]
  const g = (x) => (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.max(0, x) ** (1 / 2.4) - 0.055)
  return { r: g(lin[0]), g: g(lin[1]), b: g(lin[2]) }
}

function hslToRgb(h, s, l) {
  h = (((h % 360) + 360) % 360) / 360
  const f = (n) => {
    const k = (n + h * 12) % 12
    return l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1))
  }
  return { r: f(0), g: f(8), b: f(4) }
}

const num = (v, pctScale = 1) => (String(v).trim().endsWith('%') ? parseFloat(v) / 100 : parseFloat(v) / pctScale)
const NAMED = { white: '#FFFFFF', black: '#000000' }

/** Convertit une valeur CSS de couleur en { hex, alpha } (ou null). */
export function parseColor(raw) {
  if (!raw) return null
  let v = String(raw).trim().toLowerCase().replace(/\s*!important$/, '')
  if (NAMED[v]) return { hex: NAMED[v], alpha: 1 }
  let m
  if ((m = /^#([0-9a-f]{3,8})$/.exec(v))) {
    let h = m[1]
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('')
    if (h.length !== 6 && h.length !== 8) return null
    const alpha = h.length === 8 ? parseInt(h.slice(6), 16) / 255 : 1
    return { hex: '#' + h.slice(0, 6).toUpperCase(), alpha }
  }
  const parts = (s) => s.split(/[\s,/]+/).filter(Boolean)
  if ((m = /^rgba?\((.+)\)$/.exec(v))) {
    const p = parts(m[1])
    if (p.length < 3) return null
    const c = p.slice(0, 3).map((x) => (x.endsWith('%') ? parseFloat(x) / 100 : parseFloat(x) / 255))
    return { hex: toHex({ r: c[0], g: c[1], b: c[2] }), alpha: p[3] != null ? num(p[3]) : 1 }
  }
  if ((m = /^hsla?\((.+)\)$/.exec(v))) {
    const p = parts(m[1])
    if (p.length < 3) return null
    return { hex: toHex(hslToRgb(parseFloat(p[0]), num(p[1], 100), num(p[2], 100))), alpha: p[3] != null ? num(p[3]) : 1 }
  }
  if ((m = /^oklch\((.+)\)$/.exec(v))) {
    const p = parts(m[1])
    if (p.length < 3) return null
    const L = num(p[0])
    const C = p[1].endsWith('%') ? (parseFloat(p[1]) / 100) * 0.4 : parseFloat(p[1])
    return { hex: toHex(oklchToRgb(L, C, parseFloat(p[2]) || 0)), alpha: p[3] != null ? num(p[3]) : 1 }
  }
  // Canaux HSL « nus » façon shadcn : 222.2 47.4% 11.2%
  if ((m = /^(-?[\d.]+)(deg)?\s+([\d.]+)%\s+([\d.]+)%$/.exec(v))) {
    return { hex: toHex(hslToRgb(parseFloat(m[1]), parseFloat(m[3]) / 100, parseFloat(m[4]) / 100)), alpha: 1 }
  }
  return null
}

const rgbOf = (hex) => ({ r: parseInt(hex.slice(1, 3), 16) / 255, g: parseInt(hex.slice(3, 5), 16) / 255, b: parseInt(hex.slice(5, 7), 16) / 255 })
function hslOf(hex) {
  const { r, g, b } = rgbOf(hex)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  let h = 0
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return { h: (h * 60 + 360) % 360, s, l }
}
const lum = (hex) => {
  const f = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  const { r, g, b } = rgbOf(hex)
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
const isChromatic = (hex) => {
  const { s, l } = hslOf(hex)
  return s > 0.28 && l > 0.12 && l < 0.88
}
const mix = (a, b, t) => {
  const A = rgbOf(a)
  const B = rgbOf(b)
  return toHex({ r: A.r + (B.r - A.r) * t, g: A.g + (B.g - A.g) * t, b: A.b + (B.b - A.b) * t })
}
const dist = (a, b) => {
  const A = rgbOf(a)
  const B = rgbOf(b)
  return Math.hypot(A.r - B.r, A.g - B.g, A.b - B.b)
}

/* ------------------------------------------------------------------ */
/* CSS : parseur minimal (sélecteurs imbriqués, @media, @theme)         */
/* ------------------------------------------------------------------ */

function walkCss(css, onDecl) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const stack = []
  let buf = ''
  let quote = null
  let paren = 0
  for (let i = 0; i < css.length; i++) {
    const c = css[i]
    // Caractère échappé (ex. sélecteurs Tailwind `\[stroke\=\'\#ccc\'\]`) : jamais un délimiteur
    if (c === '\\') {
      buf += c + (css[i + 1] ?? '')
      i++
      continue
    }
    if (quote) {
      buf += c
      if (c === quote) quote = null
      continue
    }
    if (c === '"' || c === "'") {
      quote = c
      buf += c
      continue
    }
    if (c === '(') paren++
    if (c === ')') paren = Math.max(0, paren - 1)
    if (paren) {
      buf += c
      continue
    }
    if (c === '{') {
      stack.push(buf.trim())
      buf = ''
    } else if (c === ';' || c === '}') {
      const decl = buf.trim()
      const k = decl.indexOf(':')
      if (k > 0 && !decl.startsWith('@')) onDecl(decl.slice(0, k).trim(), decl.slice(k + 1).trim(), stack)
      buf = ''
      if (c === '}') stack.pop()
    } else buf += c
  }
}

const isDarkContext = (stack) => stack.some((s) => /\.dark\b|\[data-theme=["']?dark|\[data-mode=["']?dark|prefers-color-scheme:\s*dark|\.theme-dark/i.test(s))
const isRootContext = (stack) => stack.some((s) => /:root|^html\b|@theme|:host|^body\b|\[data-theme=["']?light/i.test(s))

const TW_PALETTE = /^--(?:color-|tw-)?(red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|grey|zinc|neutral|stone)-\d{2,3}$|^--tw-/
const GENERIC_FONTS = new Set(
  ['sans-serif', 'serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-sans-serif', 'ui-serif', 'ui-monospace', 'ui-rounded', '-apple-system', 'blinkmacsystemfont', 'segoe ui', 'roboto', 'helvetica neue', 'helvetica', 'arial', 'noto sans', 'apple color emoji', 'segoe ui emoji', 'segoe ui symbol', 'noto color emoji', 'inherit', 'initial', 'unset', 'sfmono-regular', 'menlo', 'monaco', 'consolas', 'liberation mono', 'courier new', 'courier', 'times new roman', 'times', 'georgia', 'verdana', 'tahoma', 'emoji', 'math', 'fangsong', 'liberation sans', 'oxygen', 'ubuntu', 'cantarell', 'fira sans', 'droid sans', 'open sans']
    .map((s) => s.toLowerCase()),
)
// Roboto / Open Sans sont génériques dans les piles « système », mais réels s'ils arrivent en premier : géré plus bas.
const SYSTEM_ONLY = new Set(['sans-serif', 'serif', 'monospace', 'system-ui', 'ui-sans-serif', 'ui-serif', 'ui-monospace', '-apple-system', 'blinkmacsystemfont', 'segoe ui', 'inherit', 'initial', 'unset', 'cursive', 'fantasy', 'emoji', 'math', 'apple color emoji', 'segoe ui emoji', 'segoe ui symbol', 'noto color emoji', 'sfmono-regular', 'menlo', 'monaco', 'consolas', 'courier new', 'liberation mono', 'helvetica neue', 'arial', 'helvetica'])

const firstFamily = (value) => {
  for (const part of value.split(',')) {
    const f = part.trim().replace(/^["']|["']$/g, '').trim()
    if (!f || f.startsWith('var(')) continue
    return f
  }
  return null
}

export function analyzeCss(cssList) {
  const vars = new Map() // nom -> { value, order }
  const refs = new Map() // nom -> nb de var(--nom)
  const literal = new Map() // hex -> nb d'usages directs
  const fontDecls = new Map() // famille -> nb
  const fontFaces = [] // { family, weight, style, src }
  const fontVars = new Map()
  const radii = new Map()
  let order = 0

  for (const { css, base } of cssList) {
    for (const m of css.matchAll(/var\(\s*(--[\w-]+)/g)) refs.set(m[1], (refs.get(m[1]) || 0) + 1)

    // @font-face
    for (const m of css.matchAll(/@font-face\s*{([^}]*)}/g)) {
      const body = m[1]
      const family = /font-family\s*:\s*([^;]+)/.exec(body)?.[1]?.trim().replace(/^["']|["']$/g, '')
      const weight = /font-weight\s*:\s*([^;]+)/.exec(body)?.[1]?.trim() || '400'
      const style = /font-style\s*:\s*([^;]+)/.exec(body)?.[1]?.trim() || 'normal'
      const src = [...(/src\s*:\s*([^;]+)/.exec(body)?.[1] || '').matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)\s*(?:format\(\s*["']?([\w-]+)["']?\s*\))?/g)]
      const woff2 = src.find((s) => s[2] === 'woff2' || /\.woff2(\?|$)/.test(s[1])) || src.find((s) => /\.woff(\?|$)/.test(s[1]))
      if (family && woff2 && !woff2[1].startsWith('data:')) {
        try {
          fontFaces.push({ family, weight, style, src: new URL(woff2[1], base).href })
        } catch {
          /* url invalide */
        }
      }
    }

    walkCss(css.replace(/@font-face\s*{[^}]*}/g, ''), (prop, value, stack) => {
      const dark = isDarkContext(stack)
      if (prop.startsWith('--')) {
        if (!dark && !vars.has(prop) && (isRootContext(stack) || stack.length <= 2)) vars.set(prop, { value, order: order++ })
        if (/font/i.test(prop) && !/weight|size|feature|variation|style|stretch|smooth/i.test(prop) && !dark) {
          const f = firstFamily(value)
          if (f) fontVars.set(prop, f)
        }
        if (/^--radius$|^--(border-)?radius(-(md|base|default))?$/.test(prop) && !radii.has('var')) radii.set('var', value)
        return
      }
      if (dark) return
      if (prop === 'font-family' || prop === 'font') {
        const v = prop === 'font' ? value.replace(/^.*?\d[\w.%]*(\/[\w.%]+)?\s+/, '') : value
        const f = firstFamily(v)
        if (f) fontDecls.set(f, (fontDecls.get(f) || 0) + 1)
      }
      if (/color|background|border|fill|stroke|outline|shadow/.test(prop)) {
        for (const m of value.matchAll(/#[0-9a-fA-F]{3,8}\b|(?:rgba?|hsla?|oklch)\([^)]*\)/g)) {
          const c = parseColor(m[0])
          if (c && c.alpha >= 0.6) literal.set(c.hex, (literal.get(c.hex) || 0) + 1)
        }
      }
      if (prop === 'border-radius' && /^\d/.test(value)) radii.set(value, (radii.get(value) || 0) + 1)
    })
  }

  // Résolution des variables (jusqu'à 6 niveaux de var())
  const resolve = (value, depth = 0) => {
    if (depth > 6) return null
    const m = /^var\(\s*(--[\w-]+)\s*(?:,\s*(.+))?\)$/.exec(value.trim())
    if (m) {
      const v = vars.get(m[1])
      return v ? resolve(v.value, depth + 1) : m[2] ? resolve(m[2], depth + 1) : null
    }
    // hsl(var(--primary)) / oklch(var(--x))
    const w = /^(hsla?|rgba?|oklch)\(\s*var\(\s*(--[\w-]+)\s*\)\s*(?:\/\s*[\d.%]+)?\s*\)$/.exec(value.trim())
    if (w) {
      const inner = vars.get(w[2])?.value
      return inner ? `${w[1]}(${inner})` : null
    }
    return value
  }

  const colorVars = []
  for (const [name, { value, order: o }] of vars) {
    if (TW_PALETTE.test(name)) continue
    const resolved = resolve(value)
    const c = resolved && parseColor(resolved)
    if (!c || c.alpha < 0.6) continue
    colorVars.push({ name, hex: c.hex, refs: refs.get(name) || 0, order: o })
  }

  return { colorVars, literal, fontDecls, fontFaces, fontVars, radii, resolve }
}

/* ------------------------------------------------------------------ */
/* Rôles de couleur                                                     */
/* ------------------------------------------------------------------ */

const bare = (n) => n.replace(/^--(color-)?/, '').toLowerCase()
const ROLE_RULES = [
  { role: 'primary', chromatic: true, re: /^(brand|primary|accent-?color|main|theme(-color)?|signal|cta)(-?(500|600|base|default|color))?$/, pref: ['brand', 'primary'] },
  { role: 'primaryStrong', re: /^(brand|primary)-?(strong|dark|darker|hover|700|800|deep|active)$/ },
  { role: 'primarySoft', re: /^(brand|primary)-?(soft|light|lighter|subtle|50|100|tint|muted|bg)$/ },
  { role: 'ink', re: /^(ink|foreground|text|fg|body-?color|heading|text-primary|content|on-background|dark)$/, pref: ['ink', 'text', 'foreground'] },
  { role: 'bg', re: /^(background|bg|surface|paper|canvas|base-?100|page|body-?bg|light)$/ },
  { role: 'surface2', re: /^(surface-?2|bg-?(alt|subtle|muted|secondary)|background-?(alt|secondary)|card-?bg|muted)$/ },
  { role: 'muted', re: /^(muted-?(ink|foreground|text)|text-?(muted|secondary)|fog|mute|subtle-?text|gray|grey)$/ },
  { role: 'line', re: /^(line|border|divider|stroke|edge|outline)$/ },
  { role: 'success', re: /^(ok|success|positive|valid)(-?(500|600|base))?$/ },
  { role: 'warning', re: /^(warn|warning|caution|pending)(-?(500|600|base))?$/ },
  { role: 'danger', re: /^(danger|error|destructive|negative)(-?(500|600|base))?$/ },
  { role: 'accent', re: /^(accent|secondary-?accent|highlight|tertiary|secondary)$/, chromatic: true },
]

const LABELS = {
  primary: ['Couleur principale', 'Boutons, liens, logo'],
  primaryStrong: ['Principale foncée', 'Survol, état actif'],
  primarySoft: ['Principale douce', 'Fonds, badges, sélection'],
  accent: ['Accent', 'Mises en avant'],
  ink: ['Encre', 'Titres et texte'],
  muted: ['Gris texte', 'Texte secondaire'],
  bg: ['Fond', 'Pages, cartes'],
  surface2: ['Fond secondaire', 'Sections, champs'],
  line: ['Ligne', 'Bordures, séparateurs'],
  success: ['Succès', 'Confirmations'],
  warning: ['Avertissement', 'En attente, alertes'],
  danger: ['Erreur', 'Suppressions, erreurs'],
}

export function pickPalette({ colorVars, literal }, themeColor) {
  const roles = {}
  const used = new Set()
  for (const rule of ROLE_RULES) {
    let cands = colorVars.filter((v) => rule.re.test(bare(v.name)))
    if (!cands.length) continue
    const rank = (n) => {
      const i = rule.pref.findIndex((p) => bare(n).startsWith(p))
      return i < 0 ? 99 : i
    }
    if (rule.pref) cands.sort((a, b) => rank(a.name) - rank(b.name) || b.refs - a.refs)
    else cands.sort((a, b) => b.refs - a.refs || a.order - b.order)
    // La « primary » shadcn est souvent noire, l'« accent » souvent gris : couleurs saturées seulement.
    if (rule.chromatic) cands = cands.filter((c) => isChromatic(c.hex))
    const c = cands[0]
    if (c) roles[rule.role] = { hex: c.hex, token: c.name }
  }

  // Couleur principale de secours : la couleur saturée la plus utilisée
  if (!roles.primary) {
    const scored = new Map()
    for (const v of colorVars) if (isChromatic(v.hex)) scored.set(v.hex, (scored.get(v.hex) || 0) + 2 + v.refs * 2)
    for (const [hex, n] of literal) if (isChromatic(hex)) scored.set(hex, (scored.get(hex) || 0) + n)
    if (themeColor && isChromatic(themeColor)) scored.set(themeColor, (scored.get(themeColor) || 0) + 6)
    const best = [...scored].sort((a, b) => b[1] - a[1])[0]
    roles.primary = best ? { hex: best[0], token: colorVars.find((v) => v.hex === best[0])?.name || null } : { hex: '#2563EB', token: null, guessed: true }
  }

  // Neutres de secours à partir des couleurs littérales
  const all = [...new Set([...colorVars.map((v) => v.hex), ...literal.keys()])]
  const byLum = all.filter((h) => !isChromatic(h)).sort((a, b) => lum(a) - lum(b))
  if (!roles.ink) roles.ink = { hex: byLum.find((h) => lum(h) < 0.05) || '#111111', token: null }
  if (!roles.bg) roles.bg = { hex: byLum.slice().reverse().find((h) => lum(h) > 0.9) || '#FFFFFF', token: null }
  if (lum(roles.bg.hex) < 0.4) {
    // Site sombre par défaut : on garde ce fond, l'encre doit être claire
    if (lum(roles.ink.hex) < 0.4) roles.ink = { hex: byLum.slice().reverse()[0] || '#FFFFFF', token: roles.ink.token }
  }
  if (!roles.muted) roles.muted = { hex: mix(roles.ink.hex, roles.bg.hex, 0.45), token: null, derived: true }
  if (!roles.line) roles.line = { hex: mix(roles.ink.hex, roles.bg.hex, 0.88), token: null, derived: true }
  if (!roles.primaryStrong) roles.primaryStrong = { hex: mix(roles.primary.hex, '#000000', 0.22), token: null, derived: true }
  if (!roles.primarySoft) roles.primarySoft = { hex: mix(roles.primary.hex, '#FFFFFF', 0.9), token: null, derived: true }

  // Accent : 2ᵉ couleur saturée bien distincte, si aucune variable ne la nomme
  if (!roles.accent) {
    const cands = [...literal].filter(([h]) => isChromatic(h) && dist(h, roles.primary.hex) > 0.35).sort((a, b) => b[1] - a[1])
    if (cands[0] && cands[0][1] >= 3) roles.accent = { hex: cands[0][0], token: null }
  }

  const ORDER = ['primary', 'primaryStrong', 'primarySoft', 'ink', 'muted', 'bg', 'line', 'accent', 'success', 'warning', 'danger', 'surface2']
  const palette = []
  for (const role of ORDER) {
    const r = roles[role]
    if (!r || palette.some((p) => p.hex === r.hex)) continue
    palette.push({ role, hex: r.hex, token: r.token, name: LABELS[role][0], usage: LABELS[role][1], derived: Boolean(r.derived) })
    used.add(r.hex)
  }
  return palette.slice(0, 9)
}

/* ------------------------------------------------------------------ */
/* HTML                                                                 */
/* ------------------------------------------------------------------ */

const decode = (s) =>
  s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;|&rsquo;|&#8217;/g, '’')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
const textOf = (html) => decode(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
const attr = (tag, name) => {
  const m = new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag)
  return m ? decode(m[2] ?? m[3] ?? m[4] ?? '') : null
}
const meta = (html, key) => {
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const t = m[0]
    if ((attr(t, 'property') || attr(t, 'name') || '').toLowerCase() === key) return attr(t, 'content')
  }
  return null
}

function findLogo(html, base) {
  const header = /<header[\s\S]*?<\/header>/i.exec(html)?.[0] || html.slice(0, 12000)
  const cands = []
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const t = m[0]
    const src = attr(t, 'src') || attr(t, 'data-src')
    if (!src || src.startsWith('data:image/gif')) continue
    const hay = `${src} ${attr(t, 'alt') || ''} ${attr(t, 'class') || ''} ${attr(t, 'id') || ''}`.toLowerCase()
    let score = 0
    if (/logo|brand|wordmark/.test(hay)) score += 6
    if (header.includes(t)) score += 3
    if (m.index < 8000) score += 1
    if (/avatar|hero|banner|photo|cover|bg|background/.test(hay)) score -= 4
    if (score > 3) cands.push({ score, src })
  }
  cands.sort((a, b) => b.score - a.score)
  if (cands[0]) {
    try {
      return { kind: 'url', url: new URL(cands[0].src, base).href }
    } catch {
      /* ignore */
    }
  }
  // SVG en ligne dans l'en-tête, dans un lien vers l'accueil ou marqué « logo »
  for (const m of header.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = attr(m[0].slice(0, m[0].indexOf('>') + 1), 'href') || ''
    const svg = /<svg[\s\S]*?<\/svg>/i.exec(m[1])?.[0]
    if (svg && (/^(\/|\.\/|#)?$|^\/(index|home)/.test(href) || /logo|brand/i.test(m[0].slice(0, 300)))) return { kind: 'svg', svg }
  }
  const svg = /<svg\b[^>]*(logo|brand)[^>]*>[\s\S]*?<\/svg>/i.exec(html)?.[0]
  return svg ? { kind: 'svg', svg } : null
}

function findIcons(html, base) {
  const icons = []
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const t = m[0]
    const rel = (attr(t, 'rel') || '').toLowerCase()
    if (!/icon/.test(rel)) continue
    const href = attr(t, 'href')
    if (!href) continue
    const size = parseInt(attr(t, 'sizes') || '', 10) || (rel.includes('apple') ? 180 : /\.svg/i.test(href) ? 512 : 32)
    try {
      icons.push({ url: new URL(href, base).href, size })
    } catch {
      /* ignore */
    }
  }
  icons.sort((a, b) => b.size - a.size)
  return icons
}

function detectIconLibrary(html) {
  if (/lucide/i.test(html)) return 'Lucide'
  if (/material-symbols|material-icons/i.test(html)) return 'Material Symbols'
  if (/\bfa-(solid|regular|brands)|\bfa[srb]?\s+fa-|font-?awesome/i.test(html)) return 'Font Awesome'
  if (/heroicon/i.test(html)) return 'Heroicons'
  if (/phosphor|\bph-/i.test(html)) return 'Phosphor'
  if (/tabler-icon|ti ti-/i.test(html)) return 'Tabler Icons'
  if (/bi bi-|bootstrap-icons/i.test(html)) return 'Bootstrap Icons'
  if (/remixicon|\bri-[a-z]/i.test(html)) return 'Remix Icon'
  return null
}

function cleanName(title, siteName, host) {
  if (siteName) return siteName.trim()
  const t = (title || '').split(/\s[|–—·:-]\s|\s[|–—·]/)[0].trim()
  if (t && t.length <= 40) return t
  const h = host.replace(/^www\./, '').split('.')[0]
  return h.charAt(0).toUpperCase() + h.slice(1)
}

/* ------------------------------------------------------------------ */
/* Technologies (tags du projet)                                        */
/* ------------------------------------------------------------------ */

const STACK_RULES = [
  ['Next.js', (h) => /__NEXT_DATA__|\/_next\/static\//.test(h.html) || /next\.js/i.test(h.headers['x-powered-by'] || '')],
  ['Nuxt', (h) => /__NUXT__|\/_nuxt\//.test(h.html)],
  ['Astro', (h) => /astro-island|\/_astro\//.test(h.html)],
  ['SvelteKit', (h) => /__sveltekit|\/_app\/immutable\//.test(h.html)],
  ['Remix', (h) => /__remixContext|__remixManifest/.test(h.html)],
  ['Gatsby', (h) => /___gatsby/.test(h.html)],
  ['Angular', (h) => /ng-version=|\bng-app\b/.test(h.html)],
  ['Vue.js', (h) => /data-v-[0-9a-f]{6,}|__VUE__|vue\.runtime/.test(h.all) && !/__NUXT__/.test(h.html)],
  ['Svelte', (h) => /\bsvelte-[a-z0-9]{5,}/.test(h.html) && !/__sveltekit/.test(h.html)],
  ['React', (h) => /react-dom|__reactFiber|react\.production|data-reactroot|createRoot\(|useState\)|\.useState\b/.test(h.all) || /__NEXT_DATA__|__remixContext|___gatsby/.test(h.html)],
  ['Vite', (h) => /<script[^>]+type="module"[^>]*src="\/assets\/[\w.-]+\.js"|\/@vite\/|vite\/modulepreload-polyfill|__vite__/.test(h.all)],
  ['TanStack Router', (h) => /lazyRouteComponent|@tanstack\/react-router|tanstack-router/.test(h.all)],
  ['React Router', (h) => /react-router|createBrowserRouter/.test(h.js) && !/lazyRouteComponent/.test(h.all)],
  ['TanStack Query', (h) => /QueryClientProvider|@tanstack\/react-query/.test(h.js)],
  ['Tailwind CSS', (h) => /--tw-[a-z]|tailwindcss/.test(h.css + h.html)],
  ['shadcn/ui', (h) => /--sidebar-primary|--popover-foreground/.test(h.css) && /--radius\b/.test(h.css)],
  ['Bootstrap', (h) => /bootstrap(\.min)?\.(css|js)|--bs-primary/.test(h.css + h.html)],
  ['Framer Motion', (h) => /framer-motion|MotionConfig|LayoutGroup|useMotionValue|motionValue\(/.test(h.js)],
  // Appels réels uniquement (un simple mot « gsap » dans une table de correspondance ne compte pas)
  ['GSAP', (h) => /\bgsap\.(to|from|fromTo|timeline|registerPlugin|set|context)\(|ScrollTrigger\.(create|refresh)|GreenSock, Inc|gsap\.com\/standard-license/.test(h.all)],
  ['Three.js', (h) => /three\.module|WebGLRenderer/.test(h.js)],
  ['Supabase', (h) => /supabase\.co\b|@supabase|supabase-js/.test(h.all)],
  ['Firebase', (h) => /firebaseapp\.com|firebaseio\.com|firebase\/(app|auth|firestore)/.test(h.all)],
  ['Stripe', (h) => /js\.stripe\.com/.test(h.all)],
  ['Leaflet', (h) => /leaflet(\.css|-container|-control)/.test(h.css + h.html)],
  ['Mapbox', (h) => /mapbox-gl|api\.mapbox\.com/.test(h.all)],
  ['Google Maps', (h) => /maps\.googleapis\.com/.test(h.all)],
  ['Chart.js', (h) => /chart\.js|Chart\.register/.test(h.js)],
  ['Recharts', (h) => /recharts/.test(h.all)],
  ['Socket.io', (h) => /socket\.io/.test(h.all)],
  ['Zustand', (h) => /zustand/.test(h.js)],
  ['Redux', (h) => /@reduxjs|redux-toolkit/.test(h.js)],
  ['jQuery', (h) => /jquery(\.min)?\.js|jQuery\.fn/.test(h.all)],
  ['WordPress', (h) => /wp-content|wp-includes/.test(h.html)],
  ['Shopify', (h) => /cdn\.shopify\.com|Shopify\.theme/.test(h.html)],
  ['Webflow', (h) => /webflow\.(js|css)|data-wf-page/.test(h.html)],
  ['Wix', (h) => /static\.wixstatic\.com/.test(h.html)],
  ['Vercel', (h) => Boolean(h.headers['x-vercel-id']) || /vercel/i.test(h.headers.server || '')],
  ['Netlify', (h) => /netlify/i.test(h.headers.server || '') || Boolean(h.headers['x-nf-request-id'])],
]

function detectStack({ html, css, js, headers }) {
  const h = { html, css, js, all: `${html}\n${js}`, headers: headers || {} }
  const out = []
  for (const [name, test] of STACK_RULES) {
    try {
      if (test(h)) out.push(name)
    } catch {
      /* règle invalide */
    }
  }
  return out
}

/**
 * Langages : TypeScript se lit dans les sources maps (.map) quand le site les publie ;
 * sinon JavaScript dès qu'il y a du code. PHP / Node.js / .NET via les en-têtes serveur.
 */
async function detectLanguages({ html, jsText, jsFiles, headers, stack }) {
  const out = []
  const powered = `${headers['x-powered-by'] || ''} ${headers.server || ''}`
  if (/php/i.test(powered) || stack.includes('WordPress')) out.push('PHP')
  if (/express/i.test(powered)) out.push('Node.js', 'Express')
  if (/asp\.net/i.test(powered)) out.push('.NET')

  if (jsFiles.length || /<script\b/i.test(html)) {
    // Un chemin de fichier .tsx cité dans le code publié (ids de routes, messages de dev…)
    let ts = /["'`][\w./@-]+\.tsx["'`?]/.test(jsText)
    if (!ts) {
      // Première source map publiée : ses `sources` révèlent les fichiers .ts / .tsx
      const ref = jsFiles.map((f) => ({ f, m: /\/\/# sourceMappingURL=([^\s'"]+\.map)/.exec(f.buf.toString('utf8').slice(-600)) })).find((x) => x.m)
      if (ref) {
        try {
          const map = await tryFetch(new URL(ref.m[1], ref.f.url).href, { max: 8 * 1024 * 1024, accept: 'application/json' })
          const sources = map ? JSON.parse(map.buf.toString('utf8')).sources || [] : []
          ts = sources.some((s) => /\.tsx?$/.test(s) && !/node_modules/.test(s))
        } catch {
          /* map illisible */
        }
      }
    }
    out.push(ts ? 'TypeScript' : 'JavaScript')
  }
  return out
}

/* Logos des technologies — même conversion nom → identifiant que le site (src/components/shared.jsx) */
const ICON_ALIASES = {
  'next.js': 'nextdotjs',
  'vue.js': 'vuedotjs',
  'node.js': 'nodedotjs',
  'tailwind css': 'tailwindcss',
  'tanstack router': 'tanstack',
  'tanstack query': 'reactquery',
  'react router': 'reactrouter',
  'framer motion': 'framer',
  gsap: 'greensock',
  '.net': 'dotnet',
}
const iconSlug = (name) => {
  const key = String(name).trim().toLowerCase()
  return ICON_ALIASES[key] || key.replace(/\+/g, 'plus').replace(/\./g, 'dot').replace(/[^a-z0-9]/g, '')
}

async function fetchStackIcons(names) {
  const entries = await Promise.all(
    names.slice(0, 16).map(async (name) => {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 8000)
      try {
        const r = await fetch(`https://cdn.simpleicons.org/${encodeURIComponent(iconSlug(name))}`, { signal: ctrl.signal })
        if (!r.ok || !/svg/.test(r.headers.get('content-type') || '')) return null
        const svg = await r.text()
        if (svg.length > 60000 || !svg.includes('<svg')) return null
        return [name, `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`]
      } catch {
        return null
      } finally {
        clearTimeout(t)
      }
    }),
  )
  return Object.fromEntries(entries.filter(Boolean))
}

/* ------------------------------------------------------------------ */
/* Captures d'écran (Microlink)                                         */
/* ------------------------------------------------------------------ */

async function screenshot(url, { width, height, mobile }) {
  const key = process.env.MICROLINK_API_KEY
  const api = new URL(key ? 'https://pro.microlink.io/' : 'https://api.microlink.io/')
  const p = api.searchParams
  p.set('url', url)
  p.set('screenshot', 'true')
  p.set('meta', 'false')
  p.set('screenshot.type', 'jpeg')
  p.set('screenshot.quality', '82')
  p.set('viewport.width', String(width))
  p.set('viewport.height', String(height))
  p.set('viewport.deviceScaleFactor', mobile ? '2' : '1')
  if (mobile) {
    p.set('viewport.isMobile', 'true')
    p.set('viewport.hasTouch', 'true')
  }
  p.set('waitForTimeout', '1800')
  p.set('adblock', 'true')
  p.set('animations', 'false')
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 45000)
  try {
    const r = await fetch(api, { signal: ctrl.signal, headers: key ? { 'x-api-key': key } : {} })
    const j = await r.json().catch(() => null)
    const shot = j?.data?.screenshot?.url
    if (!r.ok || !shot) return { error: j?.message || (r.status === 429 ? 'Quota de captures Microlink atteint pour aujourd’hui.' : 'Capture impossible.') }
    const img = await fetch(shot, { signal: ctrl.signal })
    if (!img.ok) return { error: 'Capture impossible.' }
    const buf = Buffer.from(await img.arrayBuffer())
    return { dataUrl: `data:${img.headers.get('content-type') || 'image/jpeg'};base64,${buf.toString('base64')}` }
  } catch (e) {
    return { error: e.name === 'AbortError' ? 'La capture a pris trop de temps.' : 'Capture impossible.' }
  } finally {
    clearTimeout(t)
  }
}

/* ------------------------------------------------------------------ */
/* Point d'entrée                                                       */
/* ------------------------------------------------------------------ */

const toDataUrl = (f) => {
  if (!f) return null
  let type = f.type
  if (!type.startsWith('image/') && !type.startsWith('font/') && !/octet|woff/.test(type)) {
    if (/\.svg(\?|$)/i.test(f.url)) type = 'image/svg+xml'
    else return null
  }
  return `data:${type};base64,${f.buf.toString('base64')}`
}

export async function extractBrand(rawUrl, { screenshots = true } = {}) {
  let input = String(rawUrl || '').trim()
  if (!/^https?:\/\//i.test(input)) input = `https://${input}`
  const page = await safeFetch(input, { max: MAX_HTML, accept: 'text/html,application/xhtml+xml' })
  if (!/html|xml|text\/plain/.test(page.type) && page.type) throw new HttpError(415, 'Ce lien ne renvoie pas une page web.')
  const html = page.buf.toString('utf8')
  const base = new URL(page.url)
  const finalUrl = page.url

  // Captures en parallèle de l'analyse
  const shots = screenshots
    ? Promise.all([screenshot(finalUrl, { width: 1440, height: 900 }), screenshot(finalUrl, { width: 390, height: 844, mobile: true })])
    : Promise.resolve([{ error: 'désactivées' }, { error: 'désactivées' }])

  // Feuilles de style
  const links = []
  const googleFonts = []
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const t = m[0]
    const rel = (attr(t, 'rel') || '').toLowerCase()
    const href = attr(t, 'href')
    if (!href) continue
    if (/fonts\.googleapis\.com\/css/.test(href)) googleFonts.push(new URL(href, base).href)
    else if (rel.includes('stylesheet') || (rel.includes('preload') && attr(t, 'as') === 'style')) {
      try {
        links.push(new URL(href, base).href)
      } catch {
        /* ignore */
      }
    }
  }
  const inline = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => ({ css: m[1], base: finalUrl }))
  const inlineStyleAttrs = [...html.matchAll(/\sstyle="([^"]*)"/gi)].map((m) => `x{${decode(m[1])}}`).join('\n')
  const fetched = await Promise.all([...new Set(links)].slice(0, 8).map((u) => tryFetch(u, { max: MAX_CSS, accept: 'text/css' })))
  const cssList = [...fetched.filter(Boolean).map((f) => ({ css: f.buf.toString('utf8'), base: f.url })), ...inline, { css: inlineStyleAttrs, base: finalUrl }]

  // @import Google Fonts dans le CSS
  for (const { css } of cssList) for (const m of css.matchAll(/@import\s+(?:url\()?["']?(https:\/\/fonts\.googleapis\.com\/css2?[^"')\s]+)/g)) googleFonts.push(m[1])

  // Scripts principaux (pour détecter les technologies)
  const scriptSrcs = [...html.matchAll(/<script\b[^>]*\ssrc\s*=\s*["']([^"']+)["'][^>]*>/gi)]
    .map((m) => m[1])
    .filter((src) => !/googletagmanager|google-analytics|gtag|hotjar|clarity|plausible|umami/i.test(src))
  const modulePreloads = [...html.matchAll(/<link\b[^>]*rel=["']modulepreload["'][^>]*href=["']([^"']+)["']/gi)].map((m) => m[1])
  const jsUrls = [...new Set([...scriptSrcs, ...modulePreloads])]
    .map((src) => {
      try {
        return new URL(src, base).href
      } catch {
        return null
      }
    })
    .filter(Boolean)
    .slice(0, 6)
  const jsFiles = await Promise.all(jsUrls.map((u) => tryFetch(u, { max: 4 * 1024 * 1024, accept: '*/*' })))
  const inlineJs = [...html.matchAll(/<script\b(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]).join('\n')
  const jsText = `${jsFiles.filter(Boolean).map((f) => f.buf.toString('utf8')).join('\n')}\n${inlineJs}`
  const stack = detectStack({ html, css: cssList.map((c) => c.css).join('\n'), js: jsText, headers: page.headers })
  const languages = await detectLanguages({ html, jsText, jsFiles: jsFiles.filter(Boolean), headers: page.headers || {}, stack })
  for (const l of languages) if (!stack.includes(l)) stack.unshift(l)
  const stackIconsPromise = fetchStackIcons(stack)

  const cssData = analyzeCss(cssList)
  const themeColor = parseColor(meta(html, 'theme-color'))?.hex || null
  const palette = pickPalette(cssData, themeColor)

  // Polices
  const gFamilies = []
  for (const u of googleFonts) {
    for (const m of u.matchAll(/family=([^&]+)/g)) {
      for (const fam of decodeURIComponent(m[1]).split('|')) {
        const [name, spec = ''] = fam.split(':')
        const weights = [...spec.matchAll(/(\d{3})(?:\.\.(\d{3}))?/g)].flatMap((w) => (w[2] ? [w[1], w[2]] : [w[1]])).map(Number)
        gFamilies.push({ family: name.replace(/\+/g, ' ').trim(), weights: [...new Set(weights)].sort((a, b) => a - b) })
      }
    }
  }
  const ff = cssData.fontFaces
  const familyScore = new Map()
  const bump = (f, n) => {
    if (!f) return
    const key = f.toLowerCase()
    if (SYSTEM_ONLY.has(key)) return
    familyScore.set(f, (familyScore.get(f) || 0) + n)
  }
  for (const [f, n] of cssData.fontDecls) bump(f, n)
  for (const f of cssData.fontVars.values()) bump(f, 3)
  for (const g of gFamilies) bump(g.family, 5)
  for (const f of ff) bump(f.family, 2)
  const known = (f) => gFamilies.some((g) => g.family.toLowerCase() === f.toLowerCase()) || ff.some((x) => x.family.toLowerCase() === f.toLowerCase())
  const ranked = [...familyScore].filter(([f]) => known(f) || !GENERIC_FONTS.has(f.toLowerCase())).sort((a, b) => b[1] - a[1]).map(([f]) => f)

  const pickVar = (re) => [...cssData.fontVars].find(([k]) => re.test(k))?.[1]
  const headingVar = pickVar(/display|heading|title|brand|serif-display/i)
  const bodyVar = pickVar(/^--font-(sans|body|base|text)$|^--font$/i)
  const usable = (f) => f && !SYSTEM_ONLY.has(f.toLowerCase()) && !/icon|symbol|awesome|emoji|mono|code/i.test(f)
  const textFonts = ranked.filter(usable)
  const body = usable(bodyVar) ? bodyVar : textFonts[0] || null
  // Police de titre distincte seulement si une variable la désigne (--font-display, --font-heading…)
  const heading = usable(headingVar) ? headingVar : body

  const fontInfo = async (family) => {
    if (!family) return null
    const g = gFamilies.find((x) => x.family.toLowerCase() === family.toLowerCase())
    if (g) return { family, source: 'google', weights: g.weights.length ? g.weights : [400, 700] }
    const faces = ff.filter((x) => x.family.toLowerCase() === family.toLowerCase()).slice(0, 6)
    if (faces.length) {
      const files = await Promise.all(
        faces.map(async (f) => {
          const r = await tryFetch(f.src, { max: MAX_FONT, accept: 'font/woff2,*/*' })
          return r ? { weight: f.weight, style: f.style, dataUrl: `data:font/woff2;base64,${r.buf.toString('base64')}` } : null
        }),
      )
      const ok = files.filter(Boolean)
      const weights = [...new Set(faces.flatMap((f) => f.weight.split(/\s+/).map(Number)).filter(Boolean))].sort((a, b) => a - b)
      return { family, source: ok.length ? 'self' : 'unknown', weights: weights.length ? weights : [400, 700], files: ok }
    }
    return { family, source: 'unknown', weights: [400, 700] }
  }
  const [headingFont, bodyFont] = await Promise.all([fontInfo(heading), heading && body && heading.toLowerCase() !== body.toLowerCase() ? fontInfo(body) : null])

  // Textes
  const title = textOf(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] || '')
  const ogSite = meta(html, 'og:site_name')
  const description = meta(html, 'description') || meta(html, 'og:description') || ''
  const h1 = textOf(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1] || '')
  const name = cleanName(title, ogSite, base.hostname)
  const tagline = (h1 && h1.length <= 110 ? h1 : '') || (title.includes(name) ? title.replace(name, '').replace(/^[\s|–—·:-]+/, '') : title) || description.split(/[.!?]/)[0]

  // Rayon des coins
  let radius = cssData.radii.get('var')
  if (radius) radius = cssData.resolve(radius)
  if (!radius || !/^[\d.]+(px|rem|em)$/.test(radius)) radius = [...cssData.radii].filter(([k]) => k !== 'var' && /^[\d.]+(px|rem)$/.test(k)).sort((a, b) => b[1] - a[1])[0]?.[0] || '8px'
  const radiusPx = Math.round(radius.endsWith('rem') || radius.endsWith('em') ? parseFloat(radius) * 16 : parseFloat(radius))

  // Images : logo + icône
  const logoRef = findLogo(html, finalUrl)
  const icons = findIcons(html, finalUrl)
  const [logoFile, iconFile] = await Promise.all([
    logoRef?.kind === 'url' ? tryFetch(logoRef.url, { max: MAX_IMG, accept: 'image/*' }) : null,
    (async () => {
      for (const ic of icons.slice(0, 3)) {
        const r = await tryFetch(ic.url, { max: MAX_IMG, accept: 'image/*' })
        if (r && toDataUrl(r)) return r
      }
      return tryFetch(new URL('/favicon.ico', finalUrl).href, { max: MAX_IMG, accept: 'image/*' })
    })(),
  ])
  let logo = null
  if (logoRef?.kind === 'svg') logo = `data:image/svg+xml;base64,${Buffer.from(logoRef.svg).toString('base64')}`
  else if (logoFile) logo = toDataUrl(logoFile)

  const [[desktop, mobile], stackIcons] = await Promise.all([shots, stackIconsPromise])

  return {
    url: finalUrl,
    domain: base.hostname.replace(/^www\./, ''),
    name,
    tagline: tagline.trim(),
    description: description.trim(),
    palette,
    fonts: { heading: headingFont, body: bodyFont },
    radius: Math.max(0, Math.min(radiusPx || 8, 40)),
    iconLibrary: detectIconLibrary(html),
    stack,
    stackIcons, // { "React": "data:image/svg+xml;base64,…", … } — logos officiels (Simple Icons)
    images: { logo, icon: iconFile ? toDataUrl(iconFile) : null },
    screenshots: { desktop: desktop.dataUrl || null, mobile: mobile.dataUrl || null, error: desktop.error || mobile.error || null },
  }
}

/** Gestion HTTP commune (Vercel + serveur de dev). */
export async function handleBrandRequest({ method, authorization, body }) {
  if (method !== 'POST') return { status: 405, json: { error: 'Méthode non autorisée.' } }
  try {
    await assertAdmin(authorization)
    if (!body?.url) throw new HttpError(400, 'Ajoute un lien.')
    const data = await extractBrand(body.url, { screenshots: body.screenshots !== false })
    return { status: 200, json: data }
  } catch (e) {
    return { status: e.status || 500, json: { error: e.status ? e.message : 'Analyse impossible : erreur inattendue.' } }
  }
}
