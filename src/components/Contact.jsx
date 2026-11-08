import { useState } from 'react'
import { ArrowRight, Mail, MapPin, MessageCircle } from 'lucide-react'
import Reveal from './Reveal'
import { sendMessage } from '../lib/portfolio'
import { isSupabaseReady } from '../lib/supabase'
import { profileSocials } from '../lib/socials'

const empty = { name: '', email: '', subject: '', message: '' }
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function Field({ label, as = 'input', error, ...props }) {
  const Tag = as
  return (
    <label className="block">
      <span className="flex justify-between text-sm text-white/70">
        {label}
        {error && <span className="font-medium text-signal">{error}</span>}
      </span>
      <Tag
        {...props}
        aria-invalid={Boolean(error)}
        className={`mt-2 w-full resize-none rounded-xl border bg-white/[0.06] px-4 py-3 text-white outline-none transition-colors placeholder:text-white/35 focus:bg-white/[0.09] ${
          error ? 'border-signal' : 'border-white/15 focus:border-signal'
        }`}
      />
    </label>
  )
}

function validate(f) {
  const e = {}
  if (!f.name.trim()) e.name = 'Requis'
  if (!EMAIL_RE.test(f.email.trim())) e.email = 'Email invalide'
  if (f.message.trim().length < 10) e.message = '10 caractères minimum'
  return e
}

export default function Contact({ profile }) {
  const [form, setForm] = useState(empty)
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState('idle') // idle | sending | sent | error
  const [error, setError] = useState('')

  const update = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }))
    if (errors[k]) setErrors((x) => ({ ...x, [k]: undefined }))
  }

  const submit = async (e) => {
    e.preventDefault()
    const v = validate(form)
    setErrors(v)
    if (Object.keys(v).length) return
    setStatus('sending')
    setError('')
    try {
      await sendMessage({
        name: form.name.trim(),
        email: form.email.trim(),
        subject: form.subject.trim() || null,
        message: form.message.trim(),
      })
      setForm(empty)
      setStatus('sent')
    } catch (err) {
      setError(err.message || 'Une erreur est survenue. Réessaie dans un instant.')
      setStatus('error')
    }
  }

  return (
    <section id="contact" className="py-24 md:py-32">
      <div className="container-x grid gap-4 lg:grid-cols-12">
        {/* Gauche : invitation + coordonnées */}
        <Reveal className="card flex flex-col p-7 md:p-10 lg:col-span-5">
          <p className="eyebrow">Contact</p>
          <h2 className="h-section mt-4 text-fg">Créons quelque chose ensemble.</h2>
          <p className="mt-5 leading-relaxed text-fog">
            Un projet, une idée ou une opportunité ? Écris-moi, je réponds généralement sous 24 h.
          </p>

          <ul className="mt-auto space-y-4 pt-10">
            {profile.email && (
              <li>
                <a href={`mailto:${profile.email}`} className="group flex items-center gap-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-signal text-ink">
                    <Mail size={18} />
                  </span>
                  <span className="break-all text-lg text-fg group-hover:text-signal">{profile.email}</span>
                </a>
              </li>
            )}
            {profileSocials(profile)
              .filter((x) => x.network === 'whatsapp')
              .slice(0, 1)
              .map((w) => (
                <li key={w.href}>
                  <a href={w.href} target="_blank" rel="noreferrer" className="group flex items-center gap-4">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-signal text-ink">
                      <MessageCircle size={18} />
                    </span>
                    <span className="text-lg text-fg group-hover:text-signal">Écrire sur WhatsApp</span>
                  </a>
                </li>
              ))}
            {profile.location && (
              <li className="flex items-center gap-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-edge-strong text-fg">
                  <MapPin size={18} />
                </span>
                <span className="text-fg">{profile.location}</span>
              </li>
            )}
          </ul>
        </Reveal>

        {/* Droite : formulaire dans une carte noire */}
        <Reveal delay={0.1} className="rounded-[1.75rem] bg-ink p-7 text-white ring-1 ring-white/10 md:p-10 lg:col-span-7">
          <h3 className="text-2xl font-medium tracking-tight md:text-3xl">Parlez-moi de votre projet</h3>
          <form onSubmit={submit} noValidate className="mt-8 space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Nom" placeholder="Votre nom" maxLength={120} value={form.name} onChange={update('name')} error={errors.name} autoComplete="name" />
              <Field
                label="Email"
                type="email"
                placeholder="vous@exemple.com"
                maxLength={200}
                value={form.email}
                onChange={update('email')}
                error={errors.email}
                autoComplete="email"
              />
            </div>
            <Field label="Sujet (facultatif)" placeholder="Logo, affiche, visuels réseaux sociaux…" maxLength={200} value={form.subject} onChange={update('subject')} />
            <Field
              label="Message"
              as="textarea"
              rows={5}
              placeholder="Décrivez votre besoin…"
              maxLength={5000}
              value={form.message}
              onChange={update('message')}
              error={errors.message}
            />

            <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
              <p className="text-sm" aria-live="polite">
                {status === 'sent' && <span className="font-medium">Merci, votre message est bien arrivé.</span>}
                {status === 'error' && <span className="font-medium text-signal">{error}</span>}
                {status === 'idle' && !isSupabaseReady && <span className="text-white/60">Mode démo — envoi désactivé.</span>}
              </p>
              {/* Bouton blanc, icône dans une pastille orange */}
              <button
                type="submit"
                disabled={status === 'sending'}
                className="group inline-flex items-center gap-3 rounded-full bg-white py-1.5 pl-5 pr-1.5 text-sm font-medium text-ink transition-colors hover:bg-signal disabled:opacity-60"
              >
                {status === 'sending' ? 'Envoi…' : 'Envoyer le message'}
                <span className="grid h-9 w-9 place-items-center rounded-full bg-signal text-ink transition-transform duration-500 group-hover:-rotate-45">
                  <ArrowRight size={16} />
                </span>
              </button>
            </div>
          </form>
        </Reveal>
      </div>
    </section>
  )
}
