import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowLeft, ExternalLink, Mail, MailOpen, Reply, Send, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { friendlyError, unwrap } from '../lib/errors'
import { formatDateTime, timeAgo } from '../lib/format'
import { Button, EmptyState, PageHeader, Spinner, Textarea, useFeedback } from '../components/ui'
import { refreshUnread } from '../components/AdminLayout'
import AutoReply from '../components/AutoReply'

export default function Messages() {
  const { toast, confirm } = useFeedback()
  const [params, setParams] = useSearchParams()
  const selectedId = params.get('id')
  const filter = params.get('filtre') === 'non-lus' ? 'unread' : 'all'
  const [items, setItems] = useState(null)

  useEffect(() => {
    unwrap(supabase.from('messages').select('*').order('created_at', { ascending: false }))
      .then(setItems)
      .catch((e) => {
        toast.error(friendlyError(e))
        setItems([])
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const visible = useMemo(() => (items ?? []).filter((m) => filter === 'all' || !m.is_read), [items, filter])
  const selected = items?.find((m) => m.id === selectedId)
  const unreadCount = items?.filter((m) => !m.is_read).length ?? 0

  const setRead = async (m, is_read) => {
    const patch = { is_read, read_at: is_read ? new Date().toISOString() : null }
    setItems((l) => l.map((x) => (x.id === m.id ? { ...x, ...patch } : x)))
    try {
      await unwrap(supabase.from('messages').update(patch).eq('id', m.id))
      refreshUnread()
    } catch (e) {
      setItems((l) => l.map((x) => (x.id === m.id ? m : x)))
      toast.error(friendlyError(e))
    }
  }

  // Ouvrir un message le marque comme lu
  useEffect(() => {
    if (selected && !selected.is_read) setRead(selected, true)
  }, [selectedId, Boolean(selected)]) // eslint-disable-line react-hooks/exhaustive-deps

  const select = (id) => {
    const next = new URLSearchParams(params)
    id ? next.set('id', id) : next.delete('id')
    setParams(next)
  }

  const remove = async (m) => {
    if (!(await confirm({ title: 'Supprimer le message', message: `Le message de ${m.name} sera définitivement supprimé.`, confirmLabel: 'Supprimer', danger: true }))) return
    try {
      await unwrap(supabase.from('messages').delete().eq('id', m.id))
      setItems((l) => l.filter((x) => x.id !== m.id))
      select(null)
      refreshUnread()
      toast.success('Message supprimé.')
    } catch (e) {
      toast.error(friendlyError(e))
    }
  }

  return (
    <>
      <PageHeader title="Messages" description="Messages reçus via le formulaire de contact du portfolio." actions={<AutoReply />} />

      {items === null ? (
        <Spinner />
      ) : items.length === 0 ? (
        <EmptyState icon={Mail} title="Aucun message" text="Les messages envoyés depuis le formulaire de contact apparaîtront ici." />
      ) : (
        <div className="grid overflow-hidden rounded-lg border border-line bg-card md:grid-cols-[320px_1fr]">
          {/* Liste */}
          <div className={`border-line md:border-r ${selected ? 'hidden md:block' : ''}`}>
            <div className="flex gap-1 border-b border-line p-2 text-sm">
              {[
                ['all', `Tous (${items.length})`],
                ['unread', `Non lus (${unreadCount})`],
              ].map(([k, l]) => (
                <button
                  key={k}
                  onClick={() => setParams(k === 'unread' ? { filtre: 'non-lus' } : {})}
                  className={`flex-1 rounded px-3 py-1.5 ${filter === k ? 'bg-paper-2 font-medium' : 'text-mute hover:text-ink'}`}
                >
                  {l}
                </button>
              ))}
            </div>
            <ul className="max-h-[70svh] divide-y divide-line overflow-y-auto">
              {visible.length === 0 && <li className="p-6 text-center text-sm text-mute">Tout est lu ✓</li>}
              {visible.map((m) => (
                <li key={m.id}>
                  <button onClick={() => select(m.id)} className={`block w-full px-4 py-3 text-left transition-colors ${m.id === selectedId ? 'bg-paper-2' : 'hover:bg-paper'}`}>
                    <span className="flex items-center justify-between gap-2">
                      <span className={`flex items-center gap-2 truncate text-sm ${m.is_read ? '' : 'font-semibold'}`}>
                        {!m.is_read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-signal" />}
                        {m.name}
                      </span>
                      <span className="shrink-0 text-xs text-mute">{timeAgo(m.created_at)}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-[13px] text-mute">{m.subject || m.message}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Détail */}
          <div className={`min-h-[50svh] ${selected ? '' : 'hidden md:block'}`}>
            {!selected ? (
              <div className="flex h-full items-center justify-center p-10 text-sm text-mute">Sélectionne un message.</div>
            ) : (
              <article className="p-5 sm:p-8">
                <div className="mb-6 flex flex-wrap items-center gap-2">
                  <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={() => select(null)} className="md:hidden">
                    Retour
                  </Button>
                  <div className="ml-auto flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="primary"
                      icon={Reply}
                      onClick={() => document.getElementById('reply-box')?.focus()}
                    >
                      Répondre
                    </Button>
                    <Button size="sm" icon={selected.is_read ? Mail : MailOpen} onClick={() => setRead(selected, !selected.is_read)}>
                      {selected.is_read ? 'Marquer non lu' : 'Marquer lu'}
                    </Button>
                    <Button size="sm" variant="danger" icon={Trash2} onClick={() => remove(selected)} aria-label="Supprimer" />
                  </div>
                </div>
                <h2 className="font-display text-2xl font-bold tracking-[-0.02em]">{selected.subject || 'Sans sujet'}</h2>
                <p className="mt-2 text-sm">
                  <strong>{selected.name}</strong>{' '}
                  <a href={`mailto:${selected.email}`} className="text-mute underline-offset-2 hover:underline">
                    &lt;{selected.email}&gt;
                  </a>
                </p>
                <p className="mt-0.5 text-xs text-mute">Reçu le {formatDateTime(selected.created_at)}</p>
                <div className="mt-6 whitespace-pre-wrap border-t border-line pt-6 text-[15px] leading-relaxed">{selected.message}</div>
                <ReplyBox key={selected.id} message={selected} />
              </article>
            )}
          </div>
        </div>
      )}
    </>
  )
}

/** Réponse envoyée depuis ton Gmail (route /api/reply), avec ta photo et ton nom dans le mail. */
function ReplyBox({ message }) {
  const { toast } = useFeedback()
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [sentTo, setSentTo] = useState(null)
  const subject = `Re: ${message.subject || 'Ton message'}`

  const send = async () => {
    if (!text.trim()) return
    setSending(true)
    try {
      const { data: s } = await supabase.auth.getSession()
      const r = await fetch('/api/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.session?.access_token ?? ''}` },
        body: JSON.stringify({ messageId: message.id, text }),
      })
      const json = await r.json().catch(() => ({ error: r.status === 404 ? 'Service d’envoi introuvable (route /api/reply).' : 'Réponse invalide du serveur.' }))
      if (!r.ok) throw new Error(json.error || `Erreur ${r.status}`)
      setSentTo(json.to)
      setText('')
      toast.success(`Réponse envoyée à ${json.to}.`)
    } catch (e) {
      toast.error(friendlyError(e))
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="mt-8 rounded-xl border border-line p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <label htmlFor="reply-box" className="text-sm font-medium">
          Répondre à {message.name}
        </label>
        <span className="text-xs text-mute">{subject}</span>
      </div>
      {sentTo && <p className="mb-3 rounded-md bg-signal/10 px-3 py-2 text-sm">Réponse envoyée à {sentTo}. Elle est aussi dans tes « Messages envoyés » Gmail.</p>}
      <Textarea
        id="reply-box"
        rows={6}
        maxLength={10000}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => (e.ctrlKey || e.metaKey) && e.key === 'Enter' && send()}
        placeholder={`Bonjour ${message.name.split(' ')[0]},

Merci pour ton message…`}
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <a
          href={`mailto:${message.email}?subject=${encodeURIComponent(subject)}`}
          className="inline-flex items-center gap-1.5 text-xs text-mute hover:text-ink"
        >
          <ExternalLink size={13} /> Ouvrir plutôt dans ma messagerie
        </a>
        <Button variant="primary" icon={Send} loading={sending} disabled={!text.trim()} onClick={send}>
          Envoyer depuis mon Gmail
        </Button>
      </div>
    </section>
  )
}
