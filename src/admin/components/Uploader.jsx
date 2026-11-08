import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, Check, ClipboardPaste, ImagePlus, RotateCcw, UploadCloud, X } from 'lucide-react'
import { ACCEPTED_TYPES, formatBytes, uploadMedia, validateFile } from '../lib/media'
import { friendlyError } from '../lib/errors'
import { Button } from './ui'

const MAX_FILES = 20
const CONCURRENCY = 3
const fileKey = (f) => `${f.name}|${f.size}|${f.lastModified}`

/**
 * Sélection (clic, glisser-déposer ou Ctrl+V) → aperçus → envoi en parallèle avec progression.
 * `onUploaded(media[])` reçoit les lignes `media` créées.
 */
export default function Uploader({ folder = 'projects', multiple = true, onUploaded, compact = false }) {
  const input = useRef(null)
  // { id, key, file, preview, error, invalid, progress, status: 'ready'|'uploading'|'done'|'error' }
  const [queue, setQueue] = useState([])
  const [drag, setDrag] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const dragDepth = useRef(0) // évite le clignotement quand on survole les éléments enfants

  const queueRef = useRef(queue)
  queueRef.current = queue
  useEffect(() => () => queueRef.current.forEach((q) => q.preview && URL.revokeObjectURL(q.preview)), [])

  const addFiles = useCallback(
    (files) => {
      if (busy) return
      const incoming = [...files]
      if (!incoming.length) return
      const current = multiple ? queueRef.current : []
      const known = new Set(current.map((q) => q.key))
      const fresh = incoming.filter((f) => !known.has(fileKey(f)))
      const dupes = incoming.length - fresh.length
      const room = multiple ? MAX_FILES - current.length : 1
      const accepted = fresh.slice(0, Math.max(0, room))
      const dropped = fresh.length - accepted.length

      const messages = []
      if (dupes) messages.push(`${dupes} doublon${dupes > 1 ? 's' : ''} ignoré${dupes > 1 ? 's' : ''}`)
      if (dropped) messages.push(`${dropped} fichier${dropped > 1 ? 's' : ''} en trop (${MAX_FILES} max par envoi)`)
      setNotice(messages.join(' · '))

      const items = accepted.map((file) => {
        const error = validateFile(file)
        return {
          id: crypto.randomUUID(),
          key: fileKey(file),
          file,
          preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
          error,
          invalid: Boolean(error),
          progress: 0,
          status: error ? 'error' : 'ready',
        }
      })
      setQueue((q) => {
        if (!multiple) q.forEach((x) => x.preview && URL.revokeObjectURL(x.preview))
        return multiple ? [...q, ...items] : items
      })
    },
    [busy, multiple],
  )

  // Coller une image (capture d'écran…) avec Ctrl+V, sauf quand on écrit dans un champ
  useEffect(() => {
    const onPaste = (e) => {
      const t = e.target
      if (t?.closest?.('input, textarea, [contenteditable="true"]')) return
      const files = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith('image/'))
      if (!files.length) return
      e.preventDefault()
      // Les images collées s'appellent toutes « image.png » : on leur donne un nom unique
      addFiles(
        files.map((f, i) =>
          f.name && f.name !== 'image.png' ? f : new File([f], `capture-${Date.now()}-${i}.${f.type.split('/')[1] || 'png'}`, { type: f.type }),
        ),
      )
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [addFiles])

  const remove = (id) =>
    setQueue((q) => {
      const item = q.find((x) => x.id === id)
      if (item?.preview) URL.revokeObjectURL(item.preview)
      return q.filter((x) => x.id !== id)
    })

  const clearAll = () => {
    queue.forEach((x) => x.preview && URL.revokeObjectURL(x.preview))
    setQueue([])
    setNotice('')
  }

  const patch = (id, p) => setQueue((q) => q.map((x) => (x.id === id ? { ...x, ...p } : x)))

  const start = async (onlyIds) => {
    const todo = queue.filter((x) => !x.invalid && x.status !== 'done' && (!onlyIds || onlyIds.includes(x.id)))
    if (!todo.length) return
    setBusy(true)
    setNotice('')
    todo.forEach((x) => patch(x.id, { status: 'uploading', error: null, progress: 0 }))
    const created = []
    let next = 0
    const worker = async () => {
      while (next < todo.length) {
        const item = todo[next++]
        try {
          const media = await uploadMedia(item.file, { folder, onProgress: (p) => patch(item.id, { progress: p }) })
          patch(item.id, { progress: 1, status: 'done' })
          created.push(media)
        } catch (err) {
          patch(item.id, { status: 'error', error: friendlyError(err), progress: 0 })
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, todo.length) }, worker))
    setBusy(false)
    if (created.length) {
      onUploaded?.(created)
      // Brève coche verte, puis on ne garde que les fichiers à corriger
      setTimeout(() => {
        setQueue((q) => {
          q.filter((x) => x.status === 'done').forEach((x) => x.preview && URL.revokeObjectURL(x.preview))
          return q.filter((x) => x.status !== 'done')
        })
      }, 900)
    }
  }

  const ready = queue.filter((x) => x.status === 'ready')
  const failed = queue.filter((x) => x.status === 'error' && !x.invalid)
  const totalSize = ready.reduce((s, x) => s + x.file.size, 0)
  const uploading = queue.filter((x) => x.status === 'uploading' || x.status === 'done')
  const overall = uploading.length ? uploading.reduce((s, x) => s + x.progress, 0) / uploading.length : 0

  const open = () => !busy && input.current?.click()

  return (
    <div>
      <div
        role="button"
        tabIndex={busy ? -1 : 0}
        aria-disabled={busy}
        aria-label={multiple ? 'Ajouter des images' : 'Choisir une image'}
        onClick={open}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            open()
          }
        }}
        onDragEnter={(e) => {
          e.preventDefault()
          dragDepth.current += 1
          setDrag(true)
        }}
        onDragOver={(e) => {
          e.preventDefault()
          e.dataTransfer.dropEffect = busy ? 'none' : 'copy'
        }}
        onDragLeave={() => {
          dragDepth.current = Math.max(0, dragDepth.current - 1)
          if (!dragDepth.current) setDrag(false)
        }}
        onDrop={(e) => {
          e.preventDefault()
          dragDepth.current = 0
          setDrag(false)
          addFiles(e.dataTransfer.files)
        }}
        className={`group relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed text-center outline-none transition-all focus-visible:border-ink focus-visible:ring-2 focus-visible:ring-ink/15 ${
          compact ? 'px-4 py-7' : 'px-6 py-12'
        } ${
          busy
            ? 'cursor-not-allowed border-line opacity-60'
            : drag
              ? 'scale-[1.01] cursor-copy border-ink bg-paper-2'
              : 'cursor-pointer border-line-strong hover:border-ink hover:bg-paper-2/50'
        }`}
      >
        <span
          className={`flex h-11 w-11 items-center justify-center rounded-full border border-line bg-card transition-transform ${
            drag ? '-translate-y-1 text-ink' : 'text-mute group-hover:-translate-y-0.5 group-hover:text-ink'
          }`}
        >
          <UploadCloud size={20} strokeWidth={1.6} />
        </span>
        <p className="mt-3 text-sm font-medium">
          {drag ? 'Dépose pour ajouter' : multiple ? 'Glisse tes images ici' : 'Glisse une image ici'}
          {!drag && (
            <>
              {' '}
              ou <span className="underline decoration-line-strong underline-offset-4 group-hover:decoration-ink">parcours</span>
            </>
          )}
        </p>
        <p className="mt-1.5 text-xs text-mute">
          JPG, PNG, WebP, AVIF, GIF · optimisées automatiquement{multiple ? ` · ${MAX_FILES} max` : ''}
        </p>
        <p className="mt-2 hidden items-center gap-1 text-[11px] text-mute/80 sm:flex">
          <ClipboardPaste size={12} /> ou colle une capture avec Ctrl+V
        </p>
        <input
          ref={input}
          type="file"
          hidden
          multiple={multiple}
          accept={ACCEPTED_TYPES.join(',')}
          onChange={(e) => {
            addFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      {notice && (
        <p role="status" className="mt-2 flex items-center gap-1.5 text-xs text-mute">
          <AlertTriangle size={13} className="shrink-0" /> {notice}
        </p>
      )}

      {queue.length > 0 && (
        <div className="mt-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-mute">
            <span aria-live="polite">
              {busy
                ? `Envoi en cours… ${Math.round(overall * 100)} %`
                : `${queue.length} fichier${queue.length > 1 ? 's' : ''}${ready.length ? ` · ${formatBytes(totalSize)} à envoyer` : ''}`}
            </span>
            {!busy && (
              <button type="button" onClick={clearAll} className="underline-offset-4 hover:text-ink hover:underline">
                Tout retirer
              </button>
            )}
          </div>

          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
            {queue.map((q) => (
              <li key={q.id} className="group/item relative aspect-square overflow-hidden rounded-md border border-line bg-paper-2" title={q.error || q.file.name}>
                {q.preview ? (
                  <img src={q.preview} alt="" className={`h-full w-full object-cover transition-opacity ${q.status === 'error' ? 'opacity-40' : ''}`} />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-mute">
                    <AlertTriangle size={20} />
                  </div>
                )}

                {/* Progression */}
                {q.status === 'uploading' && (
                  <div className="absolute inset-0 flex items-end bg-ink/25">
                    <div className="h-1 w-full bg-white/30">
                      <div className="h-full bg-white transition-[width] duration-200" style={{ width: `${Math.round(q.progress * 100)}%` }} />
                    </div>
                    <span className="absolute inset-0 flex items-center justify-center text-sm font-medium text-white">
                      {Math.round(q.progress * 100)} %
                    </span>
                  </div>
                )}
                {q.status === 'done' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-success/70 text-white">
                    <Check size={26} strokeWidth={2.5} />
                  </div>
                )}

                {/* Erreur */}
                {q.status === 'error' && (
                  <div className="absolute inset-x-0 bottom-0 bg-card/95 px-1.5 py-1 text-[10.5px] leading-tight text-danger">
                    <span className="line-clamp-2">{q.error}</span>
                  </div>
                )}

                {/* Nom + taille */}
                {q.status === 'ready' && (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 pb-1 pt-4 text-[10.5px] text-white opacity-0 transition-opacity group-hover/item:opacity-100">
                    <p className="truncate">{q.file.name}</p>
                    <p className="text-white/70">{formatBytes(q.file.size)}</p>
                  </div>
                )}

                {/* Actions */}
                {!busy && q.status !== 'done' && (
                  <div className="absolute right-1 top-1 flex gap-1">
                    {q.status === 'error' && !q.invalid && (
                      <button
                        type="button"
                        onClick={() => start([q.id])}
                        aria-label={`Réessayer ${q.file.name}`}
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-card/90 text-ink shadow-sm hover:bg-card"
                      >
                        <RotateCcw size={12} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => remove(q.id)}
                      aria-label={`Retirer ${q.file.name}`}
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-card/90 text-ink shadow-sm hover:bg-card focus-visible:opacity-100 sm:opacity-0 sm:group-hover/item:opacity-100"
                    >
                      <X size={13} />
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>

          <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
            {!busy && failed.length > 0 && (
              <Button size="sm" icon={RotateCcw} onClick={() => start(failed.map((x) => x.id))}>
                Réessayer ({failed.length})
              </Button>
            )}
            <Button variant="primary" icon={ImagePlus} loading={busy} disabled={!ready.length} onClick={() => start()}>
              {busy ? 'Envoi…' : `Téléverser${ready.length ? ` ${ready.length} image${ready.length > 1 ? 's' : ''}` : ''}`}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
