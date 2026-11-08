/**
 * Rendu des planches d'identité de marque sur <canvas> (1600 × 1200, format 4:3).
 * Le jeu de planches dépend du type de projet (voir KINDS / boardsFor) :
 *   - Site web : Couverture, Couleurs, Typographie, Interface, Mockup (données de /api/brand-extract)
 *   - Identité, Packaging, Réseaux sociaux, Print : Couverture, Logo, Couleurs, Typographie
 *     + 2 mises en situation propres au type (données saisies dans l'admin, couleurs tirées du logo)
 */

export const W = 1600
export const H = 1200

/** Types de projet : planches, catégorie suggérée, outils proposés dans la fiche. */
export const KINDS = [
  { key: 'identite', label: 'Identité / logo', category: /identit|logo|brand/i, tools: ['Illustrator', 'Photoshop', 'InDesign'] },
  { key: 'packaging', label: 'Packaging', category: /packag|emballage/i, tools: ['Illustrator', 'Photoshop', 'Dimension'] },
  { key: 'social', label: 'Réseaux sociaux', category: /r[ée]seau|social/i, tools: ['Photoshop', 'Illustrator', 'Canva'] },
  { key: 'print', label: 'Print & affiche', category: /print|affiche/i, tools: ['InDesign', 'Illustrator', 'Photoshop'] },
  { key: 'web', label: 'Site web / UI', category: /web|site|ui/i, tools: [] },
]
export const kindOf = (key) => KINDS.find((k) => k.key === key) || KINDS[KINDS.length - 1]

const BOARD_LABELS = {
  cover: 'Couverture',
  logo: 'Logo',
  colors: 'Couleurs',
  type: 'Typographie',
  ui: 'Interface',
  mockup: 'Mockup',
  stationery: 'Papeterie',
  applications: 'Applications',
  packaging: 'Packaging',
  labels: 'Étiquettes',
  feed: 'Feed Instagram',
  story: 'Stories & post',
  poster: 'Affiches',
  flyer: 'Flyer',
}
const SETS = {
  web: ['cover', 'colors', 'type', 'ui', 'mockup'],
  identite: ['cover', 'logo', 'colors', 'type', 'stationery', 'applications'],
  packaging: ['cover', 'logo', 'colors', 'type', 'packaging', 'labels'],
  social: ['cover', 'logo', 'colors', 'type', 'feed', 'story'],
  print: ['cover', 'logo', 'colors', 'type', 'poster', 'flyer'],
}
/** Planches d'un type de projet, dans l'ordre. */
export const boardsFor = (kind) => (SETS[kind] || SETS.web).map((key) => ({ key, label: BOARD_LABELS[key] }))
/** Toutes les planches existantes (pour reconnaître un fichier déjà envoyé). */
export const ALL_BOARDS = Object.entries(BOARD_LABELS).map(([key, label]) => ({ key, label }))
/** Compatibilité : planches d'un site web. */
export const BOARDS = boardsFor('web')

/* ------------------------------------------------------------------ */
/* Couleurs                                                             */
/* ------------------------------------------------------------------ */

const rgb = (hex) => {
  const h = (hex || '#000000').replace('#', '')
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) || 0)
}
const lum = (hex) => {
  const [r, g, b] = rgb(hex).map((v) => {
    v /= 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
export const mix = (a, b, t) => {
  const A = rgb(a)
  const B = rgb(b)
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('')
}
const alpha = (hex, a) => {
  const [r, g, b] = rgb(hex)
  return `rgba(${r},${g},${b},${a})`
}
const onColor = (hex, ink = '#0B0F18') => (lum(hex) > 0.36 ? ink : '#FFFFFF')
const isLight = (hex) => lum(hex) > 0.6

/** Couleurs de travail déduites de la palette (avec valeurs de secours). */
export function themeOf(d) {
  const by = (role) => d.palette.find((p) => p.role === role)?.hex
  const primary = by('primary') || d.palette[0]?.hex || '#2563EB'
  let bg = by('bg') || '#FFFFFF'
  let ink = by('ink') || '#0B0F18'
  if (!isLight(bg)) [bg, ink] = ['#FFFFFF', isLight(ink) ? '#0B0F18' : ink] // les planches restent sur fond clair
  return {
    primary,
    strong: by('primaryStrong') || mix(primary, '#000000', 0.22),
    soft: by('primarySoft') || mix(primary, '#FFFFFF', 0.9),
    ink,
    bg,
    muted: by('muted') || mix(ink, bg, 0.45),
    line: by('line') || mix(ink, bg, 0.88),
    surface: mix(primary, '#FFFFFF', 0.965),
    success: by('success'),
    warning: by('warning'),
    danger: by('danger'),
  }
}

/* ------------------------------------------------------------------ */
/* Polices                                                              */
/* ------------------------------------------------------------------ */

const FALLBACK = '"Inter", "Segoe UI", system-ui, -apple-system, sans-serif'
const loadedFonts = new Set()

/** Charge la police (Google Fonts, fichiers fournis par le serveur, ou tentative Google par le nom). */
export async function loadFont(font) {
  if (!font?.family) return false
  const fam = font.family
  const weights = (font.weights?.length ? font.weights : [400, 700]).filter((w) => w >= 100 && w <= 900)
  const key = `${fam}|${font.source}|${weights.join(',')}`
  if (!loadedFonts.has(key)) {
    loadedFonts.add(key)
    if (font.source === 'self' && font.files?.length) {
      for (const f of font.files) {
        try {
          const face = new FontFace(fam, `url(${f.dataUrl})`, { weight: String(f.weight || '400'), style: f.style || 'normal' })
          document.fonts.add(await face.load())
        } catch {
          /* fichier illisible */
        }
      }
    } else {
      const spec = font.source === 'google' && weights.length ? `:wght@${[...new Set(weights)].sort((a, b) => a - b).join(';')}` : ''
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fam).replace(/%20/g, '+')}${spec}&display=block`
      document.head.appendChild(link)
      await new Promise((r) => {
        link.onload = r
        link.onerror = r
        setTimeout(r, 4000)
      })
    }
  }
  await Promise.all(weights.map((w) => document.fonts.load(`${w} 40px "${fam}"`).catch(() => null)))
  return document.fonts.check(`400 40px "${fam}"`)
}

const fontStack = (family) => (family ? `"${family}", ${FALLBACK}` : FALLBACK)
const F = (weight, size, family) => `${weight} ${size}px ${fontStack(family)}`

/* ------------------------------------------------------------------ */
/* Images                                                               */
/* ------------------------------------------------------------------ */

const imgCache = new Map()

/** Les SVG sans width/height se dessinent en 300×150 : on leur donne une taille tirée du viewBox. */
function sizedSvg(dataUrl) {
  try {
    const [head, b64] = dataUrl.split(',')
    let svg = head.includes('base64') ? decodeURIComponent(escape(atob(b64))) : decodeURIComponent(b64)
    const open = /<svg\b[^>]*>/i.exec(svg)?.[0]
    if (!open) return dataUrl
    const vb = /viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(open)
    let tag = open
    if (vb) {
      const ratio = parseFloat(vb[1]) / parseFloat(vb[2]) || 1
      const w = 1200
      tag = tag.replace(/\s(width|height)\s*=\s*["'][^"']*["']/gi, '').replace(/<svg/i, `<svg width="${w}" height="${Math.round(w / ratio)}"`)
    }
    if (!/xmlns=/.test(tag)) tag = tag.replace(/<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"')
    svg = svg.replace(open, tag)
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  } catch {
    return dataUrl
  }
}

export function loadImage(src) {
  if (!src) return Promise.resolve(null)
  if (imgCache.has(src)) return imgCache.get(src)
  const real = src.startsWith('data:image/svg') ? sizedSvg(src) : src
  const p = new Promise((resolve) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => resolve(img.naturalWidth ? img : null)
    img.onerror = () => resolve(null)
    img.src = real
  })
  imgCache.set(src, p)
  return p
}

/** Clarté moyenne des pixels opaques (pour savoir si un logo est blanc). */
function imageLightness(img) {
  try {
    const c = document.createElement('canvas')
    c.width = 64
    c.height = Math.max(1, Math.round((64 * img.naturalHeight) / img.naturalWidth))
    const x = c.getContext('2d', { willReadFrequently: true })
    x.drawImage(img, 0, 0, c.width, c.height)
    const d = x.getImageData(0, 0, c.width, c.height).data
    let sum = 0
    let n = 0
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 128) continue
      sum += (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255
      n++
    }
    return n ? sum / n : 0.5
  } catch {
    return 0.5
  }
}

/* ------------------------------------------------------------------ */
/* Primitives de dessin                                                 */
/* ------------------------------------------------------------------ */

function rr(ctx, x, y, w, h, r) {
  const R = typeof r === 'number' ? [r, r, r, r] : r
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, R.map((v) => Math.max(0, Math.min(v, w / 2, h / 2))))
}
function fillRR(ctx, x, y, w, h, r, fill, stroke) {
  rr(ctx, x, y, w, h, r)
  if (fill) {
    ctx.fillStyle = fill
    ctx.fill()
  }
  if (stroke) {
    ctx.strokeStyle = stroke
    ctx.lineWidth = 1.5
    ctx.stroke()
  }
}

function text(ctx, str, x, y, { font, color, align = 'left', baseline = 'alphabetic', spacing = 0 }) {
  ctx.font = font
  ctx.fillStyle = color
  ctx.textAlign = align
  ctx.textBaseline = baseline
  ctx.letterSpacing = `${spacing}px`
  ctx.fillText(str, x, y)
  ctx.letterSpacing = '0px'
}

function wrap(ctx, str, maxWidth, font, spacing = 0) {
  ctx.font = font
  ctx.letterSpacing = `${spacing}px`
  const words = String(str || '').split(/\s+/).filter(Boolean)
  const lines = []
  let line = ''
  for (const w of words) {
    const t = line ? `${line} ${w}` : w
    if (ctx.measureText(t).width > maxWidth && line) {
      lines.push(line)
      line = w
    } else line = t
  }
  if (line) lines.push(line)
  ctx.letterSpacing = '0px'
  return lines
}

/** Paragraphe avec retour à la ligne, nombre de lignes max et points de suspension. */
function para(ctx, str, x, y, { font, color, maxWidth, lineHeight, maxLines = 99, align = 'left', spacing = 0 }) {
  let lines = wrap(ctx, str, maxWidth, font, spacing)
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines)
    ctx.font = font
    let last = lines[maxLines - 1]
    while (ctx.measureText(`${last}…`).width > maxWidth && last.includes(' ')) last = last.slice(0, last.lastIndexOf(' '))
    lines[maxLines - 1] = `${last.replace(/[,;:.\s]+$/, '')}…`
  }
  lines.forEach((l, i) => text(ctx, l, x, y + i * lineHeight, { font, color, align, spacing }))
  return lines.length
}

/** Taille de police maximale pour que `str` tienne dans `maxWidth`. */
function fitSize(ctx, str, maxWidth, weight, family, max, min = 12, spacing = 0) {
  let size = max
  while (size > min) {
    ctx.font = F(weight, size, family)
    ctx.letterSpacing = `${spacing * size}px`
    if (ctx.measureText(str).width <= maxWidth) break
    size -= 2
  }
  ctx.letterSpacing = '0px'
  return size
}

function drawContain(ctx, img, x, y, w, h, align = 'center') {
  const s = Math.min(w / img.naturalWidth, h / img.naturalHeight)
  const dw = img.naturalWidth * s
  const dh = img.naturalHeight * s
  const dx = align === 'left' ? x : x + (w - dw) / 2
  ctx.drawImage(img, dx, y + (h - dh) / 2, dw, dh)
  return { w: dw, h: dh }
}

/** Remplit le rectangle (object-fit: cover), aligné en haut — idéal pour des captures d'écran. */
function drawCoverTop(ctx, img, x, y, w, h, r = 0) {
  ctx.save()
  rr(ctx, x, y, w, h, r)
  ctx.clip()
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight)
  const dw = img.naturalWidth * s
  ctx.drawImage(img, x + (w - dw) / 2, y, dw, img.naturalHeight * s)
  ctx.restore()
}

function shadow(ctx, color, blur, oy) {
  ctx.shadowColor = color
  ctx.shadowBlur = blur
  ctx.shadowOffsetY = oy
}
const noShadow = (ctx) => shadow(ctx, 'transparent', 0, 0)

function eyebrow(ctx, str, x, y, color, family, align = 'left') {
  text(ctx, str.toUpperCase(), x, y, { font: F(800, 15, family), color, spacing: 2.2, align })
}

function footer(ctx, d, idx, color, strong) {
  const fam = d.fonts.body?.family || d.fonts.heading?.family
  ctx.font = F(800, 15, fam)
  const nameW = ctx.measureText(d.name).width
  text(ctx, d.name, 96, H - 64, { font: F(800, 15, fam), color: strong })
  text(ctx, ` — Identité de marque`, 96 + nameW, H - 64, { font: F(500, 15, fam), color })
  const pos = ctx.__pos || { i: idx, n: 5 }
  const two = (v) => String(v).padStart(2, '0')
  text(ctx, `${two(pos.i)} / ${two(pos.n)}`, W - 96, H - 64, { font: F(600, 15, fam), color, align: 'right' })
}

function placeholder(ctx, x, y, w, h, r, t, label) {
  fillRR(ctx, x, y, w, h, r, t.surface, t.line)
  text(ctx, label, x + w / 2, y + h / 2, { font: F(600, 18), color: t.muted, align: 'center', baseline: 'middle' })
}

/* Icônes Lucide (tracés SVG d'origine, 24 × 24) */
const ICONS = [
  ['M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5'],
  ['M8 2v4', 'M16 2v4', 'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'M3 10h18', 'm9 16 2 2 4-4'],
  ['M7.9 20A9 9 0 1 0 4 16.1L2 22Z'],
  ['M10.268 21a2 2 0 0 0 3.464 0', 'M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326'],
  ['M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0', 'M12 7a3 3 0 1 0 0 6a3 3 0 1 0 0-6'],
  ['m21 21-4.34-4.34', 'M11 3a8 8 0 1 0 0 16a8 8 0 1 0 0-16'],
]
function icon(ctx, paths, x, y, size, color) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(size / 24, size / 24)
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const p of paths) ctx.stroke(new Path2D(p))
  ctx.restore()
}

/* ------------------------------------------------------------------ */
/* Planches                                                             */
/* ------------------------------------------------------------------ */

function drawCover(ctx, d, a, t) {
  const H1 = d.fonts.heading?.family
  const B = d.fonts.body?.family || H1
  const darkLogo = a.logo && imageLightness(a.logo) > 0.82 // logo blanc → fond sombre
  const bg = darkLogo ? t.ink : '#FFFFFF'
  const fg = darkLogo ? '#FFFFFF' : t.ink
  const sub = darkLogo ? alpha('#FFFFFF', 0.7) : t.muted

  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)
  const g = ctx.createRadialGradient(W / 2, 520, 0, W / 2, 520, 560)
  g.addColorStop(0, darkLogo ? alpha(t.primary, 0.45) : t.soft)
  g.addColorStop(1, alpha(darkLogo ? t.ink : '#FFFFFF', 0))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  eyebrow(ctx, d.domain || (d.kind && d.kind !== 'web' ? kindOf(d.kind).label : ''), W / 2, 330, darkLogo ? mix(t.primary, '#FFFFFF', 0.55) : t.primary, B, 'center')

  let y = 380
  if (a.logo) {
    const box = drawContain(ctx, a.logo, (W - 880) / 2, y, 880, 250)
    y += 125 + box.h / 2 + 90
  } else {
    const size = fitSize(ctx, d.name, 1100, 800, H1, 150, 60, -0.04)
    text(ctx, d.name, W / 2, y + size * 0.85, { font: F(800, size, H1), color: t.primary, align: 'center', spacing: -0.04 * size })
    y += size + 110
  }
  const n = para(ctx, d.tagline, W / 2, y, { font: F(800, 44, H1), color: fg, maxWidth: 1180, lineHeight: 54, maxLines: 2, align: 'center', spacing: -1.2 })
  y += n * 54 + 12
  if (d.description) para(ctx, d.description, W / 2, y, { font: F(500, 22, B), color: sub, maxWidth: 1000, lineHeight: 32, maxLines: 2, align: 'center' })

  footer(ctx, d, 1, sub, fg)
  const bars = d.palette.slice(0, 7)
  const weights = [5, 2, 1.6, 3, 1.4, 1, 1, 1].slice(0, bars.length)
  const total = weights.reduce((s, v) => s + v, 0)
  let x = 0
  bars.forEach((p, i) => {
    const w = (W * weights[i]) / total
    ctx.fillStyle = p.hex
    ctx.fillRect(x, H - 22, w + 1, 22)
    x += w
  })
}

function drawColors(ctx, d, a, t) {
  const H1 = d.fonts.heading?.family
  const B = d.fonts.body?.family || H1
  ctx.fillStyle = t.surface
  ctx.fillRect(0, 0, W, H)
  eyebrow(ctx, 'Palette', 96, 112, t.primary, B)
  text(ctx, 'Couleurs', 96, 196, { font: F(800, 66, H1), color: t.ink, spacing: -2.3 })

  const pal = d.palette.slice(0, 9)
  const gx = 96
  const gy = 246
  const gw = W - 192
  const gap = 20
  const cw = (gw - gap * 3) / 4
  const cells = []
  if (pal.length >= 5) {
    const rows = pal.length > 5 ? [262, 262, 190] : [272, 272]
    const ry = [gy, gy + rows[0] + gap, gy + rows[0] + rows[1] + gap * 2]
    cells.push({ x: gx, y: gy, w: cw * 2 + gap, h: rows[0] + rows[1] + gap, big: true })
    const small = [
      [2, 0],
      [3, 0],
      [2, 1],
      [3, 1],
      [0, 2],
      [1, 2],
      [2, 2],
      [3, 2],
    ]
    for (const [c, r] of small) cells.push({ x: gx + c * (cw + gap), y: ry[r], w: cw, h: rows[r] })
  } else {
    const w = (gw - gap * (pal.length - 1)) / Math.max(1, pal.length)
    pal.forEach((_, i) => cells.push({ x: gx + i * (w + gap), y: gy, w, h: 560, big: i === 0 }))
  }

  pal.forEach((p, i) => {
    const c = cells[i]
    if (!c) return
    const fg = onColor(p.hex, t.ink)
    const sub = fg === '#FFFFFF' ? alpha('#FFFFFF', 0.78) : alpha(t.ink, 0.66)
    fillRR(ctx, c.x, c.y, c.w, c.h, 20, p.hex, lum(p.hex) > 0.85 ? t.line : null)
    const pad = c.big ? 40 : 28
    const nameSize = c.big ? 46 : 22
    const ns = fitSize(ctx, p.name || '', c.w - pad * 2, 800, H1, nameSize, 16, -0.02)
    text(ctx, p.name || '', c.x + pad, c.y + pad + ns * 0.82, { font: F(800, ns, H1), color: fg, spacing: -0.02 * ns })
    if (p.usage) para(ctx, p.usage, c.x + pad, c.y + pad + ns + (c.big ? 30 : 22), { font: F(600, c.big ? 20 : 15, B), color: sub, maxWidth: c.w - pad * 2, lineHeight: c.big ? 28 : 20, maxLines: 2 })
    const [r, g, b] = rgb(p.hex)
    const lines = c.big ? [p.hex.toUpperCase(), `RGB ${r}, ${g}, ${b}`, p.token].filter(Boolean) : [p.hex.toUpperCase(), c.h > 220 ? p.token : null].filter(Boolean)
    const lh = c.big ? 34 : 28
    lines.forEach((l, k) => text(ctx, l, c.x + pad, c.y + c.h - pad - (lines.length - 1 - k) * lh, { font: `${c.big ? 20 : 17}px ui-monospace, Consolas, monospace`, color: fg }))
  })
  footer(ctx, d, 2, t.muted, t.ink)
}

const WEIGHT_NAMES = { 100: 'Thin', 200: 'ExtraLight', 300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'SemiBold', 700: 'Bold', 800: 'ExtraBold', 900: 'Black' }

function drawType(ctx, d, a, t) {
  const hf = d.fonts.heading
  const bf = d.fonts.body || hf
  const H1 = hf?.family
  const B = bf?.family
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, W, H)
  eyebrow(ctx, 'Typographie', 96, 112, t.primary, B)

  text(ctx, 'Aa', 88, 440, { font: F(800, 320, H1), color: t.primary, spacing: -18 })
  const fam = H1 || 'Police système'
  const fs = fitSize(ctx, fam, 560, 800, H1, 40, 22)
  text(ctx, fam, 96, 520, { font: F(800, fs, H1), color: t.ink, spacing: -1 })
  const src = { google: 'Google Fonts', self: 'Police hébergée par le site' }[hf?.source] || 'Police du site'
  const ws = (hf?.weights || []).filter(Boolean)
  const metaLines = [ws.length > 1 ? `${src} · graisses ${ws[0]} à ${ws[ws.length - 1]}` : src]
  if (B && B !== H1) metaLines.unshift(`Titres : ${H1} · Texte : ${B}`)
  else metaLines.unshift('Une seule famille pour tout le produit.')
  metaLines.forEach((l, i) => text(ctx, l, 96, 566 + i * 32, { font: F(500, 20, B), color: t.muted }))
  ;['ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz', '0123456789 € ’ — àéèêç'].forEach((l, i) => {
    const s = fitSize(ctx, l, 560, 600, B, 24, 14)
    text(ctx, l, 96, 670 + i * 38, { font: F(600, s, B), color: t.ink, spacing: 0.3 })
  })

  // Échelle de graisses
  const avail = ws.length ? ws : [400, 700]
  const pick = [800, 700, 600, 500, 400].filter((w) => avail.includes(w))
  const weights = (pick.length >= 3 ? pick : [...avail].sort((a2, b2) => b2 - a2)).slice(0, 5)
  const sample = (() => {
    const words = (d.tagline || d.name).split(/\s+/)
    let s = ''
    for (const w of words) {
      if ((s + ' ' + w).trim().length > 22) break
      s = (s + ' ' + w).trim()
    }
    return (s || d.name).replace(/[,.;:!?]+$/, '')
  })()
  const x0 = 760
  const x1 = W - 96
  const rowH = 89
  let y = 148
  ctx.fillStyle = t.line
  ctx.fillRect(x0, y, x1 - x0, 1)
  weights.forEach((w) => {
    const size = fitSize(ctx, sample, 520, w, H1, 42, 20, -0.03)
    text(ctx, sample, x0, y + 58, { font: F(w, size, H1), color: t.ink, spacing: -0.03 * size })
    text(ctx, `${WEIGHT_NAMES[w] || w} ${w}`, x1, y + 56, { font: F(600, 15, B), color: t.muted, align: 'right' })
    y += rowH
    ctx.fillStyle = t.line
    ctx.fillRect(x0, y, x1 - x0, 1)
  })

  // Spécimen
  const cy = y + 38
  const ch = 280
  fillRR(ctx, x0, cy, x1 - x0, ch, 20, t.surface)
  eyebrow(ctx, d.name, x0 + 38, cy + 58, t.primary, B)
  const n = para(ctx, d.tagline || d.name, x0 + 38, cy + 112, { font: F(800, 40, H1), color: t.ink, maxWidth: x1 - x0 - 76, lineHeight: 46, maxLines: 2, spacing: -1.2 })
  if (d.description) para(ctx, d.description, x0 + 38, cy + 112 + n * 46 + 10, { font: F(400, 19, B), color: t.muted, maxWidth: x1 - x0 - 76, lineHeight: 29, maxLines: n > 1 ? 2 : 3 })
  footer(ctx, d, 3, t.muted, t.ink)
}

function drawUi(ctx, d, a, t) {
  const H1 = d.fonts.heading?.family
  const B = d.fonts.body?.family || H1
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1900)
  g.addColorStop(0, mix(t.primary, '#FFFFFF', 0.12))
  g.addColorStop(0.45, t.primary)
  g.addColorStop(1, t.strong)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  const onBg = onColor(t.primary)
  const dim = onBg === '#FFFFFF' ? alpha('#FFFFFF', 0.72) : alpha(t.ink, 0.65)
  eyebrow(ctx, 'Interface', 96, 112, dim, B)
  text(ctx, 'Composants & écran d’accueil', 96, 196, { font: F(800, 64, H1), color: onBg, spacing: -2.2 })

  // Navigateur
  const bx = 96
  const by = 250
  const bw = 1000
  const shotH = a.desktop ? Math.min(660, Math.round((bw * a.desktop.naturalHeight) / a.desktop.naturalWidth)) : 625
  shadow(ctx, 'rgba(5,4,60,.45)', 80, 36)
  fillRR(ctx, bx, by, bw, 40 + shotH, 16, '#FFFFFF')
  noShadow(ctx)
  ctx.save()
  rr(ctx, bx, by, bw, 40 + shotH, 16)
  ctx.clip()
  ctx.fillStyle = '#EEF1F5'
  ctx.fillRect(bx, by, bw, 40)
  ;['#FF5F57', '#FEBC2E', '#28C840'].forEach((c, i) => fillRR(ctx, bx + 18 + i * 20, by + 14, 12, 12, 6, c))
  fillRR(ctx, bx + 90, by + 8, bw - 110, 24, 7, '#FFFFFF')
  text(ctx, d.domain, bx + 104, by + 20, { font: F(600, 13, B), color: t.muted, baseline: 'middle' })
  if (a.desktop) drawCoverTop(ctx, a.desktop, bx, by + 40, bw, shotH)
  else placeholder(ctx, bx, by + 40, bw, shotH, 0, t, 'Capture d’écran indisponible')
  ctx.restore()

  // Colonne de composants
  const sx = 1136
  const sw = W - 96 - sx
  let y = 250
  const card = (h, label) => {
    fillRR(ctx, sx, y, sw, h, 16, '#FFFFFF')
    text(ctx, label.toUpperCase(), sx + 22, y + 34, { font: F(800, 12, B), color: t.muted, spacing: 1.7 })
    const top = y
    y += h + 18
    return top
  }
  const r = Math.max(4, Math.min(d.radius || 10, 24))

  let top = card(182, `Boutons · rayon ${d.radius || 0} px`)
  fillRR(ctx, sx + 22, top + 54, sw - 44, 48, r, t.primary)
  icon(ctx, ICONS[5], sx + sw / 2 - 62, top + 68, 20, onColor(t.primary))
  text(ctx, 'Rechercher', sx + sw / 2 + 12, top + 79, { font: F(700, 18, B), color: onColor(t.primary), align: 'center', baseline: 'middle' })
  fillRR(ctx, sx + 22, top + 112, sw - 44, 48, r, '#FFFFFF', t.line)
  text(ctx, 'Connexion', sx + sw / 2, top + 137, { font: F(700, 18, B), color: t.ink, align: 'center', baseline: 'middle' })

  const badges = [
    t.success && { label: '● Confirmé', bg: mix(t.success, '#FFFFFF', 0.88), fg: mix(t.success, '#000000', 0.15) },
    t.warning && { label: '● En attente', bg: mix(t.warning, '#FFFFFF', 0.85), fg: mix(t.warning, '#000000', 0.25) },
    t.danger && { label: '● Annulé', bg: mix(t.danger, '#FFFFFF', 0.88), fg: mix(t.danger, '#000000', 0.15) },
    { label: 'Nouveau', bg: t.soft, fg: t.primary },
    !t.success && { label: 'Populaire', bg: mix(t.ink, '#FFFFFF', 0.93), fg: t.ink },
  ].filter(Boolean)
  top = card(106, 'Badges & statuts')
  let bxp = sx + 22
  ctx.font = F(700, 14, B)
  for (const b of badges) {
    const w = ctx.measureText(b.label).width + 24
    if (bxp + w > sx + sw - 22) break
    fillRR(ctx, bxp, top + 52, w, 32, 16, b.bg)
    text(ctx, b.label, bxp + 12, top + 69, { font: F(700, 14, B), color: b.fg, baseline: 'middle' })
    bxp += w + 8
  }

  top = card(120, d.iconLibrary ? `Icônes · ${d.iconLibrary}` : 'Icônes')
  ICONS.slice(0, 5).forEach((p, i) => {
    const ix = sx + 22 + i * 56
    fillRR(ctx, ix, top + 52, 46, 46, Math.min(r, 14), t.soft)
    icon(ctx, p, ix + 12, top + 64, 22, t.primary)
  })

  top = card(116, 'Symbole')
  if (a.icon) {
    ctx.save()
    rr(ctx, sx + 22, top + 46, 56, 56, 14)
    ctx.clip()
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(sx + 22, top + 46, 56, 56)
    drawContain(ctx, a.icon, sx + 22, top + 46, 56, 56)
    ctx.restore()
  } else fillRR(ctx, sx + 22, top + 46, 56, 56, 14, t.primary)
  text(ctx, 'Icône de l’application', sx + 96, top + 68, { font: F(800, 17, B), color: t.ink })
  text(ctx, 'Onglet, favoris, écran d’accueil', sx + 96, top + 92, { font: F(500, 14, B), color: t.muted })

  // Technologies détectées : logos officiels
  const stack = (a.stack || []).slice(0, 12)
  if (stack.length) {
    const perRow = 6
    const rows = Math.ceil(stack.length / perRow)
    top = card(60 + rows * 50, `Technologies · ${stack.length}`)
    stack.forEach(({ img, name }, k) => {
      const ix = sx + 22 + (k % perRow) * 52
      const iy = top + 50 + Math.floor(k / perRow) * 50
      fillRR(ctx, ix, iy, 42, 42, 12, '#FFFFFF', t.line)
      if (img) drawContain(ctx, img, ix + 10, iy + 10, 22, 22)
      else text(ctx, name.slice(0, 2), ix + 21, iy + 22, { font: F(800, 13, B), color: t.ink, align: 'center', baseline: 'middle' })
    })
  }

  footer(ctx, d, 4, dim, onBg)
}

function drawMockup(ctx, d, a, t) {
  const H1 = d.fonts.heading?.family
  const B = d.fonts.body?.family || H1
  // Fond studio : dégradé doux teinté par la couleur principale
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, mix(t.primary, '#FFFFFF', 0.93))
  g.addColorStop(1, mix(t.primary, '#FFFFFF', 0.82))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  const glow = ctx.createRadialGradient(760, 560, 0, 760, 560, 760)
  glow.addColorStop(0, 'rgba(255,255,255,.85)')
  glow.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)

  eyebrow(ctx, 'Mockup', 96, 112, t.primary, B)
  text(ctx, d.name, 96, 186, { font: F(800, fitSize(ctx, d.name, 900, 800, H1, 60, 30, -0.035), H1), color: t.ink, spacing: -2 })
  text(ctx, d.domain, W - 96, 186, { font: F(600, 20, B), color: t.muted, align: 'right' })

  // Ordinateur portable
  const lx = 150
  const ly = 250
  const lw = 1060
  const lh = 680
  // ombre au sol
  const sh = ctx.createRadialGradient(lx + lw / 2, ly + lh + 52, 0, lx + lw / 2, ly + lh + 52, 640)
  sh.addColorStop(0, 'rgba(10,14,30,.28)')
  sh.addColorStop(1, 'rgba(10,14,30,0)')
  ctx.save()
  ctx.scale(1, 0.09)
  ctx.fillStyle = sh
  ctx.fillRect(0, (ly + lh + 52) / 0.09 - 700, W, 1400)
  ctx.restore()

  shadow(ctx, 'rgba(10,14,40,.28)', 60, 30)
  fillRR(ctx, lx, ly, lw, lh, [26, 26, 8, 8], '#16181D')
  noShadow(ctx)
  fillRR(ctx, lx + 2, ly + 2, lw - 4, lh - 2, [24, 24, 6, 6], null, 'rgba(255,255,255,.12)')
  const sx = lx + 20
  const sy = ly + 24
  const sw = lw - 40
  const sH = lh - 44
  if (a.desktop) drawCoverTop(ctx, a.desktop, sx, sy, sw, sH, 4)
  else placeholder(ctx, sx, sy, sw, sH, 4, t, 'Capture d’écran indisponible')
  fillRR(ctx, lx + lw / 2 - 4, ly + 9, 8, 8, 4, '#2B2F37')
  // reflet de l'écran
  ctx.save()
  rr(ctx, sx, sy, sw, sH, 4)
  ctx.clip()
  const refl = ctx.createLinearGradient(sx, sy, sx + sw * 0.6, sy + sH)
  refl.addColorStop(0, 'rgba(255,255,255,.10)')
  refl.addColorStop(0.45, 'rgba(255,255,255,0)')
  ctx.fillStyle = refl
  ctx.fillRect(sx, sy, sw, sH)
  ctx.restore()
  // base
  const bx = lx - 70
  const bw = lw + 140
  const byy = ly + lh
  const base = ctx.createLinearGradient(0, byy, 0, byy + 30)
  base.addColorStop(0, '#E4E7EC')
  base.addColorStop(0.55, '#C3C8D0')
  base.addColorStop(1, '#8E949E')
  fillRR(ctx, bx, byy, bw, 30, [4, 4, 22, 22], base)
  fillRR(ctx, lx + lw / 2 - 90, byy, 180, 11, [0, 0, 10, 10], '#A9AEB7')

  // Téléphone
  const pw = 330
  const ph = 676
  const px = 1170
  const py = 330
  shadow(ctx, 'rgba(10,14,40,.35)', 60, 34)
  fillRR(ctx, px, py, pw, ph, 56, '#0E0F12')
  noShadow(ctx)
  fillRR(ctx, px + 2, py + 2, pw - 4, ph - 4, 54, null, 'rgba(255,255,255,.18)')
  const ix = px + 13
  const iy = py + 13
  const iw = pw - 26
  const ih = ph - 26
  // Écran : barre d'état (heure, réseau, batterie) puis la capture en dessous de l'encoche
  const bar = 50
  ctx.save()
  rr(ctx, ix, iy, iw, ih, 44)
  ctx.clip()
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(ix, iy, iw, ih)
  const shot = a.mobile || a.desktop
  if (shot) drawCoverTop(ctx, shot, ix, iy + bar, iw, ih - bar)
  else placeholder(ctx, ix, iy + bar, iw, ih - bar, 0, t, 'Mobile')
  ctx.restore()
  text(ctx, '9:41', ix + 46, iy + 30, { font: F(700, 15, B), color: '#0E0F12', align: 'center', baseline: 'middle' })
  ;[4, 7, 10, 13].forEach((h, k) => fillRR(ctx, ix + iw - 84 + k * 5, iy + 36 - h, 3.5, h, 1, '#0E0F12'))
  fillRR(ctx, ix + iw - 56, iy + 23, 26, 13, 4, null, '#0E0F12')
  fillRR(ctx, ix + iw - 54, iy + 25, 19, 9, 2, '#0E0F12')
  fillRR(ctx, px + pw / 2 - 50, py + 24, 100, 28, 14, '#0E0F12')
  // boutons latéraux
  fillRR(ctx, px - 3, py + 150, 4, 60, 2, '#2A2C31')
  fillRR(ctx, px + pw - 1, py + 190, 4, 90, 2, '#2A2C31')

  footer(ctx, d, 5, t.muted, t.ink)
}

/* ------------------------------------------------------------------ */
/* Marque graphique : logo teinté, visuel, objets                       */
/* ------------------------------------------------------------------ */

/** L'image a-t-elle des zones transparentes ? (sinon on ne peut pas la recolorer) */
function hasAlpha(img) {
  try {
    const c = document.createElement('canvas')
    c.width = 48
    c.height = Math.max(1, Math.round((48 * img.naturalHeight) / img.naturalWidth))
    const x = c.getContext('2d', { willReadFrequently: true })
    x.drawImage(img, 0, 0, c.width, c.height)
    const px = x.getImageData(0, 0, c.width, c.height).data
    let clear = 0
    for (let i = 3; i < px.length; i += 4) if (px[i] < 200) clear++
    return clear / (px.length / 4) > 0.04
  } catch {
    return false
  }
}

const tintCache = new WeakMap()
/** Silhouette du logo dans une couleur unie (logo en PNG transparent ou SVG). */
function tinted(img, color) {
  let byColor = tintCache.get(img)
  if (!byColor) tintCache.set(img, (byColor = new Map()))
  if (byColor.has(color)) return byColor.get(color)
  const s = Math.min(1, 1400 / Math.max(img.naturalWidth, img.naturalHeight))
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(img.naturalWidth * s))
  c.height = Math.max(1, Math.round(img.naturalHeight * s))
  const x = c.getContext('2d')
  x.drawImage(img, 0, 0, c.width, c.height)
  x.globalCompositeOperation = 'source-in'
  x.fillStyle = color
  x.fillRect(0, 0, c.width, c.height)
  c.naturalWidth = c.width
  c.naturalHeight = c.height
  byColor.set(color, c)
  return c
}

/**
 * Logo (ou symbole) dans un cadre. `color` = version unie (négatif, monochrome…).
 * Sans logo fourni : le nom de la marque (ou son initiale) dans la police des titres.
 */
function mark(ctx, d, a, x, y, w, h, { color = null, align = 'center', symbol = false, fallback = '#111111' } = {}) {
  const img = symbol ? a.icon || a.logo : a.logo
  const canTint = symbol && a.icon ? a.iconAlpha : a.logoAlpha
  if (img) return drawContain(ctx, color && canTint ? tinted(img, color) : img, x, y, w, h, align)
  const H1 = d.fonts.heading?.family
  const str = symbol ? (d.name || 'M').trim().charAt(0).toUpperCase() : (d.name || 'Marque').trim()
  const size = fitSize(ctx, str, w, 800, H1, Math.min(h * 0.9, 260), 10, -0.03)
  text(ctx, str, align === 'left' ? x : x + w / 2, y + h / 2, {
    font: F(800, size, H1),
    color: color || fallback,
    align: align === 'left' ? 'left' : 'center',
    baseline: 'middle',
    spacing: -0.03 * size,
  })
  ctx.font = F(800, size, H1)
  return { w: ctx.measureText(str).width, h: size }
}

/** Remplit le rectangle avec l'image (object-fit: cover, centré). */
function drawCoverCenter(ctx, img, x, y, w, h, r = 0) {
  ctx.save()
  rr(ctx, x, y, w, h, r)
  ctx.clip()
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight)
  const dw = img.naturalWidth * s
  const dh = img.naturalHeight * s
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh)
  ctx.restore()
}

/** Couleurs de la marque, principale en premier (sans fond ni encre). */
function brandColors(d, t) {
  const extra = d.palette.filter((p) => !['primary', 'ink', 'bg', 'line', 'muted', 'primaryStrong', 'primarySoft'].includes(p.role)).map((p) => p.hex)
  return [t.primary, ...extra]
}

/**
 * Visuel de la marque : l'image fournie, sinon une composition à plat avec ses couleurs
 * (variantes 0, 1, 2… pour varier les publications et les affiches).
 */
function artwork(ctx, d, a, t, x, y, w, h, variant = 0, r = 0) {
  if (a.visual) return drawCoverCenter(ctx, a.visual, x, y, w, h, r)
  const cols = brandColors(d, t)
  const c1 = cols[variant % cols.length]
  const c2 = cols[(variant + 1) % cols.length] === c1 ? t.ink : cols[(variant + 1) % cols.length]
  ctx.save()
  rr(ctx, x, y, w, h, r)
  ctx.clip()
  ctx.fillStyle = c1
  ctx.fillRect(x, y, w, h)
  const m = Math.min(w, h)
  ctx.fillStyle = c2
  if (variant % 3 === 0) {
    ctx.beginPath()
    ctx.arc(x + w * 0.78, y + h * 0.3, m * 0.42, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = t.ink
    ctx.fillRect(x, y + h * 0.72, w * 0.55, h * 0.28)
  } else if (variant % 3 === 1) {
    ctx.fillRect(x + w * 0.5, y, w * 0.5, h)
    ctx.fillStyle = onColor(c2, t.ink) === '#FFFFFF' ? '#FFFFFF' : t.ink
    ctx.beginPath()
    ctx.arc(x + w * 0.5, y + h * 0.5, m * 0.22, 0, Math.PI * 2)
    ctx.fill()
  } else {
    ctx.beginPath()
    ctx.moveTo(x, y + h)
    ctx.lineTo(x + w, y + h * 0.25)
    ctx.lineTo(x + w, y + h)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
  mark(ctx, d, a, x + w * 0.12, y + h * 0.12, w * 0.4, h * 0.2, { color: onColor(c1, t.ink), align: 'left', symbol: true })
}

/** Ombre portée simple, posée au sol (ellipse floue). */
function floorShadow(ctx, cx, cy, rx, ry, a = 0.22) {
  ctx.save()
  ctx.filter = 'blur(18px)'
  ctx.fillStyle = `rgba(10,12,20,${a})`
  ctx.beginPath()
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

/** Titre de planche (libellé + titre). */
function heading(ctx, d, t, label, title, color = t.ink, labelColor = t.primary) {
  const H1 = d.fonts.heading?.family
  const B = d.fonts.body?.family || H1
  eyebrow(ctx, label, 96, 112, labelColor, B)
  text(ctx, title, 96, 192, { font: F(800, fitSize(ctx, title, W - 192, 800, H1, 62, 30, -0.035), H1), color, spacing: -2.1 })
}

/** Lignes grises figurant du texte. */
function fakeLines(ctx, x, y, w, n, color, gap = 18, h = 7) {
  for (let i = 0; i < n; i++) fillRR(ctx, x, y + i * gap, i === n - 1 ? w * 0.6 : w * (0.86 + ((i * 37) % 14) / 100), h, h / 2, color)
}

/** Cadre de téléphone ; renvoie la zone d'écran. */
function phone(ctx, x, y, w, h) {
  shadow(ctx, 'rgba(10,14,40,.32)', 50, 28)
  fillRR(ctx, x, y, w, h, w * 0.16, '#0E0F12')
  noShadow(ctx)
  const s = { x: x + 11, y: y + 11, w: w - 22, h: h - 22, r: w * 0.13 }
  return s
}

/* ---------------- Planche « Logo » (tous les types graphiques) ---------------- */

function drawLogo(ctx, d, a, t) {
  const B = d.fonts.body?.family || d.fonts.heading?.family
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, W, H)
  heading(ctx, d, t, 'Logotype', 'Logo & déclinaisons')
  const label = (str, x, y, color) => text(ctx, str.toUpperCase(), x, y, { font: F(800, 13, B), color, spacing: 1.6 })

  // Version principale + zone de protection
  const mx = 96
  const my = 240
  const mw = 860
  const mh = 600
  fillRR(ctx, mx, my, mw, mh, 22, t.surface)
  const box = mark(ctx, d, a, mx + 150, my + 170, mw - 300, mh - 340, { fallback: t.primary })
  const cx = mx + mw / 2
  const cy = my + mh / 2
  const pad = Math.max(36, Math.min(box.h * 0.35, 70))
  ctx.save()
  ctx.setLineDash([9, 8])
  ctx.strokeStyle = alpha(t.primary, 0.7)
  ctx.lineWidth = 1.5
  ctx.strokeRect(cx - box.w / 2 - pad, cy - box.h / 2 - pad, box.w + pad * 2, box.h + pad * 2)
  ctx.restore()
  label('Version principale', mx + 32, my + 48, t.muted)
  text(ctx, 'Zone de protection', mx + mw - 32, my + mh - 32, { font: F(600, 15, B), color: t.primary, align: 'right' })

  // Déclinaisons de couleur
  const vx = 984
  const vw = W - 96 - vx
  const vh = 188
  ;[
    { bg: t.primary, fg: onColor(t.primary, t.ink), name: 'Sur couleur' },
    { bg: t.ink, fg: '#FFFFFF', name: 'Négatif' },
    { bg: '#FFFFFF', fg: t.ink, name: 'Monochrome', stroke: t.line },
  ].forEach((v, i) => {
    const y = my + i * (vh + 18)
    fillRR(ctx, vx, y, vw, vh, 20, v.bg, v.stroke)
    mark(ctx, d, a, vx + 70, y + 40, vw - 140, vh - 80, { color: v.fg })
    label(v.name, vx + 24, y + 32, alpha(v.fg, 0.6))
  })

  // Symbole, avatar, tailles minimales
  const by = 870
  const bh = 210
  fillRR(ctx, 96, by, 300, bh, 20, t.surface)
  fillRR(ctx, 96 + 90, by + 40, 120, 120, 28, t.primary)
  mark(ctx, d, a, 96 + 112, by + 62, 76, 76, { color: onColor(t.primary, t.ink), symbol: true })
  label('Icône d’application', 96 + 24, by + bh - 20, t.muted)

  fillRR(ctx, 416, by, 300, bh, 20, t.surface)
  ctx.fillStyle = t.ink
  ctx.beginPath()
  ctx.arc(416 + 150, by + 100, 62, 0, Math.PI * 2)
  ctx.fill()
  mark(ctx, d, a, 416 + 112, by + 62, 76, 76, { color: '#FFFFFF', symbol: true })
  label('Avatar', 416 + 24, by + bh - 20, t.muted)

  const sx = 736
  const sw = W - 96 - sx
  fillRR(ctx, sx, by, sw, bh, 20, '#FFFFFF', t.line)
  let x = sx + 40
  ;[150, 96, 56].forEach((size) => {
    const b = mark(ctx, d, a, x, by + 100 - size * 0.3, size * 1.6, size * 0.6, { align: 'left', fallback: t.ink })
    text(ctx, `${size * 2} px`, x, by + 165, { font: F(600, 14, B), color: t.muted })
    x += Math.max(b.w, 90) + 60
  })
  label('Tailles minimales', sx + 24, by + 32, t.muted)

  footer(ctx, d, 2, t.muted, t.ink)
}

/* ---------------- Identité : papeterie & applications ---------------- */

function drawStationery(ctx, d, a, t) {
  const H1 = d.fonts.heading?.family
  const B = d.fonts.body?.family || H1
  ctx.fillStyle = t.surface
  ctx.fillRect(0, 0, W, H)
  heading(ctx, d, t, 'Papeterie', 'Papier à en-tête & cartes de visite')

  // Papier à en-tête A4
  const lx = 110
  const ly = 250
  const lw = 560
  const lh = Math.round(lw * 1.414)
  floorShadow(ctx, lx + lw / 2, ly + lh, lw * 0.45, 16)
  shadow(ctx, 'rgba(10,12,30,.16)', 40, 18)
  fillRR(ctx, lx, ly, lw, lh, 4, '#FFFFFF')
  noShadow(ctx)
  mark(ctx, d, a, lx + 48, ly + 46, 210, 64, { align: 'left', fallback: t.primary })
  text(ctx, d.domain || '', lx + lw - 48, ly + 84, { font: F(500, 12, B), color: t.muted, align: 'right' })
  text(ctx, 'Objet : proposition de collaboration', lx + 48, ly + 190, { font: F(700, 15, B), color: t.ink })
  fakeLines(ctx, lx + 48, ly + 225, lw - 96, 6, mix(t.ink, '#FFFFFF', 0.86))
  fakeLines(ctx, lx + 48, ly + 355, lw - 96, 7, mix(t.ink, '#FFFFFF', 0.86))
  fakeLines(ctx, lx + 48, ly + 500, lw - 96, 4, mix(t.ink, '#FFFFFF', 0.86))
  ctx.fillStyle = t.primary
  ctx.fillRect(lx, ly + lh - 14, lw, 14)
  text(ctx, d.tagline ? d.tagline.slice(0, 60) : d.name, lx + 48, ly + lh - 44, { font: F(600, 12, B), color: t.muted })

  // Cartes de visite (85 × 55)
  const cw = 560
  const ch = Math.round((cw * 55) / 85)
  const card = (x, y, rot, front) => {
    ctx.save()
    ctx.translate(x + cw / 2, y + ch / 2)
    ctx.rotate((rot * Math.PI) / 180)
    ctx.translate(-cw / 2, -ch / 2)
    shadow(ctx, 'rgba(10,12,30,.22)', 36, 16)
    fillRR(ctx, 0, 0, cw, ch, 10, front ? t.primary : '#FFFFFF')
    noShadow(ctx)
    if (front) mark(ctx, d, a, 110, ch * 0.28, cw - 220, ch * 0.44, { color: onColor(t.primary, t.ink) })
    else {
      mark(ctx, d, a, 40, 36, 150, 48, { align: 'left', fallback: t.primary })
      text(ctx, 'Prénom Nom', 40, ch - 128, { font: F(800, 26, H1), color: t.ink, spacing: -0.5 })
      text(ctx, 'Fonction', 40, ch - 98, { font: F(500, 16, B), color: t.muted })
      text(ctx, d.domain || 'contact@marque.com', 40, ch - 46, { font: F(600, 15, B), color: t.ink })
      ctx.fillStyle = t.primary
      ctx.fillRect(cw - 14, 0, 14, ch)
    }
    ctx.restore()
  }
  card(820, 300, -4, true)
  card(880, 640, 3, false)
  footer(ctx, d, 5, t.muted, t.ink)
}

function drawApplications(ctx, d, a, t) {
  const B = d.fonts.body?.family || d.fonts.heading?.family
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, W, H)
  heading(ctx, d, t, 'Applications', 'La marque en situation')
  const gw = (W - 192 - 24) / 2
  const gh = 400
  const tiles = [
    [96, 240],
    [96 + gw + 24, 240],
    [96, 240 + gh + 24],
    [96 + gw + 24, 240 + gh + 24],
  ]
  const tag = (str, x, y) => text(ctx, str.toUpperCase(), x + 24, y + 36, { font: F(800, 13, B), color: t.muted, spacing: 1.6 })

  // 1. Tote bag
  let [x, y] = tiles[0]
  fillRR(ctx, x, y, gw, gh, 20, t.surface)
  const bw = 250
  const bh = 270
  const bx = x + gw / 2 - bw / 2
  const by = y + 100
  ctx.strokeStyle = t.ink
  ctx.lineWidth = 12
  ctx.beginPath()
  ctx.arc(bx + bw / 2, by, 70, Math.PI, 0)
  ctx.stroke()
  floorShadow(ctx, bx + bw / 2, by + bh + 6, bw * 0.55, 12, 0.18)
  fillRR(ctx, bx, by, bw, bh, 6, t.ink)
  mark(ctx, d, a, bx + 40, by + 80, bw - 80, 110, { color: t.primary === t.ink ? '#FFFFFF' : t.primary })
  tag('Tote bag', x, y)

  // 2. Gobelet
  ;[x, y] = tiles[1]
  fillRR(ctx, x, y, gw, gh, 20, t.soft)
  const gx = x + gw / 2
  const top = y + 110
  const cupH = 240
  floorShadow(ctx, gx, top + cupH + 6, 110, 12, 0.18)
  ctx.fillStyle = '#FFFFFF'
  ctx.beginPath()
  ctx.moveTo(gx - 95, top)
  ctx.lineTo(gx + 95, top)
  ctx.lineTo(gx + 72, top + cupH)
  ctx.lineTo(gx - 72, top + cupH)
  ctx.closePath()
  ctx.fill()
  ctx.save()
  ctx.clip()
  ctx.fillStyle = t.primary
  ctx.fillRect(gx - 100, top + 70, 200, 110)
  ctx.restore()
  fillRR(ctx, gx - 105, top - 24, 210, 28, 8, t.ink)
  mark(ctx, d, a, gx - 60, top + 92, 120, 66, { color: onColor(t.primary, t.ink), symbol: true })
  tag('Gobelet', x, y)

  // 3. Enseigne
  ;[x, y] = tiles[2]
  fillRR(ctx, x, y, gw, gh, 20, t.ink)
  const ex = x + gw / 2
  const ey = y + 220
  ctx.strokeStyle = alpha('#FFFFFF', 0.5)
  ctx.lineWidth = 6
  ctx.beginPath()
  ctx.moveTo(x + 80, y + 80)
  ctx.lineTo(ex, y + 80)
  ctx.lineTo(ex, ey - 120)
  ctx.stroke()
  ctx.fillStyle = t.primary
  ctx.beginPath()
  ctx.arc(ex, ey, 120, 0, Math.PI * 2)
  ctx.fill()
  mark(ctx, d, a, ex - 78, ey - 52, 156, 104, { color: onColor(t.primary, t.ink), symbol: true })
  text(ctx, 'ENSEIGNE', x + 24, y + 36, { font: F(800, 13, B), color: alpha('#FFFFFF', 0.6), spacing: 1.6 })

  // 4. Profil réseaux sociaux
  ;[x, y] = tiles[3]
  fillRR(ctx, x, y, gw, gh, 20, t.surface)
  const px = x + 60
  const py = y + 80
  fillRR(ctx, px, py, gw - 120, gh - 120, 18, '#FFFFFF')
  ctx.fillStyle = t.primary
  ctx.beginPath()
  ctx.arc(px + 70, py + 70, 44, 0, Math.PI * 2)
  ctx.fill()
  mark(ctx, d, a, px + 44, py + 44, 52, 52, { color: onColor(t.primary, t.ink), symbol: true })
  text(ctx, d.name, px + 132, py + 62, { font: F(800, 22, d.fonts.heading?.family), color: t.ink })
  text(ctx, d.domain || `@${(d.name || 'marque').toLowerCase().replace(/[^a-z0-9]+/g, '')}`, px + 132, py + 90, { font: F(500, 15, B), color: t.muted })
  const cell = (gw - 120 - 48 - 16) / 3
  for (let i = 0; i < 3; i++) artwork(ctx, d, a, t, px + 24 + i * (cell + 8), py + 132, cell, cell * 0.95, i, 8)
  tag('Profil', x, y)

  footer(ctx, d, 6, t.muted, t.ink)
}

/* ---------------- Packaging ---------------- */

/** Boîte en perspective : face avant, côté et dessus. */
function box3d(ctx, d, a, t, x, y, w, h, depth, front, side) {
  const dx = depth * 0.8
  const dy = depth * 0.45
  // côté
  ctx.fillStyle = side
  ctx.beginPath()
  ctx.moveTo(x + w, y)
  ctx.lineTo(x + w + dx, y - dy)
  ctx.lineTo(x + w + dx, y + h - dy)
  ctx.lineTo(x + w, y + h)
  ctx.closePath()
  ctx.fill()
  // dessus
  ctx.fillStyle = mix(front, '#FFFFFF', 0.25)
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x + dx, y - dy)
  ctx.lineTo(x + w + dx, y - dy)
  ctx.lineTo(x + w, y)
  ctx.closePath()
  ctx.fill()
  // face
  ctx.fillStyle = front
  ctx.fillRect(x, y, w, h)
  // texte vertical sur le côté
  ctx.save()
  ctx.transform(dx / 100, -dy / 100, 0, 1, x + w, y)
  ctx.translate(50, h / 2)
  ctx.rotate(-Math.PI / 2)
  text(ctx, (d.name || '').toUpperCase(), 0, 0, { font: F(800, 22, d.fonts.heading?.family), color: onColor(side, t.ink), align: 'center', baseline: 'middle', spacing: 4 })
  ctx.restore()
}

function drawPackaging(ctx, d, a, t) {
  const H1 = d.fonts.heading?.family
  const B = d.fonts.body?.family || H1
  ctx.fillStyle = t.surface
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = mix(t.surface, t.ink, 0.06)
  ctx.fillRect(0, 900, W, H - 900)
  heading(ctx, d, t, 'Packaging', 'Boîte & contenant')

  // Boîte
  const bx = 190
  const by = 380
  const bw = 430
  const bh = 520
  floorShadow(ctx, bx + bw / 2 + 60, by + bh + 4, bw * 0.62, 18, 0.25)
  const side = mix(t.primary, '#000000', 0.25)
  box3d(ctx, d, a, t, bx, by, bw, bh, 200, t.primary, side)
  const fg = onColor(t.primary, t.ink)
  mark(ctx, d, a, bx + 60, by + 70, bw - 120, 130, { color: fg })
  ctx.fillStyle = alpha(fg, 0.85)
  ctx.fillRect(bx + 60, by + 240, 60, 4)
  para(ctx, d.tagline || d.name, bx + 60, by + 300, { font: F(800, 34, H1), color: fg, maxWidth: bw - 120, lineHeight: 40, maxLines: 3, spacing: -0.8 })
  text(ctx, 'Édition 01', bx + 60, by + bh - 50, { font: F(600, 17, B), color: alpha(fg, 0.75) })

  // Pot
  const jx = 1010
  const jw = 300
  const jy = 520
  const jh = 380
  floorShadow(ctx, jx + jw / 2, jy + jh + 2, jw * 0.6, 14, 0.25)
  fillRR(ctx, jx, jy, jw, jh, [30, 30, 24, 24], '#FFFFFF')
  fillRR(ctx, jx - 8, jy - 60, jw + 16, 74, 14, t.ink)
  const label = brandColors(d, t)[1] || t.primary
  ctx.fillStyle = label
  ctx.fillRect(jx, jy + 90, jw, 210)
  mark(ctx, d, a, jx + 40, jy + 120, jw - 80, 90, { color: onColor(label, t.ink) })
  text(ctx, (d.name || '').toUpperCase(), jx + jw / 2, jy + 262, { font: F(700, 15, B), color: onColor(label, t.ink), align: 'center', spacing: 3 })

  footer(ctx, d, 5, t.muted, t.ink)
}

function drawLabels(ctx, d, a, t) {
  const H1 = d.fonts.heading?.family
  const B = d.fonts.body?.family || H1
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, W, H)
  heading(ctx, d, t, 'Étiquettes', 'Une gamme, plusieurs déclinaisons')
  const cols = [...new Set([...brandColors(d, t), t.ink])].slice(0, 3)
  while (cols.length < 3) cols.push(mix(t.primary, cols.length === 1 ? '#FFFFFF' : '#000000', 0.35))
  const w = 340
  const gap = (W - 192 - w * 3) / 2
  cols.forEach((c, i) => {
    const x = 96 + i * (w + gap)
    const y = 330
    const h = 600
    floorShadow(ctx, x + w / 2, y + h, w * 0.55, 14, 0.2)
    // flacon
    fillRR(ctx, x + w / 2 - 60, y - 70, 120, 90, 14, t.ink)
    fillRR(ctx, x, y, w, h, [60, 60, 28, 28], mix(c, '#FFFFFF', 0.82))
    // étiquette
    const lx = x + 30
    const ly = y + 150
    const lw = w - 60
    const lh = 330
    fillRR(ctx, lx, ly, lw, lh, 10, c)
    const fg = onColor(c, t.ink)
    mark(ctx, d, a, lx + 40, ly + 40, lw - 80, 90, { color: fg })
    ctx.fillStyle = alpha(fg, 0.6)
    ctx.fillRect(lx + 40, ly + 160, lw - 80, 2)
    text(ctx, `Édition 0${i + 1}`, lx + lw / 2, ly + 210, { font: F(800, 30, H1), color: fg, align: 'center', spacing: -0.6 })
    text(ctx, c.toUpperCase(), lx + lw / 2, ly + 290, { font: '15px ui-monospace, Consolas, monospace', color: alpha(fg, 0.8), align: 'center' })
  })
  footer(ctx, d, 6, t.muted, t.ink)
}

/* ---------------- Réseaux sociaux ---------------- */

const handleOf = (d) => d.domain || `@${(d.name || 'marque').toLowerCase().replace(/[^a-z0-9]+/g, '')}`

/** Publication carrée (variantes pour un feed varié). */
function post(ctx, d, a, t, x, y, s, i) {
  const H1 = d.fonts.heading?.family
  const cols = brandColors(d, t)
  const kind = i % 6
  if (kind === 0 || kind === 3) return artwork(ctx, d, a, t, x, y, s, s, i, 6)
  const bg = kind === 1 ? t.primary : kind === 2 ? t.ink : kind === 4 ? t.surface : cols[1] || mix(t.primary, '#000000', 0.2)
  fillRR(ctx, x, y, s, s, 6, bg, kind === 4 ? t.line : null)
  const fg = kind === 2 ? '#FFFFFF' : onColor(bg, t.ink)
  if (kind === 1) para(ctx, d.tagline || d.name, x + s * 0.1, y + s * 0.3, { font: F(800, s * 0.1, H1), color: fg, maxWidth: s * 0.8, lineHeight: s * 0.115, maxLines: 4, spacing: -0.5 })
  else if (kind === 2) mark(ctx, d, a, x + s * 0.18, y + s * 0.3, s * 0.64, s * 0.4, { color: fg })
  else if (kind === 4) {
    text(ctx, '«', x + s * 0.1, y + s * 0.32, { font: F(800, s * 0.22, H1), color: t.primary })
    para(ctx, d.description || d.tagline || d.name, x + s * 0.1, y + s * 0.42, { font: F(700, s * 0.07, H1), color: t.ink, maxWidth: s * 0.8, lineHeight: s * 0.085, maxLines: 4 })
  } else {
    text(ctx, 'Nouveau', x + s * 0.1, y + s * 0.55, { font: F(800, s * 0.16, H1), color: fg, spacing: -1 })
    mark(ctx, d, a, x + s * 0.1, y + s * 0.68, s * 0.4, s * 0.12, { color: fg, align: 'left' })
  }
}

function drawFeed(ctx, d, a, t) {
  const H1 = d.fonts.heading?.family
  const B = d.fonts.body?.family || H1
  ctx.fillStyle = t.surface
  ctx.fillRect(0, 0, W, H)
  heading(ctx, d, t, 'Instagram', 'Une grille cohérente')

  // Profil
  const px = 96
  const py = 250
  const pw = 500
  fillRR(ctx, px, py, pw, 520, 22, '#FFFFFF')
  ctx.fillStyle = t.primary
  ctx.beginPath()
  ctx.arc(px + pw / 2, py + 120, 76, 0, Math.PI * 2)
  ctx.fill()
  mark(ctx, d, a, px + pw / 2 - 48, py + 72, 96, 96, { color: onColor(t.primary, t.ink), symbol: true })
  text(ctx, d.name, px + pw / 2, py + 252, { font: F(800, fitSize(ctx, d.name, pw - 80, 800, H1, 34, 18), H1), color: t.ink, align: 'center' })
  text(ctx, handleOf(d), px + pw / 2, py + 286, { font: F(500, 17, B), color: t.muted, align: 'center' })
  para(ctx, d.tagline || '', px + pw / 2, py + 336, { font: F(500, 18, B), color: t.ink, maxWidth: pw - 90, lineHeight: 26, maxLines: 3, align: 'center' })
  fillRR(ctx, px + 60, py + 430, pw - 120, 52, 12, t.primary)
  text(ctx, 'Suivre', px + pw / 2, py + 457, { font: F(700, 18, B), color: onColor(t.primary, t.ink), align: 'center', baseline: 'middle' })
  // Stories à la une
  ;['Nouveautés', 'Coulisses', 'Avis'].forEach((n, i) => {
    const cx = px + 90 + i * 160
    const cy = py + 620
    ctx.strokeStyle = t.primary
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.arc(cx, cy, 52, 0, Math.PI * 2)
    ctx.stroke()
    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, 45, 0, Math.PI * 2)
    ctx.clip()
    artwork(ctx, d, a, t, cx - 45, cy - 45, 90, 90, i + 1)
    ctx.restore()
    text(ctx, n, cx, cy + 84, { font: F(600, 15, B), color: t.ink, align: 'center' })
  })

  // Grille 3 × 3
  const s = 272
  const gap = 10
  const gx = W - 96 - (s * 3 + gap * 2)
  const gy = 250
  for (let i = 0; i < 9; i++) post(ctx, d, a, t, gx + (i % 3) * (s + gap), gy + Math.floor(i / 3) * (s + gap), s, i)
  footer(ctx, d, 5, t.muted, t.ink)
}

function drawStory(ctx, d, a, t) {
  const H1 = d.fonts.heading?.family
  const B = d.fonts.body?.family || H1
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, W, H)
  heading(ctx, d, t, 'Stories & post', 'Formats prêts à publier')
  const pw = 340
  const ph = 700

  // Story 1 : visuel + titre
  let sc = phone(ctx, 110, 270, pw, ph)
  artwork(ctx, d, a, t, sc.x, sc.y, sc.w, sc.h, 0, sc.r)
  ctx.save()
  rr(ctx, sc.x, sc.y, sc.w, sc.h, sc.r)
  ctx.clip()
  ctx.fillStyle = alpha(t.ink, 0.88)
  ctx.fillRect(sc.x, sc.y + sc.h - 250, sc.w, 250)
  ctx.restore()
  para(ctx, d.tagline || d.name, sc.x + 28, sc.y + sc.h - 200, { font: F(800, 28, H1), color: '#FFFFFF', maxWidth: sc.w - 56, lineHeight: 33, maxLines: 3, spacing: -0.5 })
  fillRR(ctx, sc.x + 28, sc.y + sc.h - 82, sc.w - 56, 50, 25, t.primary)
  text(ctx, 'En savoir plus', sc.x + sc.w / 2, sc.y + sc.h - 57, { font: F(700, 17, B), color: onColor(t.primary, t.ink), align: 'center', baseline: 'middle' })
  for (let i = 0; i < 3; i++) fillRR(ctx, sc.x + 18 + i * ((sc.w - 36) / 3), sc.y + 22, (sc.w - 36) / 3 - 6, 4, 2, i === 0 ? '#FFFFFF' : alpha('#FFFFFF', 0.45))

  // Story 2 : couleur + logo
  sc = phone(ctx, 500, 270, pw, ph)
  fillRR(ctx, sc.x, sc.y, sc.w, sc.h, sc.r, t.primary)
  const fg = onColor(t.primary, t.ink)
  mark(ctx, d, a, sc.x + 50, sc.y + 180, sc.w - 100, 130, { color: fg })
  para(ctx, d.description || d.tagline || '', sc.x + sc.w / 2, sc.y + 380, { font: F(600, 19, B), color: fg, maxWidth: sc.w - 70, lineHeight: 27, maxLines: 5, align: 'center' })
  fillRR(ctx, sc.x + 60, sc.y + sc.h - 100, sc.w - 120, 50, 25, fg)
  text(ctx, 'Découvrir', sc.x + sc.w / 2, sc.y + sc.h - 75, { font: F(700, 17, B), color: t.primary, align: 'center', baseline: 'middle' })

  // Post 4:5
  const cx = 930
  const cw = W - 96 - cx
  const cy = 300
  shadow(ctx, 'rgba(10,12,30,.14)', 40, 16)
  fillRR(ctx, cx, cy, cw, 700, 18, '#FFFFFF')
  noShadow(ctx)
  ctx.fillStyle = t.primary
  ctx.beginPath()
  ctx.arc(cx + 42, cy + 40, 20, 0, Math.PI * 2)
  ctx.fill()
  mark(ctx, d, a, cx + 30, cy + 28, 24, 24, { color: onColor(t.primary, t.ink), symbol: true })
  text(ctx, handleOf(d), cx + 74, cy + 47, { font: F(700, 16, B), color: t.ink })
  artwork(ctx, d, a, t, cx, cy + 80, cw, cw * 1.0, 1)
  icon(ctx, ICONS[0], cx + 20, cy + 100 + cw, 26, t.ink)
  icon(ctx, ICONS[2], cx + 62, cy + 100 + cw, 26, t.ink)
  para(ctx, d.tagline || d.name, cx + 20, cy + 160 + cw, { font: F(500, 16, B), color: t.ink, maxWidth: cw - 40, lineHeight: 22, maxLines: 2 })
  footer(ctx, d, 6, t.muted, t.ink)
}

/* ---------------- Print ---------------- */

/** Affiche : visuel en haut, accroche et logo en bas. */
function poster(ctx, d, a, t, x, y, w, h, { bg, variant }) {
  const H1 = d.fonts.heading?.family
  const B = d.fonts.body?.family || H1
  floorShadow(ctx, x + w / 2, y + h + 4, w * 0.45, 10, 0.18)
  shadow(ctx, 'rgba(10,12,30,.2)', 40, 18)
  ctx.fillStyle = bg
  ctx.fillRect(x, y, w, h)
  noShadow(ctx)
  const fg = onColor(bg, t.ink)
  const m = w * 0.07
  artwork(ctx, d, a, t, x + m, y + m, w - m * 2, h * 0.5, variant)
  const size = Math.round(w * 0.085)
  para(ctx, (d.tagline || d.name).toUpperCase(), x + m, y + h * 0.5 + m + size * 1.2, { font: F(800, size, H1), color: fg, maxWidth: w - m * 2, lineHeight: size * 1.02, maxLines: 3, spacing: -0.5 })
  ctx.fillStyle = alpha(fg, 0.5)
  ctx.fillRect(x + m, y + h - m - w * 0.14, w - m * 2, 1.5)
  mark(ctx, d, a, x + m, y + h - m - w * 0.11, w * 0.34, w * 0.1, { color: fg, align: 'left' })
  text(ctx, d.domain || '', x + w - m, y + h - m - w * 0.045, { font: F(600, Math.round(w * 0.028), B), color: alpha(fg, 0.8), align: 'right' })
}

function drawPoster(ctx, d, a, t) {
  ctx.fillStyle = t.surface
  ctx.fillRect(0, 0, W, H)
  heading(ctx, d, t, 'Affiches', 'Campagne d’affichage')
  const w1 = 560
  poster(ctx, d, a, t, 150, 250, w1, Math.round(w1 * 1.414), { bg: '#FFFFFF', variant: 0 })
  const w2 = 470
  poster(ctx, d, a, t, 860, 330, w2, Math.round(w2 * 1.414), { bg: t.ink, variant: 1 })
  // adhésifs
  ;[
    [150 + w1 / 2, 250],
    [860 + w2 / 2, 330],
  ].forEach(([cx, cy]) => {
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(-0.06)
    ctx.fillStyle = 'rgba(255,255,255,.65)'
    ctx.fillRect(-60, -16, 120, 32)
    ctx.restore()
  })
  footer(ctx, d, 5, t.muted, t.ink)
}

function drawFlyer(ctx, d, a, t) {
  const H1 = d.fonts.heading?.family
  const B = d.fonts.body?.family || H1
  ctx.fillStyle = t.soft
  ctx.fillRect(0, 0, W, H)
  heading(ctx, d, t, 'Flyer', 'Recto & verso')
  const w = 500
  const h = Math.round(w * 1.414)
  const sheet = (x, y, rot, draw) => {
    ctx.save()
    ctx.translate(x + w / 2, y + h / 2)
    ctx.rotate((rot * Math.PI) / 180)
    ctx.translate(-w / 2, -h / 2)
    shadow(ctx, 'rgba(10,12,30,.22)', 46, 20)
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, w, h)
    noShadow(ctx)
    draw()
    ctx.restore()
  }
  // Recto
  sheet(230, 260, -5, () => {
    artwork(ctx, d, a, t, 0, 0, w, h * 0.58, 2)
    para(ctx, d.tagline || d.name, 36, h * 0.58 + 70, { font: F(800, 38, H1), color: t.ink, maxWidth: w - 72, lineHeight: 42, maxLines: 3, spacing: -0.8 })
    fillRR(ctx, 36, h - 100, 210, 52, 26, t.primary)
    text(ctx, 'En savoir plus', 141, h - 74, { font: F(700, 17, B), color: onColor(t.primary, t.ink), align: 'center', baseline: 'middle' })
  })
  // Verso
  sheet(860, 300, 4, () => {
    ctx.fillStyle = t.primary
    ctx.fillRect(0, 0, w, 120)
    mark(ctx, d, a, 36, 30, 220, 60, { color: onColor(t.primary, t.ink), align: 'left' })
    text(ctx, 'À propos', 36, 200, { font: F(800, 28, H1), color: t.ink })
    para(ctx, d.description || d.tagline || '', 36, 244, { font: F(400, 18, B), color: t.muted, maxWidth: w - 72, lineHeight: 27, maxLines: 6 })
    fakeLines(ctx, 36, 440, w - 72, 5, mix(t.ink, '#FFFFFF', 0.88))
    ctx.fillStyle = t.line
    ctx.fillRect(36, h - 140, w - 72, 1)
    text(ctx, d.domain || '', 36, h - 92, { font: F(700, 18, B), color: t.ink })
    mark(ctx, d, a, w - 36 - 60, h - 122, 60, 60, { symbol: true, fallback: t.primary })
  })
  footer(ctx, d, 6, t.muted, t.ink)
}

/* ------------------------------------------------------------------ */
/* Couleurs depuis le logo, création d'une marque sans site            */
/* ------------------------------------------------------------------ */

const hexOf = (r, g, b) => '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase()

/** Couleurs dominantes d'une image (pixels opaques, hors blanc), de la plus présente à la moins présente. */
export async function colorsFromImage(src, max = 4) {
  const img = await loadImage(src)
  if (!img) return []
  const c = document.createElement('canvas')
  c.width = 96
  c.height = Math.max(1, Math.round((96 * img.naturalHeight) / img.naturalWidth))
  const x = c.getContext('2d', { willReadFrequently: true })
  x.drawImage(img, 0, 0, c.width, c.height)
  const px = x.getImageData(0, 0, c.width, c.height).data
  const buckets = new Map()
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 160) continue
    const [r, g, b] = [px[i], px[i + 1], px[i + 2]]
    if (r > 236 && g > 236 && b > 236) continue // fond blanc
    const k = `${r >> 4},${g >> 4},${b >> 4}`
    const e = buckets.get(k) || { n: 0, r: 0, g: 0, b: 0 }
    e.n++
    e.r += r
    e.g += g
    e.b += b
    buckets.set(k, e)
  }
  const total = [...buckets.values()].reduce((sum, e) => sum + e.n, 0)
  const list = [...buckets.values()].sort((p, q) => q.n - p.n).map((e) => ({ n: e.n, rgb: [e.r / e.n, e.g / e.n, e.b / e.n] }))
  const out = []
  for (const c2 of list) {
    // Les teintes mélangées des bords (anticrénelage) couvrent peu de surface : ignorées
    if (c2.n < total * 0.03) break
    if (out.some((o) => Math.hypot(o.rgb[0] - c2.rgb[0], o.rgb[1] - c2.rgb[1], o.rgb[2] - c2.rgb[2]) < 60)) continue
    out.push(c2)
    if (out.length >= max) break
  }
  return out.map((o) => hexOf(...o.rgb))
}

const satOf = (hex) => {
  const [r, g, b] = rgb(hex).map((v) => v / 255)
  const mx = Math.max(r, g, b)
  const mn = Math.min(r, g, b)
  return mx === 0 ? 0 : (mx - mn) / mx
}

/** Palette complète (principale, secondaires, encre, fond) à partir des couleurs d'un logo. */
export function paletteFromColors(hexes) {
  const dark = hexes.find((h) => lum(h) < 0.06)
  const colored = hexes.filter((h) => h !== dark)
  const primary = colored.sort((p, q) => satOf(q) - satOf(p))[0] || dark || '#E4572E'
  const others = hexes.filter((h) => h !== primary && h !== dark).slice(0, 2)
  return [
    { role: 'primary', hex: primary, name: 'Principale', usage: 'Logo, titres, éléments forts', token: null },
    ...others.map((hex, i) => ({ role: 'accent', hex, name: i ? 'Accent' : 'Secondaire', usage: i ? 'Touches ponctuelles' : 'Déclinaisons, fonds de couleur', token: null })),
    { role: 'ink', hex: dark || '#141414', name: 'Encre', usage: 'Textes, versions noires', token: null },
    { role: 'bg', hex: '#FFFFFF', name: 'Blanc', usage: 'Fonds, respiration', token: null },
  ]
}

/** Nouvelle marque (identité, packaging, réseaux sociaux, print), sans analyse de site. */
export async function makeBrand(kind, { name, tagline = '', description = '', domain = '', logo = null }) {
  const colors = logo ? await colorsFromImage(logo) : []
  return {
    kind,
    name: name.trim(),
    tagline,
    description,
    domain,
    url: '',
    palette: paletteFromColors(colors),
    fonts: { heading: { family: 'Poppins', source: 'google', weights: [400, 500, 600, 700, 800] }, body: { family: 'Inter', source: 'google', weights: [400, 500, 600, 700] } },
    radius: 12,
    iconLibrary: null,
    images: { logo, icon: null, visual: null },
    screenshots: {},
    manual: {},
    stack: [],
    stackIcons: {},
  }
}

/* ------------------------------------------------------------------ */
/* Rendu                                                                */
/* ------------------------------------------------------------------ */

const DRAW = {
  cover: drawCover,
  colors: drawColors,
  type: drawType,
  ui: drawUi,
  mockup: drawMockup,
  logo: drawLogo,
  stationery: drawStationery,
  applications: drawApplications,
  packaging: drawPackaging,
  labels: drawLabels,
  feed: drawFeed,
  story: drawStory,
  poster: drawPoster,
  flyer: drawFlyer,
}

/** Charge polices + images une fois. */
export async function prepareAssets(d) {
  const [logo, iconImg, desktop, mobile, visual] = await Promise.all([
    loadImage(d.images?.logo),
    loadImage(d.images?.icon),
    loadImage(d.screenshots?.desktop),
    loadImage(d.screenshots?.mobile),
    loadImage(d.images?.visual),
  ])
  await Promise.all([loadFont(d.fonts?.heading), loadFont(d.fonts?.body)])
  // Logos des technologies (seulement celles qui en ont un)
  const icons = d.stackIcons || {}
  const stack = (
    await Promise.all((d.stack || []).filter((n) => icons[n]).map(async (name) => ({ name, img: await loadImage(icons[name]) })))
  ).filter((s) => s.img)
  return {
    logo,
    icon: iconImg,
    desktop,
    mobile,
    visual,
    stack,
    logoAlpha: logo ? hasAlpha(logo) : false,
    iconAlpha: iconImg ? hasAlpha(iconImg) : false,
  }
}

export function renderBoard(key, d, assets) {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  const list = boardsFor(d.kind || 'web')
  ctx.__pos = { i: Math.max(1, list.findIndex((b) => b.key === key) + 1), n: list.length }
  DRAW[key](ctx, d, assets, themeOf(d))
  return canvas
}

export const canvasToBlob = (canvas) => new Promise((r) => canvas.toBlob(r, 'image/png'))
