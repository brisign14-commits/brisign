import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowDown, ArrowUp, Eye, EyeOff, FolderKanban, Pencil, Plus, Search, Star, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { friendlyError, unwrap } from '../lib/errors'
import { move, persistOrder } from '../lib/reorder'
import { timeAgo } from '../lib/format'
import { Badge, Button, EmptyState, Input, PageHeader, Spinner, useFeedback } from '../components/ui'

const SELECT = 'id, title, slug, category, year, project_date, status, featured, sort_order, image_url, updated_at, cover:media!projects_cover_media_id_fkey(url)'

const StatusBadge = ({ status }) =>
  status === 'published' ? <Badge tone="success">Publié</Badge> : <Badge tone="warning">Brouillon</Badge>

export default function ProjectsList() {
  const { toast, confirm } = useFeedback()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const status = params.get('statut') || 'all'
  const [items, setItems] = useState(null)
  const [search, setSearch] = useState('')
  const [busyId, setBusyId] = useState(null)

  const load = () =>
    unwrap(supabase.from('projects').select(SELECT).order('sort_order').order('created_at'))
      .then(setItems)
      .catch((e) => {
        toast.error(friendlyError(e))
        setItems([])
      })

  useEffect(() => {
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const visible = useMemo(
    () =>
      (items ?? []).filter(
        (p) => (status === 'all' || p.status === status) && (!search || p.title.toLowerCase().includes(search.toLowerCase())),
      ),
    [items, status, search],
  )
  const counts = useMemo(
    () => ({
      all: items?.length ?? 0,
      published: items?.filter((p) => p.status === 'published').length ?? 0,
      draft: items?.filter((p) => p.status === 'draft').length ?? 0,
    }),
    [items],
  )

  const togglePublish = async (p) => {
    const next = p.status === 'published' ? 'draft' : 'published'
    setBusyId(p.id)
    try {
      await unwrap(supabase.from('projects').update({ status: next }).eq('id', p.id))
      setItems((list) => list.map((x) => (x.id === p.id ? { ...x, status: next } : x)))
      toast.success(next === 'published' ? `« ${p.title} » est en ligne.` : `« ${p.title} » est repassé en brouillon.`)
    } catch (e) {
      toast.error(friendlyError(e))
    } finally {
      setBusyId(null)
    }
  }

  const reorder = async (p, dir) => {
    const from = items.findIndex((x) => x.id === p.id)
    const next = move(items, from, from + dir)
    if (next === items) return
    const before = items
    setItems(next)
    try {
      await persistOrder('projects', before, next)
    } catch (e) {
      setItems(before)
      toast.error(friendlyError(e))
    }
  }

  const remove = async (p) => {
    const ok = await confirm({
      title: 'Supprimer le projet',
      message: `« ${p.title} » sera définitivement supprimé du portfolio. Les images restent disponibles dans la médiathèque.`,
      confirmLabel: 'Supprimer',
      danger: true,
    })
    if (!ok) return
    try {
      await unwrap(supabase.from('projects').delete().eq('id', p.id))
      setItems((list) => list.filter((x) => x.id !== p.id))
      toast.success('Projet supprimé.')
    } catch (e) {
      toast.error(friendlyError(e))
    }
  }

  const canReorder = status === 'all' && !search

  return (
    <>
      <PageHeader
        title="Projets"
        description="Seuls les projets publiés apparaissent sur le portfolio. Les projets vedettes sont affichés en premier."
        actions={
          <Button as={Link} to="/admin-bri/projets/nouveau" variant="primary" icon={Plus}>Nouveau projet</Button>
        }
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 rounded-md bg-paper-2 p-1 text-sm">
          {[
            ['all', 'Tous'],
            ['published', 'Publiés'],
            ['draft', 'Brouillons'],
          ].map(([k, l]) => (
            <button
              key={k}
              onClick={() => setParams(k === 'all' ? {} : { statut: k })}
              className={`rounded px-3 py-1.5 ${status === k ? 'bg-card font-medium shadow-sm' : 'text-mute hover:text-ink'}`}
            >
              {l} <span className="text-mute">{counts[k]}</span>
            </button>
          ))}
        </div>
        <div className="relative sm:w-64">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-mute" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher…" className="pl-9" />
        </div>
      </div>

      {items === null ? (
        <Spinner />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title={items.length ? 'Aucun résultat' : 'Aucun projet'}
          text={items.length ? 'Modifie les filtres ou la recherche.' : 'Crée ton premier projet pour l’afficher sur le portfolio.'}
          action={!items.length && <Button variant="primary" icon={Plus} onClick={() => navigate('/admin-bri/projets/nouveau')}>Nouveau projet</Button>}
        />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-card">
          {visible.map((p, i) => {
            const cover = p.cover?.url || p.image_url
            return (
              <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 p-3 sm:flex-nowrap sm:px-4">
                <Link to={`/admin-bri/projets/${p.id}`} className="flex min-w-0 flex-1 items-center gap-4">
                  <div className="h-12 w-16 shrink-0 overflow-hidden rounded bg-paper-2">
                    {cover && <img src={cover} alt="" loading="lazy" className="h-full w-full object-cover" />}
                  </div>
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 truncate font-medium">
                      {p.title}
                      {p.featured && <Star size={13} className="shrink-0 fill-signal text-signal" aria-label="Vedette" />}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-mute">
                      <StatusBadge status={p.status} />
                      {p.category && <span>{p.category}</span>}
                      {(p.year || p.project_date) && <span>· {p.year || new Date(p.project_date).getFullYear()}</span>}
                      <span className="hidden sm:inline">· modifié {timeAgo(p.updated_at)}</span>
                    </p>
                  </div>
                </Link>

                <div className="flex w-full items-center justify-end gap-1 sm:w-auto">
                  {canReorder && (
                    <>
                      <Button variant="ghost" size="icon" icon={ArrowUp} disabled={i === 0} onClick={() => reorder(p, -1)} aria-label="Monter" />
                      <Button variant="ghost" size="icon" icon={ArrowDown} disabled={i === visible.length - 1} onClick={() => reorder(p, 1)} aria-label="Descendre" />
                    </>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={p.status === 'published' ? EyeOff : Eye}
                    loading={busyId === p.id}
                    onClick={() => togglePublish(p)}
                  >
                    {p.status === 'published' ? 'Dépublier' : 'Publier'}
                  </Button>
                  <Button as={Link} to={`/admin-bri/projets/${p.id}`} variant="ghost" size="icon" icon={Pencil} aria-label="Modifier" />
                  <Button variant="ghost" size="icon" icon={Trash2} onClick={() => remove(p)} aria-label="Supprimer" className="hover:text-danger" />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
