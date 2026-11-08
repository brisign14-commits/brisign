import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../lib/auth'
import { friendlyError } from '../lib/errors'
import { Button, Field, Input, Spinner } from '../components/ui'

export const passwordIssue = (pw, confirm) => {
  if (pw.length < 10) return '10 caractères minimum.'
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'Utilise au moins une lettre et un chiffre.'
  if (pw !== confirm) return 'Les deux mots de passe ne correspondent pas.'
  return null
}

export default function ResetPassword() {
  const { session, loading, isAdmin, setRecovery } = useAuth()
  const navigate = useNavigate()
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    const issue = passwordIssue(pw, confirm)
    if (issue) return setError(issue)
    setBusy(true)
    setError('')
    const { error: err } = await supabase.auth.updateUser({ password: pw })
    setBusy(false)
    if (err) return setError(friendlyError(err))
    setRecovery(false)
    navigate(isAdmin ? '/admin-bri/dashboard' : '/admin-bri', { replace: true })
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-paper px-5 text-ink">
      <div className="w-full max-w-sm">
        {loading ? (
          <Spinner />
        ) : !session ? (
          <>
            <h1 className="font-display text-3xl font-bold tracking-[-0.03em]">Lien invalide</h1>
            <p className="mt-3 text-sm text-mute">Ce lien de réinitialisation a expiré ou a déjà été utilisé.</p>
            <Link to="/admin-bri" className="mt-6 inline-block text-sm underline underline-offset-4">
              ← Retour à la connexion
            </Link>
          </>
        ) : (
          <>
            <p className="font-mono text-[11px] uppercase tracking-widest text-mute">Sécurité</p>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-[-0.03em]">Nouveau mot de passe</h1>
            <form onSubmit={submit} className="mt-8 space-y-5">
              <Field label="Nouveau mot de passe" hint="10 caractères min.">
                {({ id }) => <Input id={id} type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />}
              </Field>
              <Field label="Confirmer">
                {({ id }) => <Input id={id} type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />}
              </Field>
              {error && <p role="alert" className="rounded-md bg-danger/10 px-3 py-2.5 text-sm text-danger">{error}</p>}
              <Button type="submit" variant="primary" loading={busy} disabled={!pw || !confirm} className="w-full justify-center">
                Enregistrer
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
