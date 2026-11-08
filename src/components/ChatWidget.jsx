import { Fragment, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUpRight, MessageCircle, RotateCcw, Send, X } from 'lucide-react'

const STORE = 'bp-chat'
const TEASER = 'bp-chat-teaser'
const SUGGESTIONS = ['Quels sont tes projets ?', 'Quels logiciels maîtrises-tu ?', 'Es-tu disponible ?', 'Comment te contacter ?']

const read = (storage, key, fallback) => {
  try {
    return JSON.parse(storage.getItem(key)) ?? fallback
  } catch {
    return fallback
  }
}
const write = (storage, key, value) => {
  try {
    storage.setItem(key, JSON.stringify(value))
  } catch {
    /* stockage indisponible */
  }
}

/** Mise en forme légère : **gras**, puces « • », liens (chemins du site, URLs, emails). */
function Rich({ text, onInternal }) {
  const TOKEN = /(\*\*[^*]+\*\*|https?:\/\/[^\s)]+|[\w.+-]+@[\w-]+\.[\w.]+|\/(?:projets\/[\w-]+|#[\w-]+))/g
  return text.split('\n').map((line, i, all) => (
    <Fragment key={i}>
      {line.split(TOKEN).map((part, k) => {
        if (!part) return null
        if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={k} className="font-semibold">{part.slice(2, -2)}</strong>
        if (/^https?:\/\//.test(part))
          return (
            <a key={k} href={part.replace(/[.,]$/, '')} target="_blank" rel="noreferrer" className="break-all underline underline-offset-2">
              {part.replace(/^https?:\/\//, '').replace(/\/$/, '')}
            </a>
          )
        if (/@/.test(part) && !/\s/.test(part))
          return (
            <a key={k} href={`mailto:${part.replace(/[.,]$/, '')}`} className="underline underline-offset-2">
              {part}
            </a>
          )
        if (/^\/(projets\/|#)/.test(part))
          return (
            <button key={k} type="button" onClick={() => onInternal(part)} className="underline underline-offset-2">
              {part.startsWith('/#') ? 'contact' : part.replace('/projets/', '')}
            </button>
          )
        return <Fragment key={k}>{part}</Fragment>
      })}
      {i < all.length - 1 && <br />}
    </Fragment>
  ))
}

/** Assistant flottant (en bas à droite) qui répond aux questions sur le propriétaire du portfolio. */
export default function ChatWidget({ profile }) {
  const name = profile?.full_name || 'moi'
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState(() => read(sessionStorage, STORE, []))
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [teaser, setTeaser] = useState(false)
  const listRef = useRef(null)
  const inputRef = useRef(null)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => write(sessionStorage, STORE, messages.slice(-30)), [messages])

  // Petite bulle d'accueil, une fois par visite
  useEffect(() => {
    if (read(sessionStorage, TEASER, false)) return
    const t = setTimeout(() => setTeaser(true), 6000)
    return () => clearTimeout(t)
  }, [])
  const hideTeaser = () => {
    setTeaser(false)
    write(sessionStorage, TEASER, true)
  }

  useEffect(() => {
    if (!open) return
    hideTeaser()
    setTimeout(() => inputRef.current?.focus(), 250)
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, busy, open])

  const goInternal = (path) => {
    if (path.startsWith('/#')) {
      const id = path.slice(2)
      const scroll = () => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
      if (location.pathname === '/') scroll()
      else {
        navigate('/')
        setTimeout(scroll, 500)
      }
    } else navigate(path)
    if (window.innerWidth < 640) setOpen(false)
  }

  const send = async (text) => {
    const question = text.trim().slice(0, 500)
    if (!question || busy) return
    const next = [...messages, { role: 'user', content: question }]
    setMessages(next)
    setInput('')
    setBusy(true)
    try {
      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next.slice(-20).map(({ role, content }) => ({ role, content })) }),
      })
      const json = await r.json().catch(() => ({}))
      const reply = r.ok && json.text ? { role: 'assistant', content: json.text, links: json.links || [] } : { role: 'assistant', content: json.error || 'Je n’arrive pas à répondre pour le moment. Réessaie dans un instant.', error: true }
      setMessages((m) => [...m, reply])
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: 'Connexion impossible. Vérifie ta connexion et réessaie.', error: true }])
    } finally {
      setBusy(false)
    }
  }

  const welcome = `Salut ! 👋 Je suis l’assistant de ${name}. Pose-moi une question sur son parcours, ses projets ou sa disponibilité.`

  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      <AnimatePresence>
        {open && (
          <motion.section
            id="chat-panel"
            role="dialog"
            aria-label={`Discuter avec l’assistant de ${name}`}
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="flex h-[min(600px,calc(100svh-6.5rem))] w-[calc(100vw-2rem)] origin-bottom-right flex-col overflow-hidden rounded-[1.5rem] border border-edge bg-bg shadow-2xl shadow-black/20 sm:w-[380px]"
          >
            {/* En-tête */}
            <header className="flex items-center gap-3 bg-ink px-4 py-3.5 text-white">
              <span className="relative">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                ) : (
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-signal font-medium text-ink">{name.charAt(0)}</span>
                )}
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-ink bg-signal" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">Assistant de {name}</p>
                <p className="truncate text-xs text-white/60">Répond en quelques secondes</p>
              </div>
              {messages.length > 0 && (
                <button type="button" onClick={() => setMessages([])} title="Nouvelle conversation" aria-label="Nouvelle conversation" className="rounded-full p-2 text-white/70 hover:bg-white/10 hover:text-white">
                  <RotateCcw size={16} />
                </button>
              )}
              <button type="button" onClick={() => setOpen(false)} aria-label="Fermer" className="rounded-full p-2 text-white/70 hover:bg-white/10 hover:text-white">
                <X size={18} />
              </button>
            </header>

            {/* Messages */}
            <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4" aria-live="polite">
              <Bubble role="assistant">{welcome}</Bubble>
              {messages.map((m, i) => (
                <div key={i} className="space-y-2">
                  <Bubble role={m.role} error={m.error}>
                    {m.role === 'assistant' ? <Rich text={m.content} onInternal={goInternal} /> : m.content}
                  </Bubble>
                  {m.links?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pl-1">
                      {m.links.map((l) =>
                        /^https?:\/\//.test(l.href) ? (
                          <a key={l.href} href={l.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border border-edge px-3 py-1 text-xs text-fg hover:border-signal hover:text-signal">
                            {l.label} <ArrowUpRight size={12} />
                          </a>
                        ) : (
                          <button key={l.href} type="button" onClick={() => goInternal(l.href)} className="rounded-full border border-edge px-3 py-1 text-xs text-fg hover:border-signal hover:text-signal">
                            {l.label}
                          </button>
                        ),
                      )}
                    </div>
                  )}
                </div>
              ))}
              {busy && (
                <div className="flex w-fit items-center gap-1 rounded-2xl rounded-bl-md bg-surface px-4 py-3" aria-label="L’assistant écrit">
                  {[0, 1, 2].map((d) => (
                    <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-fog" style={{ animationDelay: `${d * 0.15}s` }} />
                  ))}
                </div>
              )}
              {messages.length === 0 && !busy && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} type="button" onClick={() => send(s)} className="rounded-full border border-edge px-3 py-1.5 text-left text-sm text-fg transition-colors hover:border-signal hover:text-signal">
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Saisie */}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                send(input)
              }}
              className="flex items-end gap-2 border-t border-edge p-3"
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    send(input)
                  }
                }}
                rows={1}
                maxLength={500}
                placeholder="Écris ta question…"
                aria-label="Ta question"
                className="max-h-28 min-h-[44px] flex-1 resize-none rounded-2xl border border-edge bg-surface px-4 py-2.5 text-[15px] text-fg outline-none placeholder:text-fog/70 focus:border-signal"
              />
              <button type="submit" disabled={!input.trim() || busy} aria-label="Envoyer" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-signal text-ink transition-opacity disabled:opacity-40">
                <Send size={17} />
              </button>
            </form>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Bulle d'accueil */}
      <AnimatePresence>
        {teaser && !open && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="relative max-w-[260px] rounded-2xl rounded-br-md border border-edge bg-bg px-4 py-3 text-sm text-fg shadow-xl shadow-black/10">
            <button type="button" onClick={() => setOpen(true)} className="text-left">
              Une question sur mon parcours ou mes projets ? <span className="text-signal">Demande-moi !</span>
            </button>
            <button type="button" onClick={hideTeaser} aria-label="Masquer" className="absolute -left-2 -top-2 grid h-6 w-6 place-items-center rounded-full border border-edge bg-bg text-fog hover:text-fg">
              <X size={12} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bouton */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="chat-panel"
        aria-label={open ? 'Fermer la discussion' : `Poser une question à l’assistant de ${name}`}
        className="group relative grid h-14 w-14 place-items-center rounded-full bg-signal text-ink shadow-lg shadow-signal/30 transition-transform hover:scale-105 active:scale-95"
      >
        {!open && messages.length === 0 && <span className="absolute inset-0 animate-ping rounded-full bg-signal/40" aria-hidden="true" />}
        <span className="relative transition-transform duration-300 group-hover:-rotate-6">{open ? <X size={22} /> : <MessageCircle size={24} />}</span>
      </button>
    </div>
  )
}

function Bubble({ role, error, children }) {
  const mine = role === 'user'
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] break-words rounded-2xl ${mine ? "whitespace-pre-wrap" : ""} px-4 py-2.5 text-[15px] leading-relaxed ${
          mine ? 'rounded-br-md bg-signal text-ink' : error ? 'rounded-bl-md bg-signal/10 text-fg' : 'rounded-bl-md bg-surface text-fg'
        }`}
      >
        {children}
      </div>
    </div>
  )
}
