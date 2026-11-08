import { useEffect, useRef, useState } from 'react'
import { MessageCircle, Send, Trash2 } from 'lucide-react'
import { comment, deleteMyComment, fetchSocial, react, REACTIONS } from '../lib/social'
import { isSupabaseReady } from '../lib/supabase'

const NAME_KEY = 'bp-comment-name'
const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

function timeAgo(d) {
  const s = (Date.now() - new Date(d).getTime()) / 1000
  if (s < 60) return 'à l’instant'
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`
  if (s < 86400 * 7) return `il y a ${Math.floor(s / 86400)} j`
  return dateFmt.format(new Date(d))
}

const initials = (name) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')

/**
 * Réactions (5 émojis) + commentaires d'un projet.
 * 1 réaction et 1 commentaire par appareil — la règle est appliquée par la base.
 */
export default function ProjectSocial({ projectId }) {
  const [state, setState] = useState(null) // { reactions, mine, comments }
  const [unavailable, setUnavailable] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [name, setName] = useState(() => {
    try {
      return localStorage.getItem(NAME_KEY) || ''
    } catch {
      return ''
    }
  })
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const honeypot = useRef(null)

  useEffect(() => {
    if (!isSupabaseReady || !projectId) return
    let cancelled = false
    setState(null)
    setError('')
    fetchSocial(projectId)
      .then((d) => !cancelled && (d ? setState(d) : setUnavailable(true)))
      .catch((e) => {
        console.error('[social]', e)
        if (!cancelled) setUnavailable(true)
      })
    return () => {
      cancelled = true
    }
  }, [projectId])

  if (!isSupabaseReady || unavailable) return null

  const counts = state?.reactions ?? {}
  const total = Object.values(counts).reduce((s, n) => s + n, 0)
  const myComment = state?.comments?.find((c) => c.mine)

  const onReact = async (key) => {
    if (!state || pending) return
    const next = state.mine === key ? null : key
    // Affichage immédiat, puis confirmation par la base
    const optimistic = { ...counts }
    if (state.mine) optimistic[state.mine] = Math.max(0, (optimistic[state.mine] || 1) - 1)
    if (next) optimistic[next] = (optimistic[next] || 0) + 1
    const previous = state
    setState({ ...state, reactions: optimistic, mine: next })
    setPending(true)
    try {
      setState(await react(projectId, next))
    } catch (e) {
      setState(previous)
      setError(e.message)
    } finally {
      setPending(false)
    }
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    if (honeypot.current?.value) return // robot
    const a = name.trim()
    const b = body.trim()
    if (!a) return setError('Indique ton nom.')
    if (b.length < 2) return setError('Écris au moins quelques mots.')
    if (/(https?:\/\/|www\.)/i.test(b)) return setError('Les liens ne sont pas autorisés dans les commentaires.')
    setSending(true)
    setError('')
    try {
      setState(await comment(projectId, a, b))
      setBody('')
      try {
        localStorage.setItem(NAME_KEY, a)
      } catch {
        /* stockage indisponible */
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  const onDelete = async () => {
    setSending(true)
    setError('')
    try {
      setState(await deleteMyComment(projectId))
      setConfirmDelete(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  const comments = state?.comments ?? []
  const visible = comments.filter((c) => !c.hidden).length

  return (
    <section className="container-x mt-20" aria-labelledby="avis-titre">
      <div className="card p-6 md:p-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Ton avis</p>
            <h2 id="avis-titre" className="mt-3 text-2xl font-medium tracking-tight text-fg md:text-3xl">
              Ce projet t’a plu ?
            </h2>
          </div>
          <p className="text-sm text-fog">
            {total} réaction{total > 1 ? 's' : ''} · {visible} commentaire{visible > 1 ? 's' : ''}
          </p>
        </div>

        {/* Réactions */}
        <div className="mt-7 flex flex-wrap gap-2.5" role="group" aria-label="Réagir au projet">
          {REACTIONS.map((r) => {
            const active = state?.mine === r.key
            const n = counts[r.key] || 0
            return (
              <button
                key={r.key}
                type="button"
                onClick={() => onReact(r.key)}
                disabled={!state}
                aria-pressed={active}
                title={active ? 'Retirer ma réaction' : r.label}
                className={`group inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm transition-all disabled:opacity-50 ${
                  active ? 'border-signal bg-signal/10 text-fg' : 'border-edge text-fog hover:border-edge-strong hover:text-fg'
                }`}
              >
                <span className={`text-lg leading-none transition-transform ${active ? 'scale-110' : 'group-hover:scale-110'}`} aria-hidden="true">
                  {r.emoji}
                </span>
                <span className="font-medium">{r.label}</span>
                {n > 0 && <span className={`tabular-nums ${active ? 'text-signal' : 'text-fog'}`}>{n}</span>}
              </button>
            )
          })}
        </div>
        <p className="mt-3 text-xs text-fog">
          {state?.mine ? 'Merci ! Clique à nouveau pour retirer ta réaction, ou choisis-en une autre.' : 'Une réaction par appareil.'}
        </p>

        <div className="mt-10 grid gap-10 border-t border-edge pt-10 lg:grid-cols-12">
          {/* Formulaire ou commentaire existant */}
          <div className="lg:col-span-5">
            {myComment ? (
              <div className="rounded-2xl border border-edge bg-surface p-5">
                <p className="text-sm font-medium text-fg">Ton commentaire est publié.</p>
                <p className="mt-1 text-sm text-fog">Un seul commentaire par appareil. Tu peux le supprimer pour en écrire un nouveau.</p>
                {myComment.hidden && <p className="mt-2 text-xs text-signal">Il a été masqué par l’auteur du portfolio.</p>}
                {confirmDelete ? (
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className="text-sm text-fg">Supprimer définitivement ?</span>
                    <button type="button" onClick={onDelete} disabled={sending} className="btn btn-primary !px-4 !py-2 text-sm">
                      Oui, supprimer
                    </button>
                    <button type="button" onClick={() => setConfirmDelete(false)} className="btn btn-ghost !px-4 !py-2 text-sm">
                      Annuler
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setConfirmDelete(true)} className="mt-4 inline-flex items-center gap-1.5 text-sm text-fog hover:text-signal">
                    <Trash2 size={14} /> Supprimer mon commentaire
                  </button>
                )}
              </div>
            ) : (
              <form onSubmit={onSubmit} noValidate className="space-y-4">
                <h3 className="text-lg font-medium text-fg">Laisser un commentaire</h3>
                {/* Piège à robots : invisible pour les humains */}
                <input ref={honeypot} type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
                <label className="block">
                  <span className="text-sm text-fog">Ton nom</span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={60}
                    autoComplete="name"
                    className="mt-1.5 w-full rounded-xl border border-edge bg-surface px-4 py-3 text-fg outline-none transition-colors placeholder:text-fog/60 focus:border-signal"
                    placeholder="Prénom ou pseudo"
                  />
                </label>
                <label className="block">
                  <span className="text-sm text-fog">Ton message</span>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    maxLength={600}
                    rows={4}
                    className="mt-1.5 w-full resize-none rounded-xl border border-edge bg-surface px-4 py-3 text-fg outline-none transition-colors placeholder:text-fog/60 focus:border-signal"
                    placeholder="Ce que tu en penses…"
                  />
                </label>
                <div className="flex justify-end">
                  <button type="submit" disabled={sending || !state} className="btn btn-primary">
                    {sending ? 'Envoi…' : 'Publier'} <Send size={15} />
                  </button>
                </div>
              </form>
            )}
            {error && (
              <p className="mt-3 text-sm font-medium text-signal" role="alert">
                {error}
              </p>
            )}
          </div>

          {/* Liste */}
          <div className="lg:col-span-7">
            {!state ? (
              <div className="space-y-4" aria-hidden="true">
                {[0, 1].map((i) => (
                  <div key={i} className="h-20 animate-pulse rounded-2xl bg-surface" />
                ))}
              </div>
            ) : comments.length === 0 ? (
              <div className="flex h-full min-h-40 flex-col items-center justify-center rounded-2xl border border-dashed border-edge px-6 py-10 text-center">
                <MessageCircle size={22} strokeWidth={1.5} className="text-fog" />
                <p className="mt-3 text-fg">Aucun commentaire pour l’instant.</p>
                <p className="mt-1 text-sm text-fog">Sois le premier à donner ton avis.</p>
              </div>
            ) : (
              <ul className="space-y-4">
                {comments.map((c) => (
                  <li key={c.id} className={`flex gap-4 rounded-2xl border p-5 ${c.mine ? 'border-signal/40 bg-signal/[0.04]' : 'border-edge'} ${c.hidden ? 'opacity-60' : ''}`}>
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink text-sm font-medium text-white" aria-hidden="true">
                      {initials(c.author) || '?'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                        <span className="font-medium text-fg">{c.author}</span>
                        {c.mine && <span className="text-xs text-signal">toi</span>}
                        <time dateTime={c.created_at} className="text-xs text-fog">
                          {timeAgo(c.created_at)}
                        </time>
                      </p>
                      <p className="mt-1.5 whitespace-pre-line break-words leading-relaxed text-fg/90">{c.body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
