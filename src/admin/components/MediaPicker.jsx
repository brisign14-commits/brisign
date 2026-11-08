import { useEffect, useState } from 'react'
import { Check, Search } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { friendlyError, unwrap } from '../lib/errors'
import { Button, EmptyState, Input, Modal, Spinner, useFeedback } from './ui'
import Uploader from './Uploader'

/** Modale : choisir une ou plusieurs images existantes, ou en téléverser de nouvelles. */
export default function MediaPicker({ open, onClose, onSelect, multiple = false, folder = 'projects', exclude = [] }) {
  const { toast } = useFeedback()
  const [tab, setTab] = useState('library')
  const [items, setItems] = useState(null)
  const [selected, setSelected] = useState([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!open) return
    setSelected([])
    setItems(null)
    unwrap(supabase.from('media').select('*').order('created_at', { ascending: false }))
      .then(setItems)
      .catch((e) => {
        toast.error(friendlyError(e))
        setItems([])
      })
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (m) =>
    setSelected((s) => (s.some((x) => x.id === m.id) ? s.filter((x) => x.id !== m.id) : multiple ? [...s, m] : [m]))

  const visible = (items ?? []).filter(
    (m) => !exclude.includes(m.id) && (!search || (m.name || m.path).toLowerCase().includes(search.toLowerCase())),
  )

  const done = (list) => {
    onSelect(multiple ? list : list[0])
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={multiple ? 'Ajouter des images' : 'Choisir une image'}
      footer={
        tab === 'library' && (
          <>
            <span className="mr-auto self-center text-sm text-mute">{selected.length} sélectionnée(s)</span>
            <Button onClick={onClose}>Annuler</Button>
            <Button variant="primary" disabled={!selected.length} onClick={() => done(selected)}>
              Utiliser
            </Button>
          </>
        )
      }
    >
      <div className="mb-5 flex gap-1 rounded-md bg-paper-2 p-1 text-sm">
        {[
          ['library', 'Médiathèque'],
          ['upload', 'Téléverser'],
        ].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`flex-1 rounded px-3 py-1.5 ${tab === k ? 'bg-card font-medium shadow-sm' : 'text-mute'}`}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'upload' ? (
        <Uploader folder={folder} multiple={multiple} onUploaded={(created) => done(created)} />
      ) : items === null ? (
        <Spinner />
      ) : items.length === 0 ? (
        <EmptyState title="Médiathèque vide" text="Téléverse ta première image depuis l’onglet « Téléverser »." />
      ) : (
        <>
          <div className="relative mb-4">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-mute" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher par nom…" className="pl-9" />
          </div>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {visible.map((m) => {
              const on = selected.some((x) => x.id === m.id)
              return (
                <li key={m.id}>
                  <button
                    onClick={() => toggle(m)}
                    onDoubleClick={() => !multiple && done([m])}
                    className={`group relative block aspect-square w-full overflow-hidden rounded-md bg-paper-2 ring-2 transition ${on ? 'ring-ink' : 'ring-transparent hover:ring-line-strong'}`}
                  >
                    <img src={m.url} alt={m.alt || m.name || ''} loading="lazy" className="h-full w-full object-cover" />
                    {on && (
                      <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-ink text-paper">
                        <Check size={14} />
                      </span>
                    )}
                  </button>
                  <p className="mt-1 truncate text-xs text-mute">{m.name || m.path}</p>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </Modal>
  )
}
