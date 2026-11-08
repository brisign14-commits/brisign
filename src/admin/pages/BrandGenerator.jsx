import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Download, ExternalLink, FileText, Globe, ImagePlus, Images, Link2, Package, Palette, PenTool, Pipette, Plus, Printer, RefreshCw, Rocket, Share2, Sparkles, Trash2, Wand2, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { replaceMedia, uploadMedia } from '../lib/media'
import { friendlyError, unwrap } from '../lib/errors'
import { isUrl, slugify } from '../lib/format'
import { ALL_BOARDS, boardsFor, canvasToBlob, colorsFromImage, KINDS, kindOf, makeBrand, paletteFromColors, prepareAssets, renderBoard } from '../lib/brandBoards'
import { TechIcon } from '../../components/shared'
import { Badge, Button, EmptyState, Field, Input, PageHeader, Panel, ProgressBar, Select, TagInput, Textarea, Toggle, useFeedback, Checkbox } from '../components/ui'

const STEPS = ['Lecture de la page…', 'Analyse des styles, des couleurs et des technologies…', 'Captures d’écran ordinateur et mobile…', 'Presque fini…']

const readFile = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = reject
    r.readAsDataURL(file)
  })

const joinFr = (list) => (list.length < 2 ? list.join('') : `${list.slice(0, -1).join(', ')} et ${list[list.length - 1]}`)
const HOSTING = ['Vercel', 'Netlify']

/** Description prête à publier, rédigée à partir de l'analyse (sans IA). */
function draftDescription(d) {
  const parts = []
  const tagline = (d.tagline || '').trim().replace(/[.!]*$/, '')
  const desc = (d.description || '').trim()
  if (desc && tagline && !desc.toLowerCase().includes(tagline.toLowerCase().slice(0, 30))) parts.push(`${d.name} — ${tagline}.`, desc)
  else parts.push(desc || (tagline ? `${d.name} — ${tagline}.` : d.name))
  const tech = (d.stack || []).filter((t) => !HOSTING.includes(t))
  const host = (d.stack || []).find((t) => HOSTING.includes(t))
  if (tech.length) parts.push(`Développé avec ${joinFr(tech.slice(0, 8))}${host ? `, déployé sur ${host}` : ''}.`)
  return parts.join('\n\n').slice(0, 2000)
}

const today = () => new Date().toISOString().slice(0, 10)

const KIND_ICONS = { identite: PenTool, packaging: Package, social: Share2, print: Printer, web: Globe }
/** Ce que contient chaque type (texte d'aide). */
const KIND_HELP = {
  identite: 'Couverture, logo & déclinaisons, couleurs, typographie, papeterie et applications.',
  packaging: 'Couverture, logo, couleurs, typographie, boîte & pot en 3D et gamme d’étiquettes.',
  social: 'Couverture, logo, couleurs, typographie, feed Instagram 3 × 3, stories et post.',
  print: 'Couverture, logo, couleurs, typographie, affiches et flyer recto / verso.',
  web: 'Colle le lien d’un site : couverture, couleurs, typographie, interface et mockup.',
}
/** Ce qui a été réalisé, selon le type (description de projet). */
const KIND_WORK = {
  identite: 'Création de l’identité visuelle : logo et ses déclinaisons, palette de couleurs, typographies, papeterie et applications.',
  packaging: 'Conception du packaging : identité, système d’étiquettes et déclinaisons de la gamme.',
  social: 'Direction artistique des réseaux sociaux : templates de publications, stories et grille du feed.',
  print: 'Création des supports imprimés : affiches de campagne et flyer recto / verso.',
}

/** Description de projet pour une marque graphique (sans IA). */
function draftBrandDescription(d) {
  const tagline = (d.tagline || '').trim().replace(/[.!]*$/, '')
  return [tagline ? `${d.name} — ${tagline}.` : d.name, (d.description || '').trim(), KIND_WORK[d.kind]].filter(Boolean).join('\n\n').slice(0, 2000)
}

/** Fiche projet générée à partir de l'analyse (site) ou de la marque saisie. */
function draftProject(d, categories) {
  if (d.kind && d.kind !== 'web') {
    const k = kindOf(d.kind)
    const primary = d.palette.find((p) => p.role === 'primary')?.hex || '#e6e3db'
    return {
      title: d.name,
      slug: slugify(d.name),
      category_id: categories.find((c) => k.category.test(c.name))?.id || '',
      project_date: today(),
      description: draftBrandDescription(d),
      tags: k.tools,
      live_url: '',
      repo_url: '',
      color: primary.toLowerCase(),
      featured: false,
    }
  }
  const web = categories.find((c) => /web|site/i.test(c.name))
  const primary = d.palette.find((p) => p.role === 'primary')?.hex || d.palette[0]?.hex || '#e6e3db'
  return {
    title: d.name,
    slug: slugify(d.name),
    category_id: web?.id || '',
    project_date: today(),
    description: draftDescription(d),
    tags: (d.stack || []).filter((t) => !HOSTING.includes(t)).slice(0, 10),
    live_url: d.url,
    repo_url: '',
    color: primary.toLowerCase(),
    featured: false,
  }
}

/*
 * Chaque visuel porte dans son nom de fichier une empreinte du contenu qui l'a produit :
 *   reserve-o-01-couverture.3fa9c2d1.png
 * On sait ainsi, d'une session à l'autre, si un visuel du projet est déjà à jour (rien à envoyer),
 * s'il faut le remplacer (même média, pas de doublon) ou s'il manque (nouvel envoi).
 */
const fileNameOf = (name, b, i, hash) => `${slugify(name) || 'marque'}-${String(i + 1).padStart(2, '0')}-${slugify(b.label)}${hash ? `.${hash}` : ''}.png`
const KEY_BY_LABEL = Object.fromEntries(ALL_BOARDS.map((b) => [slugify(b.label), b.key]))
const parseBoardName = (name = '') => {
  const m = /-\d{2}-([a-z-]+?)(?:\.([0-9a-f]{8}))?\.png$/.exec(name)
  return m && KEY_BY_LABEL[m[1]] ? { key: KEY_BY_LABEL[m[1]], hash: m[2] || null } : null
}

async function sha8(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))
  return [...new Uint8Array(buf)]
    .slice(0, 4)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Empreinte des visuels. Les captures automatiques changent à chaque analyse : elles ne comptent pas comme une modification. */
const fingerprint = (d) =>
  sha8(
    JSON.stringify({
      kind: d.kind || 'web',
      name: d.name,
      tagline: d.tagline,
      description: d.description,
      domain: d.domain,
      palette: d.palette,
      fonts: d.fonts,
      radius: d.radius,
      iconLibrary: d.iconLibrary,
      stack: (d.stack || []).filter((n) => d.stackIcons?.[n]),
      images: d.images,
      shots: Object.fromEntries(['desktop', 'mobile'].map((k) => [k, d.manual?.[k] ? d.screenshots?.[k] : d.screenshots?.[k] ? 'auto' : null])),
    }),
  )

/** Forme comparable d'une fiche projet (pour savoir si quelque chose a changé). */
const normFields = (p) =>
  JSON.stringify({
    title: (p.title || '').trim(),
    slug: p.slug || '',
    category_id: p.category_id || null,
    project_date: p.project_date || null,
    description: (p.description || '').trim(),
    tags: p.tags || [],
    live_url: (p.live_url || '').trim() || null,
    repo_url: (p.repo_url || '').trim() || null,
    color: (p.color || '').toLowerCase(),
    featured: Boolean(p.featured),
  })

/** Visuels déjà présents dans un projet (galerie + image principale), indexés par planche. */
async function loadProjectBoards(projectId, coverId) {
  const [{ data: rows }, { data: cover }] = await Promise.all([
    supabase.from('project_images').select('media(*)').eq('project_id', projectId),
    coverId ? supabase.from('media').select('*').eq('id', coverId).maybeSingle() : Promise.resolve({ data: null }),
  ])
  const out = {}
  for (const m of [cover, ...(rows ?? []).map((r) => r.media)].filter(Boolean)) {
    const info = parseBoardName(m.name)
    if (info && !out[info.key]) out[info.key] = m
  }
  return out
}

export default function BrandGenerator() {
  const { toast } = useFeedback()
  const [kind, setKind] = useState('identite')
  const [brandName, setBrandName] = useState('')
  const [brandLogo, setBrandLogo] = useState(null)
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(0)
  const [data, setData] = useState(null)
  const [previews, setPreviews] = useState({}) // key -> dataURL
  const [rendering, setRendering] = useState(false)
  const [selected, setSelected] = useState(() => new Set(boardsFor('identite').map((b) => b.key)))
  const boards = useMemo(() => boardsFor(data?.kind || 'web'), [data?.kind])
  const isWeb = !data?.kind || data.kind === 'web'

  const [projects, setProjects] = useState([])
  const [categories, setCategories] = useState([])
  const [targetId, setTargetId] = useState('') // '' = nouveau projet
  const [target, setTarget] = useState(null) // ligne complète du projet existant
  const [proj, setProj] = useState(null) // fiche projet en cours d'édition
  const [errors, setErrors] = useState({})
  const [useCover, setUseCover] = useState(true)
  const [saving, setSaving] = useState(null) // { status, progress }
  const [published, setPublished] = useState(null) // { id, slug, status }

  const [renderHash, setRenderHash] = useState(null) // empreinte des visuels affichés
  const [existingBoards, setExistingBoards] = useState({}) // key -> média déjà dans le projet cible
  const [baseline, setBaseline] = useState(null) // fiche telle qu'enregistrée (comparaison)

  const canvases = useRef({})
  const uploaded = useRef({}) // `${key}:${hash}` -> média envoyé pendant cette session (hors projet)
  const slugTouched = useRef(false)

  useEffect(() => {
    Promise.all([
      supabase.from('projects').select('id, title, slug, cover_media_id, live_url, status').order('sort_order'),
      supabase.from('categories').select('id, name').order('sort_order').order('name'),
    ]).then(([p, c]) => {
      setProjects(p.data ?? [])
      setCategories(c.data ?? [])
    })
  }, [])

  /* ---------- Analyse ---------- */
  const analyze = async (e) => {
    e?.preventDefault()
    if (!url.trim()) return
    setLoading(true)
    setStep(0)
    setData(null)
    setPreviews({})
    setPublished(null)
    setErrors({})
    const timer = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 3500)
    try {
      const { data: s } = await supabase.auth.getSession()
      const r = await fetch('/api/brand-extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.session?.access_token ?? ''}` },
        body: JSON.stringify({ url: url.trim() }),
      })
      const json = await r.json().catch(() => ({ error: r.status === 404 ? 'Service d’analyse introuvable (route /api/brand-extract).' : 'Réponse invalide du serveur.' }))
      if (!r.ok) throw new Error(json.error || `Erreur ${r.status}`)
      json.kind = 'web'
      setData(json)
      setSelected(new Set(boardsFor('web').map((b) => b.key)))
      slugTouched.current = false
      // Projet existant avec le même site ?
      const match = projects.find((p) => p.live_url && p.live_url.includes(json.domain))
      await chooseTarget(match?.id || '', json)
      if (json.screenshots?.error) toast.error(`Captures : ${json.screenshots.error} Tu peux en ajouter une à la main.`)
    } catch (err) {
      toast.error(friendlyError(err))
    } finally {
      clearInterval(timer)
      setLoading(false)
    }
  }

  /* ---------- Marque graphique (sans site) ---------- */
  const pickLogo = async (file) => {
    if (!file) return
    if (!file.type.startsWith('image/')) return toast.error('Choisis une image (SVG ou PNG transparent conseillé).')
    setBrandLogo(await readFile(file))
  }
  const createBrand = async (e) => {
    e?.preventDefault()
    if (!brandName.trim()) return toast.error('Donne un nom à la marque.')
    setLoading(true)
    setPublished(null)
    setPreviews({})
    try {
      const d = await makeBrand(kind, { name: brandName, logo: brandLogo })
      setData(d)
      setSelected(new Set(boardsFor(kind).map((b) => b.key)))
      slugTouched.current = false
      const match = projects.find((p) => p.title.trim().toLowerCase() === d.name.toLowerCase())
      await chooseTarget(match?.id || '', d)
    } catch (err) {
      toast.error(friendlyError(err))
    } finally {
      setLoading(false)
    }
  }
  /** Recalcule la palette à partir du logo actuel. */
  const paletteFromLogo = async () => {
    if (!data?.images?.logo) return toast.error('Ajoute d’abord un logo dans « Images ».')
    const colors = await colorsFromImage(data.images.logo)
    if (!colors.length) return toast.error('Aucune couleur trouvée dans le logo.')
    set({ palette: paletteFromColors(colors) })
    toast.success(`${colors.length} couleur(s) reprise(s) du logo.`)
  }
  /** Même marque, autre type de projet : on garde tout et on change les planches. */
  const switchKind = (k) => {
    setKind(k)
    if (data && data.kind !== 'web' && k !== 'web') {
      setData((d) => ({ ...d, kind: k }))
      setSelected(new Set(boardsFor(k).map((b) => b.key)))
      setProj((p) => (p ? { ...p, tags: kindOf(k).tools, category_id: categories.find((c) => kindOf(k).category.test(c.name))?.id || p.category_id } : p))
    }
  }

  /** Nouveau projet, ou projet existant : on garde ses champs remplis, on complète les vides. */
  const chooseTarget = async (id, d = data) => {
    setTargetId(id)
    setErrors({})
    const draft = draftProject(d, categories)
    if (!id) {
      setTarget(null)
      setExistingBoards({})
      setBaseline(null)
      setUseCover(true)
      setProj(draft)
      return
    }
    try {
      const row = await unwrap(supabase.from('projects').select('*').eq('id', id).single())
      const boards = await loadProjectBoards(id, row.cover_media_id)
      setTarget(row)
      setExistingBoards(boards)
      setBaseline(normFields(row))
      slugTouched.current = true
      // Pas d'image principale, ou c'est déjà notre couverture : on garde le lien
      setUseCover(!row.cover_media_id || row.cover_media_id === boards.cover?.id)
      const keep = (v, fallback) => (v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length) ? fallback : v)
      setProj({
        title: keep(row.title, draft.title),
        slug: keep(row.slug, draft.slug),
        category_id: keep(row.category_id, draft.category_id),
        project_date: keep(row.project_date, draft.project_date),
        description: keep(row.description, draft.description),
        tags: keep(row.tags, draft.tags),
        live_url: keep(row.live_url, draft.live_url),
        repo_url: row.repo_url || '',
        color: keep(row.color, draft.color),
        featured: Boolean(row.featured),
      })
    } catch (err) {
      toast.error(friendlyError(err))
    }
  }

  /* ---------- Rendu des planches (debounce) ---------- */
  useEffect(() => {
    if (!data) return
    let cancelled = false
    setRendering(true)
    setRenderHash(null)
    const t = setTimeout(async () => {
      try {
        const hash = await fingerprint(data)
        const assets = await prepareAssets(data)
        const out = {}
        for (const b of boardsFor(data.kind || 'web')) {
          if (cancelled) return
          const c = renderBoard(b.key, data, assets)
          canvases.current[b.key] = c
          out[b.key] = c.toDataURL('image/jpeg', 0.82)
          await new Promise((r) => setTimeout(r))
        }
        if (!cancelled) {
          setPreviews(out)
          setRenderHash(hash)
        }
      } catch (err) {
        if (!cancelled) toast.error(`Rendu impossible : ${err.message}`)
      } finally {
        if (!cancelled) setRendering(false)
      }
    }, 350)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [data]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- Édition de la marque ---------- */
  const set = (patch) => setData((d) => ({ ...d, ...patch }))
  const setColor = (i, patch) => setData((d) => ({ ...d, palette: d.palette.map((p, k) => (k === i ? { ...p, ...patch } : p)) }))
  const removeColor = (i) => setData((d) => ({ ...d, palette: d.palette.filter((_, k) => k !== i) }))
  const addColor = () => setData((d) => ({ ...d, palette: [...d.palette, { role: 'accent', hex: '#888888', name: 'Nouvelle couleur', usage: '', token: null }] }))
  const moveFirst = (i) =>
    setData((d) => {
      const pal = d.palette.map((p) => (p.role === 'primary' ? { ...p, role: 'accent' } : p))
      const [c] = pal.splice(i, 1)
      return { ...d, palette: [{ ...c, role: 'primary' }, ...pal] }
    })
  const setFont = (which, family) =>
    setData((d) => ({
      ...d,
      fonts: { ...d.fonts, [which]: family.trim() ? { family: family.trim(), source: 'google', weights: [400, 500, 600, 700, 800] } : which === 'body' ? null : d.fonts.heading },
    }))
  const replaceImage = async (kind, file, field) => {
    if (!file) return
    if (!file.type.startsWith('image/')) return toast.error('Choisis une image.')
    const dataUrl = await readFile(file)
    setData((d) => ({ ...d, [field]: { ...d[field], [kind]: dataUrl }, ...(field === 'screenshots' ? { manual: { ...d.manual, [kind]: true } } : {}) }))
  }
  const toggle = (key) =>
    setSelected((s) => {
      const n = new Set(s)
      n.has(key) ? n.delete(key) : n.add(key)
      return n
    })

  /* ---------- Édition de la fiche projet ---------- */
  const setP = (k) => (v) => {
    const value = v?.target ? (v.target.type === 'checkbox' ? v.target.checked : v.target.value) : v
    setProj((p) => {
      const next = { ...p, [k]: value }
      if (k === 'title' && !slugTouched.current) next.slug = slugify(value)
      return next
    })
    if (k === 'slug') slugTouched.current = true
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }))
  }

  const validate = (p) => {
    const e = {}
    if (!p.title.trim()) e.title = 'Le titre est obligatoire.'
    if (p.title.length > 120) e.title = '120 caractères maximum.'
    if (!p.slug) e.slug = 'Requis.'
    else if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.slug)) e.slug = 'Minuscules, chiffres et tirets uniquement.'
    if (!isUrl(p.live_url)) e.live_url = 'URL invalide (https://…).'
    if (!isUrl(p.repo_url)) e.repo_url = 'URL invalide (https://…).'
    if (p.description.length > 2000) e.description = '2000 caractères maximum.'
    return e
  }

  /** Slug unique : ajoute -2, -3… si un autre projet l'utilise déjà. */
  const uniqueSlug = async (slug, selfId) => {
    const { data: rows } = await supabase.from('projects').select('id, slug').like('slug', `${slug}%`)
    const taken = new Set((rows ?? []).filter((r) => r.id !== selfId).map((r) => r.slug))
    if (!taken.has(slug)) return slug
    let n = 2
    while (taken.has(`${slug}-${n}`)) n++
    return `${slug}-${n}`
  }

  const download = async (b, i) => {
    const blob = await canvasToBlob(canvases.current[b.key])
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = fileNameOf(data.name, b, i, renderHash)
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 2000)
  }

  /**
   * Visuels sélectionnés → médias, sans jamais créer de doublon :
   *  - déjà dans le projet et identique  → réutilisé tel quel (aucun envoi)
   *  - déjà dans le projet mais modifié  → fichier remplacé, même média (galerie/couverture suivent)
   *  - absent                            → nouvel envoi (ou réutilisation d'un envoi de cette session)
   */
  const uploadBoards = async (onProgress, inProject) => {
    const list = boards.map((b, i) => ({ b, i })).filter(({ b }) => selected.has(b.key))
    const out = []
    let replaced = 0
    let added = 0
    for (const [n, { b, i }] of list.entries()) {
      const prog = (p) => onProgress((n + p) / list.length)
      const existing = inProject ? existingBoards[b.key] : null
      const cacheKey = `${b.key}:${renderHash}`
      let media
      if (existing && parseBoardName(existing.name)?.hash === renderHash) media = existing
      else if (!existing && uploaded.current[cacheKey]) media = uploaded.current[cacheKey]
      else {
        const blob = await canvasToBlob(canvases.current[b.key])
        const file = new File([blob], fileNameOf(data.name, b, i, renderHash), { type: 'image/png' })
        if (existing) {
          media = await replaceMedia(existing, file, { onProgress: prog })
          replaced++
        } else {
          media = await uploadMedia(file, { folder: 'projects', onProgress: prog })
          uploaded.current[cacheKey] = media
          added++
        }
      }
      out.push({ key: b.key, media })
      onProgress((n + 1) / list.length)
    }
    return { boards: out, replaced, added }
  }

  /** status : 'media' (médiathèque seulement), 'draft' ou 'published'. */
  const persist = async (status) => {
    if (status !== 'media') {
      const v = validate(proj)
      setErrors(v)
      if (Object.keys(v).length) return toast.error('Corrige les champs signalés dans la fiche projet.')
    }
    setSaving({ status, progress: 0 })
    try {
      const inProject = status !== 'media' && Boolean(targetId)
      const { boards, replaced, added } = selected.size ? await uploadBoards((p) => setSaving({ status, progress: p * 0.85 }), inProject) : { boards: [], replaced: 0, added: 0 }
      if (status === 'media') {
        toast.success(added ? `${added} image(s) ajoutée(s) à la médiathèque.` : 'Ces images sont déjà dans la médiathèque.')
        return
      }

      const id = targetId || null
      const slug = await uniqueSlug(proj.slug, id)
      const category = categories.find((c) => c.id === proj.category_id)
      const coverItem = boards.find((b) => b.key === 'cover')
      const setAsCover = Boolean(coverItem && useCover)
      const payload = {
        title: proj.title.trim(),
        slug,
        category_id: proj.category_id || null,
        category: category?.name ?? null,
        project_date: proj.project_date || null,
        year: proj.project_date ? new Date(proj.project_date).getFullYear() : null,
        description: proj.description.trim() || null,
        tags: proj.tags,
        live_url: proj.live_url.trim() || null,
        repo_url: proj.repo_url.trim() || null,
        color: proj.color,
        featured: proj.featured,
        status,
        ...(setAsCover ? { cover_media_id: coverItem.media.id, image_url: coverItem.media.url } : {}),
      }

      let projectId = id
      if (id) await unwrap(supabase.from('projects').update(payload).eq('id', id))
      else {
        const { data: last } = await supabase.from('projects').select('sort_order').order('sort_order', { ascending: false }).limit(1).maybeSingle()
        const row = await unwrap(supabase.from('projects').insert({ ...payload, sort_order: (last?.sort_order ?? 0) + 1 }).select('id').single())
        projectId = row.id
      }
      setSaving({ status, progress: 0.93 })

      // Galerie : ajoute les planches (sans doublon), après les images existantes
      const { data: existing } = await supabase.from('project_images').select('media_id, sort_order').eq('project_id', projectId)
      const have = new Set((existing ?? []).map((r) => r.media_id))
      const start = Math.max(-1, ...(existing ?? []).map((r) => r.sort_order ?? 0)) + 1
      const gallery = boards.filter((b) => !(setAsCover && b === coverItem) && !have.has(b.media.id))
      if (gallery.length) await unwrap(supabase.from('project_images').insert(gallery.map((b, k) => ({ project_id: projectId, media_id: b.media.id, sort_order: start + k }))))
      // La couverture devient l'image principale : on ne la garde pas aussi dans la galerie
      if (setAsCover && have.has(coverItem.media.id)) await unwrap(supabase.from('project_images').delete().eq('project_id', projectId).eq('media_id', coverItem.media.id))

      // Les prochains clics mettent à jour ce projet au lieu d'en créer un autre
      const summary = { id: projectId, title: payload.title, slug, cover_media_id: setAsCover ? coverItem.media.id : target?.cover_media_id ?? null, live_url: payload.live_url, status }
      setProjects((ps) => (ps.some((p) => p.id === projectId) ? ps.map((p) => (p.id === projectId ? { ...p, ...summary } : p)) : [...ps, summary]))
      setTargetId(projectId)
      const coverId = setAsCover ? coverItem.media.id : (target?.cover_media_id ?? null)
      setTarget((t) => ({ ...(t || {}), ...payload, id: projectId, cover_media_id: coverId }))
      setProj((p) => ({ ...p, slug }))
      // Nouvelle référence : tant que rien ne change, les boutons restent grisés
      setBaseline(normFields({ ...proj, slug }))
      setExistingBoards((prev) => ({ ...prev, ...Object.fromEntries(boards.map((b) => [b.key, b.media])) }))
      slugTouched.current = true
      setPublished({ id: projectId, slug, status })
      const imgs = [added && `${added} image(s) ajoutée(s)`, replaced && `${replaced} mise(s) à jour`].filter(Boolean).join(', ')
      toast.success(`${status === 'published' ? `« ${payload.title} » est publié sur le portfolio` : `Brouillon « ${payload.title} » enregistré`}${imgs ? ` · ${imgs}` : ''}.`)
    } catch (err) {
      toast.error(friendlyError(err))
    } finally {
      setSaving(null)
    }
  }

  const count = selected.size
  const busy = Boolean(saving) || rendering || !renderHash

  /* ---------- Détection des modifications ---------- */
  const fieldsChanged = !targetId || !baseline || (proj && normFields(proj) !== baseline)
  const changedBoards = [...selected].filter((k) => parseBoardName(existingBoards[k]?.name)?.hash !== renderHash || !existingBoards[k])
  const coverChanged = Boolean(selected.has('cover') && useCover && existingBoards.cover && target?.cover_media_id !== existingBoards.cover.id)
  const visualsChanged = changedBoards.length > 0 || coverChanged
  const upToDate = (status) => Boolean(targetId) && !fieldsChanged && !visualsChanged && target?.status === status
  const mediaDone = count > 0 && [...selected].every((k) => uploaded.current[`${k}:${renderHash}`])
  const changeSummary = !targetId
    ? null
    : [fieldsChanged && 'fiche modifiée', changedBoards.length && `${changedBoards.length} visuel(s) à ${changedBoards.some((k) => existingBoards[k]) ? 'mettre à jour' : 'ajouter'}`, coverChanged && 'image principale']
        .filter(Boolean)
        .join(' · ')
  const categoryName = useMemo(() => categories.find((c) => c.id === proj?.category_id)?.name, [categories, proj?.category_id])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Visuels de marque"
        description="Choisis le type de projet : le branding complet (planches d’identité et mises en situation) et la fiche projet sont préparés automatiquement. Vérifie, puis publie en un clic."
      />

      {/* Type de projet */}
      <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-5" role="radiogroup" aria-label="Type de projet">
        {KINDS.map((k) => {
          const Icon = KIND_ICONS[k.key]
          const on = kind === k.key
          return (
            <button
              key={k.key}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => switchKind(k.key)}
              className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition ${on ? 'border-ink bg-ink text-paper' : 'border-line bg-card hover:border-line-strong'}`}
            >
              <Icon size={18} strokeWidth={1.75} />
              <span className="text-sm font-medium">{k.label}</span>
            </button>
          )
        })}
      </div>

      <Panel>
        {kind === 'web' ? (
          <form onSubmit={analyze} className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Link2 size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mute" />
              <Input type="url" inputMode="url" placeholder="https://mon-projet.vercel.app" value={url} onChange={(e) => setUrl(e.target.value)} className="pl-9" required aria-label="Lien du site" />
            </div>
            <Button type="submit" variant="primary" icon={Palette} loading={loading} disabled={!url.trim()}>
              {data?.kind === 'web' ? 'Analyser à nouveau' : 'Analyser le site'}
            </Button>
          </form>
        ) : (
          <form onSubmit={createBrand} className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <Field label="Nom de la marque" required>
              {({ id }) => <Input id={id} placeholder="ex. Nova Café" value={brandName} onChange={(e) => setBrandName(e.target.value)} maxLength={80} className="lg:w-72" />}
            </Field>
            <Field label="Logo" hint="SVG ou PNG transparent conseillé">
              {({ id }) => (
                <label htmlFor={id} className="flex h-[42px] cursor-pointer items-center gap-3 rounded-md border border-line-strong bg-card px-3 text-sm hover:border-ink lg:w-72">
                  {brandLogo ? <img src={brandLogo} alt="" className="h-7 w-auto max-w-[120px] object-contain" /> : <ImagePlus size={16} className="text-mute" />}
                  <span className="truncate text-mute">{brandLogo ? 'Changer le logo' : 'Choisir un fichier'}</span>
                  <input id={id} type="file" accept="image/*" hidden onChange={(e) => (pickLogo(e.target.files[0]), (e.target.value = ''))} />
                </label>
              )}
            </Field>
            <Button type="submit" variant="primary" icon={Sparkles} loading={loading} disabled={!brandName.trim()}>
              {data && data.kind !== 'web' ? 'Recréer la marque' : 'Créer le branding'}
            </Button>
          </form>
        )}
        <p className="mt-3 text-xs text-mute">{KIND_HELP[kind]}</p>
        {kind === 'web' && loading && (
          <div className="mt-4" role="status">
            <ProgressBar value={(step + 1) / (STEPS.length + 1)} />
            <p className="mt-2 text-xs text-mute">{STEPS[step]} (15 à 30 secondes)</p>
          </div>
        )}
        {kind === 'web' && !loading && !data && projects.some((p) => p.live_url) && (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-mute">
            <span>Tes projets :</span>
            {projects
              .filter((p) => p.live_url)
              .slice(0, 8)
              .map((p) => (
                <button key={p.id} type="button" onClick={() => setUrl(p.live_url)} className="rounded-full border border-line px-2.5 py-1 hover:border-ink hover:text-ink">
                  {p.title}
                </button>
              ))}
          </div>
        )}
      </Panel>

      {!data && !loading && (
        <EmptyState
          icon={Palette}
          title={kind === 'web' ? 'Aucun site analysé' : 'Aucune marque créée'}
          text={
            kind === 'web'
              ? 'Tu obtiens 5 images (couverture, couleurs, typographie, interface, mockup) et une fiche projet pré-remplie : titre, description, technologies, lien, couleur.'
              : 'Donne le nom de la marque et son logo : tu obtiens 6 planches prêtes à publier et une fiche projet pré-remplie. Les couleurs sont reprises du logo, tout reste modifiable.'
          }
        />
      )}

      {data && proj && (
        <>
          {/* ================= Fiche projet ================= */}
          <Panel
            title="Fiche projet"
            actions={
              <span className="flex items-center gap-2">
                {target?.status && <Badge tone={target.status === 'published' ? 'success' : 'neutral'}>{target.status === 'published' ? 'Publié' : 'Brouillon'}</Badge>}
                <Select size="sm" value={targetId} onChange={(e) => chooseTarget(e.target.value)} aria-label="Projet à remplir">
                  <option value="">+ Nouveau projet</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      Mettre à jour : {p.title}
                    </option>
                  ))}
                </Select>
              </span>
            }
          >
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="space-y-4">
                <Field label="Titre" required error={errors.title}>
                  {({ id, invalid }) => <Input id={id} aria-invalid={invalid} value={proj.title} onChange={setP('title')} maxLength={120} />}
                </Field>
                <Field label="Slug (adresse)" hint={`/projets/${proj.slug || '…'}`} error={errors.slug}>
                  {({ id, invalid }) => <Input id={id} aria-invalid={invalid} value={proj.slug} onChange={(e) => setP('slug')(slugify(e.target.value))} />}
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Catégorie">
                    {({ id }) => (
                      <Select id={id} value={proj.category_id} onChange={setP('category_id')}>
                        <option value="">Aucune</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                  <Field label="Date">{({ id }) => <Input id={id} type="date" value={proj.project_date || ''} onChange={setP('project_date')} />}</Field>
                </div>
                <Field label={isWeb ? 'Technologies' : 'Outils'} hint={isWeb && data.stack?.length ? `${data.stack.length} détectée(s)` : 'Entrée pour ajouter'}>
                  {({ id }) => <TagInput id={id} value={proj.tags} onChange={setP('tags')} />}
                </Field>
                {proj.tags.length > 0 && (
                  <div className="-mt-2 flex flex-wrap gap-1.5" aria-label="Logos des outils">
                    {proj.tags.map((tag) =>
                      isWeb && data.stackIcons?.[tag] ? (
                        <span key={tag} title={tag} className="grid h-8 w-8 place-items-center rounded-full border border-line bg-white">
                          <img src={data.stackIcons[tag]} alt={tag} className="h-4 w-4 object-contain" />
                        </span>
                      ) : (
                        <TechIcon key={tag} name={tag} size="sm" />
                      ),
                    )}
                  </div>
                )}
                <Field label={isWeb ? 'Site en ligne' : 'Lien (Behance, site du client…)'} hint={isWeb ? undefined : 'optionnel'} error={errors.live_url}>
                  {({ id, invalid }) => <Input id={id} aria-invalid={invalid} type="url" placeholder={isWeb ? undefined : 'https://www.behance.net/…'} value={proj.live_url} onChange={setP('live_url')} />}
                </Field>
                {isWeb && (
                  <Field label="Dépôt GitHub" hint="optionnel" error={errors.repo_url}>
                    {({ id, invalid }) => <Input id={id} aria-invalid={invalid} type="url" placeholder="https://github.com/…" value={proj.repo_url} onChange={setP('repo_url')} />}
                  </Field>
                )}
              </div>

              <div className="space-y-4">
                <Field label="Description" hint={`${proj.description.length} / 2000`} error={errors.description}>
                  {({ id, invalid }) => <Textarea id={id} aria-invalid={invalid} rows={9} value={proj.description} onChange={setP('description')} />}
                </Field>
                <button
                  type="button"
                  onClick={() => setP('description')(isWeb ? draftDescription(data) : draftBrandDescription(data))}
                  className="-mt-2 inline-flex items-center gap-1.5 text-xs text-mute underline-offset-4 hover:text-ink hover:underline"
                >
                  <Wand2 size={13} /> Régénérer depuis l’analyse
                </button>
                <div className="grid grid-cols-[auto_1fr] items-end gap-3">
                  <Field label="Couleur">
                    {({ id }) => (
                      <label htmlFor={id} className="relative block h-[42px] w-14 cursor-pointer overflow-hidden rounded-md border border-line-strong" style={{ background: proj.color }}>
                        <input id={id} type="color" value={proj.color?.slice(0, 7) || '#e6e3db'} onChange={setP('color')} className="absolute inset-0 cursor-pointer opacity-0" />
                      </label>
                    )}
                  </Field>
                  <div className="flex flex-wrap gap-1.5 pb-2">
                    {data.palette.slice(0, 6).map((p) => (
                      <button key={p.hex} type="button" onClick={() => setP('color')(p.hex.toLowerCase())} className="h-6 w-6 rounded-full border border-line" style={{ background: p.hex }} title={`${p.name} ${p.hex}`} aria-label={`Utiliser ${p.name}`} />
                    ))}
                  </div>
                </div>
                <Toggle checked={proj.featured} onChange={setP('featured')} label="Mettre en avant" description="Affiché en priorité sur la page d’accueil." />
                {selected.has('cover') && (
                  <Toggle
                    checked={useCover}
                    onChange={setUseCover}
                    label="Couverture = image principale"
                    description={target?.cover_media_id ? 'Le projet a déjà une image principale : activer pour la remplacer.' : 'La couverture sera l’image de la carte du projet.'}
                  />
                )}
              </div>
            </div>

            {/* Barre de publication */}
            <div className="mt-6 border-t border-line pt-5">
              {saving && (
                <div className="mb-4">
                  <ProgressBar value={saving.progress} />
                  <p className="mt-1.5 text-xs text-mute">{saving.progress < 0.85 ? 'Envoi des images…' : 'Enregistrement du projet…'}</p>
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3">
                {targetId && !fieldsChanged && !visualsChanged ? (
                  <p className="flex items-center gap-1.5 text-xs font-medium text-success" role="status">
                    <CheckCircle2 size={14} /> À jour — aucune modification détectée
                    {target?.status !== 'published' ? ' (brouillon)' : ''}
                  </p>
                ) : (
                  <p className="text-xs text-mute">
                    {targetId ? `Mise à jour : ${changeSummary || 'changement de statut'}` : `Nouveau projet · ${count} image${count > 1 ? 's' : ''} · ${categoryName || 'sans catégorie'} · ${proj.tags.length} ${isWeb ? 'technologie' : 'outil'}${proj.tags.length > 1 ? 's' : ''}`}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {!targetId && (
                    <Button variant="ghost" icon={Images} disabled={busy || !count || mediaDone} title={mediaDone ? 'Déjà dans la médiathèque' : undefined} loading={saving?.status === 'media'} onClick={() => persist('media')}>
                      Médiathèque seulement
                    </Button>
                  )}
                  <Button
                    icon={FileText}
                    disabled={busy || upToDate('draft')}
                    title={upToDate('draft') ? 'Aucune modification à enregistrer' : undefined}
                    loading={saving?.status === 'draft'}
                    onClick={() => persist('draft')}
                  >
                    {target?.status === 'published' ? 'Repasser en brouillon' : 'Brouillon'}
                  </Button>
                  <Button
                    variant="primary"
                    icon={Rocket}
                    disabled={busy || upToDate('published')}
                    title={upToDate('published') ? 'Déjà publié, aucune modification' : undefined}
                    loading={saving?.status === 'published'}
                    onClick={() => persist('published')}
                  >
                    {target?.status === 'published' ? 'Mettre à jour' : 'Publier'}
                  </Button>
                </div>
              </div>
              {published && (
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md bg-paper-2 px-4 py-3 text-sm">
                  <span className="font-medium">{published.status === 'published' ? 'En ligne sur ton portfolio.' : 'Brouillon enregistré (non visible).'}</span>
                  {published.status === 'published' && (
                    <a href={`/projets/${published.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline-offset-4 hover:underline">
                      Voir la page <ExternalLink size={13} />
                    </a>
                  )}
                  <Link to={`/admin-bri/projets/${published.id}`} className="underline-offset-4 hover:underline">
                    Ouvrir dans l’éditeur
                  </Link>
                </div>
              )}
            </div>
          </Panel>

          <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
            {/* ================= Réglages de la marque ================= */}
            <div className="space-y-6">
              <Panel title="Textes des visuels">
                <div className="space-y-4">
                  <Field label="Nom">{({ id }) => <Input id={id} value={data.name} onChange={(e) => set({ name: e.target.value })} />}</Field>
                  <Field label="Accroche">{({ id }) => <Textarea id={id} rows={2} className="min-h-0" value={data.tagline} onChange={(e) => set({ tagline: e.target.value })} />}</Field>
                  <Field label="Description courte">{({ id }) => <Textarea id={id} rows={3} className="min-h-0" value={data.description} onChange={(e) => set({ description: e.target.value })} />}</Field>
                  <Field label={isWeb ? 'Domaine affiché' : 'Site ou @compte affiché'} hint={isWeb ? undefined : 'optionnel'}>
                    {({ id }) => <Input id={id} placeholder={isWeb ? undefined : 'ex. @nova.cafe ou nova-cafe.mg'} value={data.domain} onChange={(e) => set({ domain: e.target.value })} />}
                  </Field>
                </div>
              </Panel>

              <Panel
                title={`Couleurs (${data.palette.length})`}
                actions={
                  <span className="flex gap-1">
                    {data.images?.logo && (
                      <Button size="sm" variant="ghost" icon={Pipette} onClick={paletteFromLogo} title="Reprendre les couleurs du logo">
                        Du logo
                      </Button>
                    )}
                    {data.palette.length < 9 && (
                      <Button size="sm" variant="ghost" icon={Plus} onClick={addColor}>
                        Ajouter
                      </Button>
                    )}
                  </span>
                }
              >
                <ul className="space-y-3">
                  {data.palette.map((p, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <label className="relative mt-0.5 h-10 w-10 shrink-0 cursor-pointer overflow-hidden rounded-md border border-line" style={{ background: p.hex }} title="Changer la couleur">
                        <input type="color" value={p.hex.slice(0, 7)} onChange={(e) => setColor(i, { hex: e.target.value.toUpperCase() })} className="absolute inset-0 cursor-pointer opacity-0" />
                      </label>
                      <div className="min-w-0 flex-1 space-y-1">
                        <input value={p.name} onChange={(e) => setColor(i, { name: e.target.value })} className="w-full bg-transparent text-sm font-medium outline-none focus:underline" aria-label="Nom de la couleur" />
                        <input value={p.usage} onChange={(e) => setColor(i, { usage: e.target.value })} placeholder="Usage" className="w-full bg-transparent text-xs text-mute outline-none focus:underline" aria-label="Usage" />
                        <p className="font-mono text-[11px] text-mute">
                          {p.hex}
                          {p.token ? ` · ${p.token}` : ''}
                          {p.derived ? ' · dérivée' : ''}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        {i > 0 && (
                          <button type="button" onClick={() => moveFirst(i)} className="text-[11px] text-mute hover:text-ink" title="En faire la couleur principale">
                            Principale
                          </button>
                        )}
                        <button type="button" onClick={() => removeColor(i)} className="text-mute hover:text-danger" aria-label={`Retirer ${p.name}`}>
                          <X size={15} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </Panel>

              <Panel title="Typographie & style">
                <div className="space-y-4">
                  <Field label="Police des titres" hint={data.fonts.heading?.source === 'self' ? 'police du site' : 'Google Fonts'}>
                    {({ id }) => <Input id={id} defaultValue={data.fonts.heading?.family || ''} placeholder="ex. Manrope" onBlur={(e) => e.target.value !== (data.fonts.heading?.family || '') && setFont('heading', e.target.value)} />}
                  </Field>
                  <Field label="Police du texte" hint="vide = même police">
                    {({ id }) => <Input id={id} defaultValue={data.fonts.body?.family || ''} placeholder="(identique)" onBlur={(e) => e.target.value !== (data.fonts.body?.family || '') && setFont('body', e.target.value)} />}
                  </Field>
                  {isWeb && <div className="grid grid-cols-2 gap-3">
                    <Field label="Rayon (px)">{({ id }) => <Input id={id} type="number" min={0} max={40} value={data.radius} onChange={(e) => set({ radius: Math.max(0, Math.min(40, Number(e.target.value) || 0)) })} />}</Field>
                    <Field label="Icônes">{({ id }) => <Input id={id} value={data.iconLibrary || ''} placeholder="ex. Lucide" onChange={(e) => set({ iconLibrary: e.target.value || null })} />}</Field>
                  </div>}
                </div>
              </Panel>

              <Panel title="Images">
                <div className="grid grid-cols-2 gap-3">
                  {(isWeb
                    ? [
                        ['images', 'logo', 'Logo'],
                        ['images', 'icon', 'Icône'],
                        ['screenshots', 'desktop', 'Capture ordinateur'],
                        ['screenshots', 'mobile', 'Capture mobile'],
                      ]
                    : [
                        ['images', 'logo', 'Logo'],
                        ['images', 'icon', 'Symbole (facultatif)'],
                        ['images', 'visual', 'Visuel : photo, illustration'],
                      ]
                  ).map(([field, kind, label]) => {
                    const src = data[field]?.[kind]
                    return (
                      <div key={kind} className="rounded-md border border-line p-2">
                        <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded bg-paper-2">
                          {src ? <img src={src} alt="" className={`max-h-full max-w-full ${field === 'screenshots' ? 'h-full w-full object-cover object-top' : 'object-contain p-2'}`} /> : <span className="text-xs text-mute">Aucune</span>}
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-1">
                          <span className="truncate text-xs font-medium">{label}</span>
                          <span className="flex gap-0.5">
                            <label className="cursor-pointer rounded p-1 text-mute hover:bg-paper-2 hover:text-ink" title="Remplacer">
                              <ImagePlus size={14} />
                              <input type="file" accept="image/*" hidden onChange={(e) => (replaceImage(kind, e.target.files[0], field), (e.target.value = ''))} />
                            </label>
                            {src && (
                              <button type="button" className="rounded p-1 text-mute hover:bg-paper-2 hover:text-danger" title="Retirer" onClick={() => setData((d) => ({ ...d, [field]: { ...d[field], [kind]: null } }))}>
                                <Trash2 size={14} />
                              </button>
                            )}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Panel>
            </div>

            {/* ================= Aperçu des 5 images ================= */}
            <Panel
              title="Images du projet"
              actions={
                <span className="flex items-center gap-2 text-xs text-mute">
                  {rendering && <RefreshCw size={13} className="animate-spin" />}
                  {count} / {boards.length} sélectionnée{count > 1 ? 's' : ''}
                </span>
              }
            >
              <div className="grid gap-4 md:grid-cols-2">
                {boards.map((b, i) => (
                  <figure key={b.key} className={`relative overflow-hidden rounded-lg border transition ${selected.has(b.key) ? 'border-ink' : 'border-line opacity-55'} ${i === 0 ? 'md:col-span-2' : ''}`}>
                    {previews[b.key] ? <img src={previews[b.key]} alt={b.label} className="block aspect-[4/3] w-full bg-paper-2 object-cover" /> : <div className="aspect-[4/3] w-full animate-pulse bg-paper-2" />}
                    <figcaption className="flex items-center justify-between gap-2 border-t border-line bg-card px-3 py-2">
                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <Checkbox checked={selected.has(b.key)} onChange={() => toggle(b.key)} />
                        <span className="font-medium">
                          {String(i + 1).padStart(2, '0')} · {b.label}
                          {i === 0 && useCover && selected.has('cover') ? <span className="ml-2 text-xs font-normal text-mute">image principale</span> : null}
                        </span>
                      </label>
                      <button type="button" onClick={() => download(b, i)} disabled={!previews[b.key]} className="rounded p-1.5 text-mute hover:bg-paper-2 hover:text-ink disabled:opacity-40" aria-label={`Télécharger ${b.label}`}>
                        <Download size={15} />
                      </button>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </Panel>
          </div>
        </>
      )}
    </div>
  )
}
