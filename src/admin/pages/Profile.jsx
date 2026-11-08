import { useEffect, useRef, useState } from 'react'
import { ImagePlus, Plus, Trash2, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { friendlyError, unwrap } from '../lib/errors'
import { isUrl } from '../lib/format'
import { Button, Field, Input, PageHeader, Panel, Select, Spinner, Textarea, Toggle, useFeedback } from '../components/ui'
import { NETWORKS, networkById, socialHref } from '../../lib/socials'
import MediaPicker from '../components/MediaPicker'
import { SITE_SECTIONS } from '../../lib/sections'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const TEXT = ['full_name', 'role', 'tagline', 'bio', 'location', 'email', 'availability_note', 'resume_url', 'github', 'linkedin', 'twitter']
const URLS = ['resume_url', 'github', 'linkedin', 'twitter']

/** Empreinte des valeurs éditables : sert à savoir si quelque chose a changé. */
const snapshot = (f) =>
  JSON.stringify([
    ...TEXT.map((k) => String(f[k] ?? '').trim()),
    Boolean(f.available),
    f.years_experience === '' || f.years_experience == null ? null : Number(f.years_experience),
    f.avatar_url ?? null,
    (f.socials ?? []).filter((x) => String(x.value ?? '').trim()).map((x) => [x.network, String(x.value).trim(), String(x.label ?? '').trim()]),
    [...(f.hidden_sections ?? [])].sort(),
  ])

export default function Profile() {
  const { toast } = useFeedback()
  const [form, setForm] = useState(null)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [picker, setPicker] = useState(false)
  const baseline = useRef(null)

  useEffect(() => {
    unwrap(supabase.from('profile').select('*').eq('id', 1).maybeSingle())
      .then((p) => {
        const f = { ...(p ?? { id: 1, available: true }), _loaded: p ?? {} }
        baseline.current = snapshot(f)
        setForm(f)
      })
      .catch((e) => toast.error(friendlyError(e)))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!form) return <Spinner />
  const dirty = snapshot(form) !== baseline.current

  const set = (k) => (v) => {
    setForm((f) => ({ ...f, [k]: v?.target ? v.target.value : v }))
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }))
  }

  const save = async (e) => {
    e.preventDefault()
    if (snapshot(form) === baseline.current) return
    const errs = {}
    if (!form.full_name?.trim()) errs.full_name = 'Requis.'
    if (!form.role?.trim()) errs.role = 'Requis.'
    if (form.email && !EMAIL_RE.test(form.email.trim())) errs.email = 'Email invalide.'
    URLS.forEach((k) => !isUrl(form[k]) && (errs[k] = 'URL invalide (https://…).'))
    const years = form.years_experience === '' || form.years_experience == null ? null : Number(form.years_experience)
    if (years != null && (!Number.isInteger(years) || years < 0 || years > 60)) errs.years_experience = 'Nombre entier entre 0 et 60.'
    const socials = (form.socials ?? []).filter((x) => String(x.value ?? '').trim())
    socials.forEach((x, i) => !socialHref(x) && (errs[`social_${(form.socials ?? []).indexOf(x)}`] = `${networkById(x.network).label} : valeur invalide.`))
    if (socials.length && !('socials' in (form._loaded ?? {}))) errs.social_0 = 'Exécute d’abord supabase/migrations/005_socials.sql dans Supabase.'
    if ((form.hidden_sections ?? []).length && !('hidden_sections' in (form._loaded ?? {}))) errs.sections = 'Exécute d’abord supabase/migrations/006_sections.sql dans Supabase.'
    setErrors(errs)
    if (Object.keys(errs).length) return toast.error('Corrige les champs signalés.')

    setSaving(true)
    try {
      const payload = { id: 1, available: Boolean(form.available), years_experience: years, avatar_url: form.avatar_url ?? null, avatar_media_id: form.avatar_media_id ?? null, updated_at: new Date().toISOString() }
      TEXT.forEach((k) => (payload[k] = form[k]?.trim() || null))
      if ('socials' in (form._loaded ?? {}))
        payload.socials = socials.map((x) => ({ network: x.network, value: x.value.trim(), ...(networkById(x.network).customLabel && x.label?.trim() ? { label: x.label.trim().slice(0, 40) } : {}) }))
      if ('hidden_sections' in (form._loaded ?? {})) payload.hidden_sections = form.hidden_sections ?? []
      await unwrap(supabase.from('profile').upsert(payload))
      baseline.current = snapshot(form)
      setForm((f) => ({ ...f })) // rafraîchit l'état du bouton
      toast.success('Profil mis à jour sur le portfolio.')
    } catch (err) {
      toast.error(friendlyError(err))
    } finally {
      setSaving(false)
    }
  }

  const text = (k, label, props = {}) => (
    <Field label={label} required={props.required} error={errors[k]} hint={props.hint}>
      {({ id, invalid }) =>
        props.multiline ? (
          <Textarea id={id} aria-invalid={invalid} rows={props.rows ?? 5} value={form[k] ?? ''} onChange={set(k)} maxLength={props.maxLength} />
        ) : (
          <Input id={id} aria-invalid={invalid} type={props.type ?? 'text'} value={form[k] ?? ''} onChange={set(k)} placeholder={props.placeholder} maxLength={props.maxLength} />
        )
      }
    </Field>
  )

  return (
    <form onSubmit={save}>
      <PageHeader
        title="Profil"
        description="Informations publiques affichées dans le hero, la section À propos et le contact."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          <Panel title="Identité">
            <div className="grid gap-5 sm:grid-cols-2">
              {text('full_name', 'Nom affiché', { required: true, maxLength: 60 })}
              {text('role', 'Titre professionnel', { required: true, maxLength: 60, placeholder: 'Graphiste Designer' })}
              <div className="sm:col-span-2">{text('tagline', 'Accroche', { maxLength: 160, hint: 'Sous le nom, dans le hero' })}</div>
              <div className="sm:col-span-2">{text('bio', 'Biographie', { multiline: true, maxLength: 1200 })}</div>
            </div>
          </Panel>

          <Panel title="Coordonnées & disponibilité">
            <div className="grid gap-5 sm:grid-cols-2">
              {text('location', 'Localisation', { maxLength: 80 })}
              {text('email', 'Adresse e-mail publique', { type: 'email', maxLength: 200 })}
              {text('years_experience', "Années d'expérience", { type: 'number' })}
              {text('availability_note', 'Statut', { maxLength: 80, placeholder: 'Ouvert aux missions freelance & collaborations' })}
              <div className="sm:col-span-2">
                <Toggle checked={Boolean(form.available)} onChange={set('available')} label="Disponible pour de nouveaux projets" description="Affiche l’indicateur « Disponible » dans la navigation et le hero." />
              </div>
            </div>
          </Panel>

          <Panel title="Liens">
            <div className="grid gap-5 sm:grid-cols-2">
              {text('github', 'GitHub', { type: 'url', placeholder: 'https://github.com/…' })}
              {text('linkedin', 'LinkedIn', { type: 'url', placeholder: 'https://linkedin.com/in/…' })}
              {text('twitter', 'X / Twitter', { type: 'url' })}
              {text('resume_url', 'CV (lien PDF)', { type: 'url' })}
            </div>
            <SocialsEditor
              value={form.socials ?? []}
              errors={errors}
              onChange={(socials) => {
                setForm((f) => ({ ...f, socials }))
                setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !k.startsWith('social_'))))
              }}
            />
          </Panel>

          <Panel title="Sections du site">
            <p className="-mt-1 mb-4 text-sm text-mute">Masque une section de la page d’accueil sans perdre son contenu : elle disparaît aussi du menu. Le hero et le contact restent toujours visibles.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {SITE_SECTIONS.map((sec) => {
                const hidden = (form.hidden_sections ?? []).includes(sec.id)
                return (
                  <Toggle
                    key={sec.id}
                    checked={!hidden}
                    onChange={(on) =>
                      setForm((f) => {
                        const cur = new Set(f.hidden_sections ?? [])
                        on ? cur.delete(sec.id) : cur.add(sec.id)
                        return { ...f, hidden_sections: [...cur] }
                      })
                    }
                    label={sec.label}
                    description={hidden ? 'Masquée sur le site' : 'Affichée'}
                  />
                )
              })}
            </div>
            {errors.sections && <p className="mt-3 text-sm text-danger">{errors.sections}</p>}
          </Panel>
        </div>

        <Panel title="Photo de profil">
          {form.avatar_url ? (
            <>
              <img src={form.avatar_url} alt="" className="aspect-[3/4] w-full rounded-md bg-paper-2 object-cover" />
              <div className="mt-3 flex gap-2">
                <Button size="sm" onClick={() => setPicker(true)} className="flex-1 justify-center">
                  Changer
                </Button>
                <Button size="sm" variant="ghost" icon={Trash2} aria-label="Retirer la photo" onClick={() => setForm((f) => ({ ...f, avatar_url: null, avatar_media_id: null }))} />
              </div>
            </>
          ) : (
            <button type="button" onClick={() => setPicker(true)} className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed border-line-strong text-sm text-mute hover:border-ink hover:text-ink">
              <ImagePlus size={20} strokeWidth={1.5} /> Ajouter une photo
            </button>
          )}
          <p className="mt-3 text-xs text-mute">Affichée en noir et blanc dans le hero, en couleur au survol.</p>
        </Panel>
      </div>

      {/* Barre d'enregistrement, toujours visible en bas */}
      <div className="sticky bottom-0 z-10 mt-8 flex items-center justify-end gap-4 border-t border-line bg-paper/90 py-4 backdrop-blur">
        <span className={`text-sm ${dirty ? 'text-ink' : 'text-mute'}`}>{dirty ? 'Modifications non enregistrées' : 'Aucune modification'}</span>
        <Button type="submit" variant="primary" loading={saving} disabled={!dirty}>
          Enregistrer
        </Button>
      </div>

      <MediaPicker open={picker} folder="profile" onClose={() => setPicker(false)} onSelect={(m) => setForm((f) => ({ ...f, avatar_url: m.url, avatar_media_id: m.id }))} />
    </form>
  )
}

/** Liste libre de réseaux : WhatsApp, Facebook, Instagram, TikTok… */
function SocialsEditor({ value, onChange, errors }) {
  const update = (i, patch) => onChange(value.map((x, k) => (k === i ? { ...x, ...patch } : x)))
  return (
    <div className="mt-6 border-t border-line pt-5">
      <p className="text-[13px] font-medium">Autres réseaux</p>
      <p className="mt-0.5 text-xs text-mute">Affichés dans le pied de page ; WhatsApp apparaît aussi dans la section Contact.</p>
      <ul className="mt-4 space-y-3">
        {value.map((x, i) => {
          const n = networkById(x.network)
          const href = socialHref(x)
          return (
            <li key={i} className="rounded-md border border-line p-3">
              <div className="flex flex-wrap items-start gap-2">
                <Select aria-label="Réseau" value={n.id} onChange={(e) => update(i, { network: e.target.value })} className="!w-40">
                  {NETWORKS.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </Select>
                {n.customLabel && (
                  <Input aria-label="Nom affiché" placeholder="Nom affiché" maxLength={40} value={x.label ?? ''} onChange={(e) => update(i, { label: e.target.value })} className="!w-36" />
                )}
                <Input aria-label={n.label} aria-invalid={Boolean(errors[`social_${i}`])} placeholder={n.placeholder} maxLength={200} value={x.value ?? ''} onChange={(e) => update(i, { value: e.target.value })} className="min-w-0 flex-1" />
                <Button variant="ghost" size="sm" icon={X} aria-label="Retirer" onClick={() => onChange(value.filter((_, k) => k !== i))} />
              </div>
              {errors[`social_${i}`] ? (
                <p className="mt-1.5 text-xs text-danger">{errors[`social_${i}`]}</p>
              ) : (
                <p className="mt-1.5 truncate text-xs text-mute">{href ? `→ ${href}` : n.hint || ''}</p>
              )}
            </li>
          )
        })}
      </ul>
      {value.length < 15 && (
        <Button size="sm" icon={Plus} className="mt-3" onClick={() => onChange([...value, { network: value.some((v) => v.network === 'whatsapp') ? 'facebook' : 'whatsapp', value: '' }])}>
          Ajouter un réseau
        </Button>
      )}
    </div>
  )
}
