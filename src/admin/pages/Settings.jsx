import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, ShieldCheck } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../lib/auth'
import { friendlyError } from '../lib/errors'
import { formatDateTime } from '../lib/format'
import { Button, Field, Input, PageHeader, Panel, useFeedback } from '../components/ui'
import { passwordIssue } from './ResetPassword'

export default function Settings() {
  const { user, signOut } = useAuth()
  const { toast, confirm } = useFeedback()
  const navigate = useNavigate()
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const changePassword = async (e) => {
    e.preventDefault()
    const issue = passwordIssue(pw, pw2)
    setError(issue ?? '')
    if (issue) return
    setBusy(true)
    const { error: err } = await supabase.auth.updateUser({ password: pw })
    setBusy(false)
    if (err) return setError(friendlyError(err))
    setPw('')
    setPw2('')
    toast.success('Mot de passe modifié.')
  }

  const signOutEverywhere = async () => {
    if (!(await confirm({ title: 'Déconnecter tous les appareils', message: 'Toutes les sessions ouvertes (ordinateur, téléphone…) seront fermées.', confirmLabel: 'Tout déconnecter', danger: true }))) return
    await signOut('global')
    navigate('/admin-bri', { replace: true })
  }

  return (
    <>
      <PageHeader title="Paramètres" description="Sécurité du compte administrateur." />

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Compte">
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-mute">E-mail de connexion</dt>
              <dd className="truncate">{user?.email}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-mute">Dernière connexion</dt>
              <dd>{formatDateTime(user?.last_sign_in_at)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-mute">Rôle</dt>
              <dd className="flex items-center gap-1.5 text-success">
                <ShieldCheck size={15} /> Administrateur
              </dd>
            </div>
          </dl>
          <p className="mt-5 border-t border-line pt-4 text-xs leading-relaxed text-mute">
            Les droits sont vérifiés par la base de données (table <code>admins</code> + policies RLS) à chaque lecture ou écriture : même avec une session valide, un compte non autorisé ne peut rien modifier.
          </p>
        </Panel>

        <Panel title="Changer le mot de passe">
          <form onSubmit={changePassword} className="space-y-4">
            <Field label="Nouveau mot de passe" hint="10 caractères, lettres + chiffres">
              {({ id }) => <Input id={id} type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />}
            </Field>
            <Field label="Confirmer">
              {({ id }) => <Input id={id} type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />}
            </Field>
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button type="submit" variant="primary" loading={busy} disabled={!pw || !pw2}>
              Mettre à jour
            </Button>
          </form>
        </Panel>

        <Panel title="Sessions" className="lg:col-span-2">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-mute">Un doute sur un appareil ? Ferme toutes les sessions actives.</p>
            <Button variant="danger" icon={LogOut} onClick={signOutEverywhere}>
              Déconnecter tous les appareils
            </Button>
          </div>
        </Panel>
      </div>
    </>
  )
}
