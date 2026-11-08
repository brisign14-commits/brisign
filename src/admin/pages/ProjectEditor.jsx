import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowLeftRight, ExternalLink, GripVertical, ImagePlus, Star, Trash2, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { friendlyError, unwrap } from '../lib/errors'
import { isUrl, slugify, timeAgo } from '../lib/format'
import { Badge, Button, Field, Input, Panel, Select, Spinner, TagInput, Textarea, Toggle, useFeedback } from '../components/ui'
import MediaPicker from '../components/MediaPicker'

const EMPTY = {
  title: '',
  slug: '',
  category_id: '',
  project_date: '',
  description: '',
  tags: [],
  live_url: '',
  repo_url: '',
  color: '#e6e3db',
  featured: false,
  status: 'draft',
  image_url: null,
}

function validate(f) {
  const e = {}
  if (!f.title.trim()) e.title = 'Le titre est obligatoire.'
  if (f.title.length > 120) e.title = '120 caractères maximum.'
  if (!f.slug) e.slug = 'Requis.'
  else if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(f.slug)) e.slug = 'Lettres minuscules, chiffres et tirets uniquement.'
  if (!isUrl(f.live_url)) e.live_url = 'URL invalide (https://…).'
  if (!isUrl(f.repo_url)) e.repo_url = 'URL invalide (https://…).'
  if (f.description.length > 2000) e.description = '2000 caractères maximum.'
  return e
}

/** Galerie réordonnable : glisser-déposer (souris) + flèches (clavier / mobile). */
function Gallery({ items, onChange, onSetCover }) {
  const dragFrom = useRef(null)
  const [over, setOver] = useState(null)
  const moveTo = (from, to) => {
    if (to < 0 || to >= items.length || from === to) return
    const next = [...items]
    const [it] = next.splice(from, 1)
    next.splice(to, 0, it)
    onChange(next)
  }
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {items.map((m, i) => (
        <li
          key={m.id}
          draggable
          onDragStart={() => (dragFrom.current = i)}
          onDragOver={(e) => {
            e.preventDefault()
            setOver(i)
          }}
          onDragLeave={() => setOver(null)}
          onDrop={() => {
            moveTo(dragFrom.current, i)
            setOver(null)
          }}
          className={`group relative overflow-hidden rounded-md border bg-paper-2 ${over === i ? 'border-ink' : 'border-line'}`}
        >
          <img src={m.url} alt={m.alt || ''} className="aspect-[4/3] w-full object-cover" loading="lazy" />
          <span className="absolute left-1.5 top-1.5 flex items-center gap-0.5 rounded bg-card/90 px-1 py-0.5 text-[11px] font-medium">
            <GripVertical size={12} className="cursor-grab text-mute" /> {i + 1}
          </span>
          <div className="flex items-center justify-between gap-1 border-t border-line bg-card px-1.5 py-1">
            <div className="flex">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveTo(i, i - 1)} disabled={i === 0} aria-label="Déplacer à gauche">
                ‹
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveTo(i, i + 1)} disabled={i === items.length - 1} aria-label="Déplacer à droite">
                ›
              </Button>
            </div>
            <div className="flex">
              <Button variant="ghost" size="icon" className="h-7 w-7" icon={Star} onClick={() => onSetCover(m)} aria-label="Définir comme image principale" title="Image principale" />
              <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-danger" icon={X} onClick={() => onChange(items.filter((x) => x.id !== m.id))} aria-label="Retirer de la galerie" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}

export default function ProjectEditor() {
  const { id } = useParams()
  const isNew = !id
  const navigate = useNavigate()
  const { toast, confirm } = useFeedback()

  const [form, setForm] = useState(EMPTY)
  const [cover, setCover] = useState(null) // ligne media
  const [gallery, setGallery] = useState([]) // lignes media ordonnées
  const [categories, setCategories] = useState([])
  const [meta, setMeta] = useState(null) // { updated_at, sort_order, year }
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(null) // 'draft' | 'published' | null
  const [errors, setErrors] = useState({})
  const [picker, setPicker] = useState(null) // 'cover' | 'gallery' | null
  const [dirty, setDirty] = useState(false)
  const slugTouched = useRef(!isNew)

  // Chargement
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const cats = await unwrap(supabase.from('categories').select('id, name').order('sort_order').order('name'))
        if (cancelled) return
        setCategories(cats)
        if (isNew) return
        const p = await unwrap(
          supabase
            .from('projects')
            .select('*, cover:media!projects_cover_media_id_fkey(*), gallery:project_images(sort_order, media(*))')
            .eq('id', id)
            .single(),
        )
        if (cancelled) return
        setForm({
          title: p.title ?? '',
          slug: p.slug ?? slugify(p.title),
          category_id: p.category_id ?? cats.find((c) => c.name === p.category)?.id ?? '',
          project_date: p.project_date ?? (p.year ? `${p.year}-01-01` : ''),
          description: p.description ?? '',
          tags: p.tags ?? [],
          live_url: p.live_url ?? '',
          repo_url: p.repo_url ?? '',
          color: p.color || '#e6e3db',
          featured: Boolean(p.featured),
          status: p.status ?? 'published',
          image_url: p.image_url,
        })
        setCover(p.cover)
        setGallery((p.gallery ?? []).sort((a, b) => a.sort_order - b.sort_order).map((g) => g.media).filter(Boolean))
        setMeta({ updated_at: p.updated_at, sort_order: p.sort_order, year: p.year })
      } catch (e) {
        toast.error(friendlyError(e))
        if (!isNew) navigate('/admin-bri/projets', { replace: true })
      } finally {
        !cancelled && setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Avertit avant de quitter avec des modifications non enregistrées
  useEffect(() => {
    if (!dirty) return
    const h = (e) => e.preventDefault()
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  const set = (k) => (v) => {
    const value = v?.target ? v.target.value : v
    setForm((f) => {
      const next = { ...f, [k]: value }
      if (k === 'title' && !slugTouched.current) next.slug = slugify(value)
      return next
    })
    setDirty(true)
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }))
  }

  const legacyCover = !cover && form.image_url // image historique (URL sans média)
  const coverUrl = cover?.url || form.image_url
  const category = useMemo(() => categories.find((c) => c.id === form.category_id), [categories, form.category_id])

  const save = async (status) => {
    const next = { ...form, status }
    const v = validate(next)
    setErrors(v)
    if (Object.keys(v).length) return toast.error('Corrige les champs signalés.')

    setSaving(status)
    try {
      const payload = {
        title: next.title.trim(),
        slug: next.slug,
        category_id: next.category_id || null,
        category: category?.name ?? null,
        project_date: next.project_date || null,
        year: next.project_date ? new Date(next.project_date).getFullYear() : (meta?.year ?? null),
        description: next.description.trim() || null,
        tags: next.tags,
        live_url: next.live_url.trim() || null,
        repo_url: next.repo_url.trim() || null,
        color: next.color,
        featured: next.featured,
        status,
        cover_media_id: cover?.id ?? null,
        image_url: cover?.url ?? next.image_url ?? null,
      }

      let projectId = id
      if (isNew) {
        const { data: last } = await supabase.from('projects').select('sort_order').order('sort_order', { ascending: false }).limit(1).maybeSingle()
        const row = await unwrap(supabase.from('projects').insert({ ...payload, sort_order: (last?.sort_order ?? 0) + 1 }).select('id').single())
        projectId = row.id
      } else {
        await unwrap(supabase.from('projects').update(payload).eq('id', id))
      }

      // Galerie : on remplace l'ensemble pour garder l'ordre exact
      await unwrap(supabase.from('project_images').delete().eq('project_id', projectId))
      if (gallery.length) {
        await unwrap(
          supabase.from('project_images').insert(gallery.map((m, i) => ({ project_id: projectId, media_id: m.id, sort_order: i }))),
        )
      }

      setForm(next)
      setDirty(false)
      setMeta((m) => ({ ...m, updated_at: new Date().toISOString() }))
      toast.success(status === 'published' ? 'Projet publié — visible sur le portfolio.' : 'Brouillon enregistré.')
      if (isNew) navigate(`/admin-bri/projets/${projectId}`, { replace: true })
    } catch (e) {
      if (e.code === '23505') setErrors({ slug: 'Ce slug est déjà utilisé par un autre projet.' })
      toast.error(friendlyError(e))
    } finally {
      setSaving(null)
    }
  }

  const remove = async () => {
    const ok = await confirm({
      title: 'Supprimer le projet',
      message: `« ${form.title} » sera définitivement supprimé. Les images restent dans la médiathèque.`,
      confirmLabel: 'Supprimer',
      danger: true,
    })
    if (!ok) return
    try {
      await unwrap(supabase.from('projects').delete().eq('id', id))
      setDirty(false)
      toast.success('Projet supprimé.')
      navigate('/admin-bri/projets', { replace: true })
    } catch (e) {
      toast.error(friendlyError(e))
    }
  }

  const goBack = async () => {
    if (dirty && !(await confirm({ title: 'Modifications non enregistrées', message: 'Quitter sans enregistrer ?', confirmLabel: 'Quitter sans enregistrer', danger: true }))) return
    navigate('/admin-bri/projets')
  }

  if (loading) return <Spinner />

  const published = form.status === 'published'

  return (
    <>
      {/* En-tête collant avec les actions principales */}
      <div className="sticky top-14 z-20 -mx-4 mb-8 flex flex-wrap items-center gap-3 border-b border-line bg-paper/90 px-4 py-3 backdrop-blur sm:-mx-8 sm:px-8 lg:-mx-10 lg:px-10">
        <Button variant="ghost" size="icon" icon={ArrowLeft} onClick={goBack} aria-label="Retour" />
        <div className="min-w-[12rem] flex-1">
          <h1 className="truncate font-display text-xl font-bold tracking-[-0.02em]">{form.title || 'Nouveau projet'}</h1>
          <p className="flex items-center gap-2 text-xs text-mute">
            {published ? <Badge tone="success">Publié</Badge> : <Badge tone="warning">Brouillon</Badge>}
            {dirty ? 'Modifications non enregistrées' : meta?.updated_at && `Enregistré ${timeAgo(meta.updated_at)}`}
          </p>
        </div>
        {/* Mobile : boutons sur leur propre ligne, pleine largeur */}
        <div className="flex w-full flex-wrap gap-2 sm:w-auto [&>*]:flex-1 [&>*]:justify-center sm:[&>*]:flex-none">
          {!isNew && published && (
            <Button as="a" href={`/projets/${form.slug}`} target="_blank" rel="noreferrer" variant="ghost" icon={ExternalLink}>
              <span className="hidden sm:inline">Voir</span>
            </Button>
          )}
          {/* Enregistrer / Mettre à jour : grisés sans modification. Publier / Dépublier restent des actions. */}
          <Button onClick={() => save('draft')} loading={saving === 'draft'} disabled={Boolean(saving) || (!published && !dirty)}>
            {published ? 'Dépublier' : (<><span className="sm:hidden">Brouillon</span><span className="hidden sm:inline">Enregistrer le brouillon</span></>)}
          </Button>
          <Button variant="primary" onClick={() => save('published')} loading={saving === 'published'} disabled={Boolean(saving) || ((published || isNew) && !dirty)}>
            {published ? 'Mettre à jour' : 'Publier'}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Panel title="Informations">
            <div className="space-y-5">
              <Field label="Titre" required error={errors.title}>
                {({ id: fid, invalid }) => <Input id={fid} aria-invalid={invalid} value={form.title} onChange={set('title')} maxLength={120} placeholder="Nom du projet" />}
              </Field>
              <Field label="Slug (adresse)" hint={`/projets/${form.slug || '…'}`} error={errors.slug}>
                {({ id: fid, invalid }) => (
                  <Input
                    id={fid}
                    aria-invalid={invalid}
                    value={form.slug}
                    onChange={(e) => {
                      slugTouched.current = true
                      set('slug')(slugify(e.target.value))
                    }}
                  />
                )}
              </Field>
              <Field label="Description" hint={`${form.description.length}/2000`} error={errors.description}>
                {({ id: fid, invalid }) => (
                  <Textarea id={fid} aria-invalid={invalid} rows={6} value={form.description} onChange={set('description')} placeholder="Contexte, objectif, ton rôle, résultat…" />
                )}
              </Field>
              <Field label="Technologies utilisées">
                {({ id: fid }) => <TagInput id={fid} value={form.tags} onChange={set('tags')} placeholder="React, Supabase… puis Entrée" />}
              </Field>
            </div>
          </Panel>

          <Panel title="Liens">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Démo en ligne" error={errors.live_url}>
                {({ id: fid, invalid }) => <Input id={fid} aria-invalid={invalid} type="url" value={form.live_url} onChange={set('live_url')} placeholder="https://…" />}
              </Field>
              <Field label="Dépôt GitHub" error={errors.repo_url}>
                {({ id: fid, invalid }) => <Input id={fid} aria-invalid={invalid} type="url" value={form.repo_url} onChange={set('repo_url')} placeholder="https://github.com/…" />}
              </Field>
            </div>
          </Panel>

          <Panel
            title={`Galerie (${gallery.length})`}
            actions={<Button size="sm" icon={ImagePlus} onClick={() => setPicker('gallery')}>Ajouter</Button>}
          >
            {gallery.length === 0 ? (
              <button onClick={() => setPicker('gallery')} className="w-full rounded-md border border-dashed border-line-strong py-10 text-sm text-mute hover:border-ink hover:text-ink">
                Ajoute des images secondaires, affichées sur la page du projet.
              </button>
            ) : (
              <>
                <Gallery
                  items={gallery}
                  onChange={(g) => {
                    setGallery(g)
                    setDirty(true)
                  }}
                  onSetCover={(m) => {
                    setCover(m)
                    setDirty(true)
                    toast.success('Image principale mise à jour (pense à enregistrer).')
                  }}
                />
                <p className="mt-3 text-xs text-mute">Glisse les vignettes ou utilise ‹ › pour changer l’ordre. ★ définit l’image principale.</p>
              </>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Image principale">
            {coverUrl ? (
              <div>
                <img src={coverUrl} alt="" className="aspect-[4/3] w-full rounded-md bg-paper-2 object-cover" />
                {legacyCover && <p className="mt-2 text-xs text-mute">Image historique (URL externe).</p>}
                <div className="mt-3 flex gap-2">
                  <Button size="sm" icon={ArrowLeftRight} onClick={() => setPicker('cover')} className="flex-1 justify-center">
                    Remplacer
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={Trash2}
                    onClick={() => {
                      setCover(null)
                      setForm((f) => ({ ...f, image_url: null }))
                      setDirty(true)
                    }}
                    aria-label="Retirer l’image principale"
                  />
                </div>
              </div>
            ) : (
              <button onClick={() => setPicker('cover')} className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed border-line-strong text-sm text-mute hover:border-ink hover:text-ink">
                <ImagePlus size={20} strokeWidth={1.5} />
                Choisir ou téléverser
              </button>
            )}
          </Panel>

          <Panel title="Classement">
            <div className="space-y-5">
              <Field label="Catégorie" hint={<Link to="/admin-bri/categories" className="underline">Gérer</Link>}>
                {({ id: fid }) => (
                  <Select id={fid} value={form.category_id} onChange={set('category_id')}>
                    <option value="">— Aucune —</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Date de réalisation">
                {({ id: fid }) => <Input id={fid} type="date" value={form.project_date} onChange={set('project_date')} />}
              </Field>
              <Toggle checked={form.featured} onChange={set('featured')} label="Projet vedette" description="Affiché en premier sur le portfolio." />
              <Field label="Couleur de repli" hint="Si aucune image">
                {({ id: fid }) => (
                  <div className="flex items-center gap-2">
                    <input id={fid} type="color" value={form.color} onChange={set('color')} className="h-10 w-12 cursor-pointer rounded border border-line-strong bg-card p-1" />
                    <Input value={form.color} onChange={set('color')} maxLength={7} className="font-mono" />
                  </div>
                )}
              </Field>
            </div>
          </Panel>

          {!isNew && (
            <Button variant="danger" icon={Trash2} onClick={remove} className="w-full justify-center">
              Supprimer le projet
            </Button>
          )}
        </div>
      </div>

      <MediaPicker
        open={picker === 'cover'}
        onClose={() => setPicker(null)}
        onSelect={(m) => {
          setCover(m)
          setDirty(true)
        }}
      />
      <MediaPicker
        open={picker === 'gallery'}
        multiple
        exclude={gallery.map((m) => m.id)}
        onClose={() => setPicker(null)}
        onSelect={(list) => {
          setGallery((g) => [...g, ...list.filter((m) => !g.some((x) => x.id === m.id))])
          setDirty(true)
        }}
      />
    </>
  )
}
