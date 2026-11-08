import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeftRight, Copy, Images, Search, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { friendlyError, unwrap } from '../lib/errors'
import { ACCEPTED_TYPES, deleteMedia, formatBytes, getMediaUsage, replaceMedia } from '../lib/media'
import { formatDate } from '../lib/format'
import { Badge, Button, EmptyState, Field, Input, Modal, PageHeader, Panel, ProgressBar, Select, Spinner, useFeedback } from '../components/ui'
import Uploader from '../components/Uploader'

export default function MediaLibrary() {
  const { toast, confirm } = useFeedback()
  const [items, setItems] = useState(null)
  const [usage, setUsage] = useState({})
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [folder, setFolder] = useState('projects')
  const [detail, setDetail] = useState(null)
  const [alt, setAlt] = useState('')
  const [progress, setProgress] = useState(null)
  const replaceInput = useRef(null)

  const load = useCallback(async () => {
    try {
      const [list, u] = await Promise.all([unwrap(supabase.from('media').select('*').order('created_at', { ascending: false })), getMediaUsage()])
      setItems(list)
      setUsage(u)
    } catch (e) {
      toast.error(friendlyError(e))
      setItems([])
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load()
  }, [load])

  const visible = useMemo(
    () =>
      (items ?? []).filter((m) => {
        if (filter === 'unused' && usage[m.id]?.length) return false
        if (filter !== 'all' && filter !== 'unused' && m.folder !== filter) return false
        return !search || (m.name || m.path).toLowerCase().includes(search.toLowerCase())
      }),
    [items, usage, filter, search],
  )

  const open = (m) => {
    setDetail(m)
    setAlt(m.alt ?? '')
  }

  const saveAlt = async () => {
    try {
      const row = await unwrap(supabase.from('media').update({ alt: alt.trim() || null }).eq('id', detail.id).select().single())
      setItems((l) => l.map((x) => (x.id === row.id ? row : x)))
      setDetail(row)
      toast.success('Texte alternatif enregistré.')
    } catch (e) {
      toast.error(friendlyError(e))
    }
  }

  const replace = async (file) => {
    if (!file) return
    const used = usage[detail.id]
    const ok = await confirm({
      title: 'Remplacer l’image',
      message: `L’ancien fichier sera définitivement écrasé par « ${file.name} »${
        used?.length ? `, partout où il est utilisé (${used.join(', ')})` : ''
      }. Cette action est irréversible.`,
      confirmLabel: 'Remplacer',
      danger: true,
    })
    if (!ok) return
    setProgress(0)
    try {
      const row = await replaceMedia(detail, file, { onProgress: setProgress })
      setItems((l) => l.map((x) => (x.id === row.id ? row : x)))
      setDetail(row)
      toast.success('Image remplacée partout où elle est utilisée.')
    } catch (e) {
      toast.error(friendlyError(e))
    } finally {
      setProgress(null)
    }
  }

  const remove = async (m) => {
    const used = usage[m.id]
    if (used?.length) return toast.error(`Impossible : image utilisée (${used.join(', ')}). Retire-la d’abord.`)
    if (!(await confirm({ title: 'Supprimer l’image', message: 'Le fichier sera définitivement supprimé du stockage.', confirmLabel: 'Supprimer', danger: true }))) return
    try {
      await deleteMedia(m)
      setItems((l) => l.filter((x) => x.id !== m.id))
      setDetail(null)
      toast.success('Image supprimée.')
    } catch (e) {
      toast.error(friendlyError(e))
    }
  }

  return (
    <>
      <PageHeader title="Médias" description="Toutes les images du portfolio, stockées dans Supabase Storage. Une image utilisée ne peut pas être supprimée." />

      <Panel
        title="Téléverser"
        className="mb-8"
        actions={
          <Select value={folder} onChange={(e) => setFolder(e.target.value)} size="sm" aria-label="Dossier de destination">
            <option value="projects">Dossier : projets</option>
            <option value="profile">Dossier : profil</option>
            <option value="misc">Dossier : divers</option>
          </Select>
        }
      >
        <Uploader
          folder={folder}
          compact
          onUploaded={(created) => {
            setItems((l) => [...created, ...(l ?? [])])
            toast.success(`${created.length} image(s) ajoutée(s).`)
          }}
        />
      </Panel>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1 rounded-md bg-paper-2 p-1 text-sm">
          {[
            ['all', 'Toutes'],
            ['projects', 'Projets'],
            ['profile', 'Profil'],
            ['unused', 'Inutilisées'],
          ].map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)} className={`rounded px-3 py-1.5 ${filter === k ? 'bg-card font-medium shadow-sm' : 'text-mute hover:text-ink'}`}>
              {l}
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
        <EmptyState icon={Images} title={items.length ? 'Aucun résultat' : 'Aucune image'} text={items.length ? 'Change de filtre.' : 'Glisse tes premières images dans la zone ci-dessus.'} />
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {visible.map((m) => {
            const n = usage[m.id]?.length ?? 0
            return (
              <li key={m.id}>
                <button onClick={() => open(m)} className="group block w-full text-left">
                  <div className="relative aspect-square overflow-hidden rounded-md bg-paper-2">
                    <img src={m.url} alt={m.alt || ''} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    <span className="absolute left-2 top-2">{n ? <Badge tone="success">Utilisée ×{n}</Badge> : <Badge>Libre</Badge>}</span>
                  </div>
                  <p className="mt-1.5 truncate text-[13px]">{m.name || m.path}</p>
                  <p className="text-xs text-mute">
                    {m.width && `${m.width}×${m.height} · `}
                    {formatBytes(m.size_bytes)}
                  </p>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <Modal
        open={Boolean(detail)}
        onClose={() => progress === null && setDetail(null)}
        title={detail?.name || 'Image'}
        size="lg"
        footer={
          detail && (
            <>
              <Button variant="danger" icon={Trash2} onClick={() => remove(detail)} className="mr-auto">
                Supprimer
              </Button>
              <Button icon={ArrowLeftRight} onClick={() => replaceInput.current?.click()} loading={progress !== null}>
                Remplacer
              </Button>
              <Button onClick={() => setDetail(null)}>Fermer</Button>
            </>
          )
        }
      >
        {detail && (
          <div className="grid gap-6 md:grid-cols-[1fr_260px]">
            <div className="flex items-center justify-center rounded-md bg-paper-2 p-2">
              <img src={detail.url} alt={detail.alt || ''} className="max-h-[55svh] w-auto object-contain" />
            </div>
            <div className="space-y-4 text-sm">
              {progress !== null && <ProgressBar value={progress} />}
              <dl className="space-y-2">
                {[
                  ['Dimensions', detail.width ? `${detail.width} × ${detail.height}px` : '—'],
                  ['Poids', formatBytes(detail.size_bytes)],
                  ['Format', detail.mime_type?.replace('image/', '').toUpperCase()],
                  ['Ajoutée le', formatDate(detail.created_at)],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2">
                    <dt className="text-mute">{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
              <div>
                <p className="mb-1.5 text-mute">Utilisation</p>
                {usage[detail.id]?.length ? (
                  <ul className="space-y-1">
                    {usage[detail.id].map((u) => (
                      <li key={u} className="text-[13px]">• {u}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[13px]">Non utilisée</p>
                )}
              </div>
              <Field label="Texte alternatif" hint="Accessibilité & SEO">
                {({ id }) => (
                  <div className="flex gap-2">
                    <Input id={id} value={alt} onChange={(e) => setAlt(e.target.value)} maxLength={200} placeholder="Décris l’image" />
                    <Button onClick={saveAlt} disabled={(detail.alt ?? '') === alt}>OK</Button>
                  </div>
                )}
              </Field>
              <Button
                size="sm"
                variant="ghost"
                icon={Copy}
                onClick={() => navigator.clipboard.writeText(detail.url).then(() => toast.success('URL copiée.'))}
              >
                Copier l’URL publique
              </Button>
              <input ref={replaceInput} type="file" hidden accept={ACCEPTED_TYPES.join(',')} onChange={(e) => (replace(e.target.files[0]), (e.target.value = ''))} />
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
