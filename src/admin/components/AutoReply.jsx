import { useEffect, useState } from 'react'
import { Bot } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { friendlyError, unwrap } from '../lib/errors'
import { timeAgo } from '../lib/format'
import { Button, Field, Input, Modal, Select, Textarea, Toggle, useFeedback } from './ui'

const fingerprint = (f) =>
  f ? JSON.stringify([Boolean(f.enabled), f.mode, Number(f.offline_after_minutes) || 10, String(f.subject ?? '').trim(), String(f.message ?? '').trim()]) : ''

/** Bouton « Réponse automatique » + fenêtre de réglage (page Messages). */
export default function AutoReply() {
  const { toast } = useFeedback()
  const [settings, setSettings] = useState(undefined) // undefined = chargement, null = migration absente
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase
      .from('auto_reply_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data, error }) => setSettings(error ? null : data))
  }, [])

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v?.target ? v.target.value : v }))

  const save = async () => {
    if (!form.subject.trim() || !form.message.trim()) return toast.error('Le sujet et le message sont requis.')
    setSaving(true)
    try {
      const patch = {
        enabled: form.enabled,
        mode: form.mode,
        offline_after_minutes: Math.min(1440, Math.max(1, Number(form.offline_after_minutes) || 10)),
        subject: form.subject.trim(),
        message: form.message.trim(),
        updated_at: new Date().toISOString(),
      }
      const [row] = await unwrap(supabase.from('auto_reply_settings').update(patch).eq('id', 1).select())
      setSettings(row)
      setForm(null)
      toast.success(patch.enabled ? 'Réponse automatique activée.' : 'Réponse automatique désactivée.')
    } catch (e) {
      toast.error(friendlyError(e))
    } finally {
      setSaving(false)
    }
  }

  if (settings === undefined) return null
  if (settings === null)
    return (
      <Button size="sm" icon={Bot} onClick={() => toast.error('Exécute d’abord supabase/migrations/004_auto_reply.sql dans le SQL Editor de Supabase.')}>
        Réponse automatique
      </Button>
    )

  return (
    <>
      <Button size="sm" icon={Bot} onClick={() => setForm({ ...settings })}>
        Réponse auto : {settings.enabled ? (settings.mode === 'always' ? 'toujours' : 'si hors ligne') : 'désactivée'}
      </Button>

      <Modal
        open={Boolean(form)}
        onClose={() => setForm(null)}
        title="Réponse automatique"
        footer={
          <>
            <Button onClick={() => setForm(null)}>Annuler</Button>
            <Button variant="primary" loading={saving} disabled={fingerprint(form) === fingerprint(settings)} onClick={save}>
              Enregistrer
            </Button>
          </>
        }
      >
        {form && (
          <div className="space-y-5">
            <Toggle
              checked={form.enabled}
              onChange={set('enabled')}
              label="Activer la réponse automatique"
              description="Envoyée depuis ton Gmail, avec ta photo, à la personne qui t’écrit via le formulaire."
            />
            <Field label="Quand l’envoyer">
              {({ id }) => (
                <Select id={id} value={form.mode} onChange={set('mode')}>
                  <option value="offline">Seulement quand je suis hors ligne</option>
                  <option value="always">À chaque message</option>
                </Select>
              )}
            </Field>
            {form.mode === 'offline' && (
              <Field label="Hors ligne après" hint="sans activité dans l’admin">
                {({ id }) => (
                  <div className="flex items-center gap-2">
                    <Input id={id} type="number" min={1} max={1440} value={form.offline_after_minutes} onChange={set('offline_after_minutes')} className="max-w-28" />
                    <span className="text-sm text-mute">minutes</span>
                  </div>
                )}
              </Field>
            )}
            <Field label="Sujet" required>
              {({ id }) => <Input id={id} maxLength={150} value={form.subject} onChange={set('subject')} />}
            </Field>
            <Field label="Message" required hint="{prenom} = prénom du visiteur">
              {({ id }) => <Textarea id={id} rows={7} maxLength={3000} value={form.message} onChange={set('message')} />}
            </Field>
            <p className="rounded-md bg-line/40 px-3 py-2 text-xs leading-relaxed text-mute">
              Tu es « en ligne » tant que l’admin est ouvert dans un onglet. Dernière activité : {settings.last_seen_at ? timeAgo(settings.last_seen_at) : 'jamais'}.
              Une même adresse ne reçoit qu’une réponse automatique toutes les 12 h. Ta signature et le lien du portfolio sont ajoutés automatiquement.
            </p>
          </div>
        )}
      </Modal>
    </>
  )
}
