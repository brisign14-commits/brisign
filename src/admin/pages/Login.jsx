import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../lib/auth'
import { friendlyError } from '../lib/errors'
import { Button, Field, Input, Spinner } from '../components/ui'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const MAX_ATTEMPTS = 5
const LOCK_MS = 30_000

function Shell({ children }) {
  return (
    <div className="grid min-h-svh bg-paper text-ink lg:grid-cols-2">
      <aside className="relative hidden flex-col justify-between bg-ink p-12 text-paper lg:flex">
        <Link to="/" className="font-display text-lg font-bold">
          ← Portfolio<span className="text-signal">.</span>
        </Link>
        <div>
          <p className="font-mono text-[11px] uppercase tracking-widest text-paper/50">Espace privé</p>
          <p className="mt-4 font-display text-[clamp(3rem,6vw,6rem)] font-bold leading-[0.85] tracking-[-0.055em]">
            Adminis&shy;tration<span className="text-signal">.</span>
          </p>
        </div>
        <p className="font-mono text-[11px] uppercase tracking-widest text-paper/40">Accès réservé · Supabase Auth</p>
      </aside>
      <main className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  )
}

export default function Login() {
  const { session, isAdmin, loading, signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mode, setMode] = useState('login') // login | forgot | sent
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [attempts, setAttempts] = useState(0)
  const [lockedUntil, setLockedUntil] = useState(0)
  const [now, setNow] = useState(Date.now())

  const locked = lockedUntil > now
  useEffect(() => {
    if (!locked) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [locked])

  if (loading) return <Shell><Spinner label="Vérification de la session…" /></Shell>
  if (session && isAdmin) return <Navigate to={location.state?.from || '/admin-bri/dashboard'} replace />

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (locked) return
    if (!EMAIL_RE.test(email.trim())) return setError('Adresse e-mail invalide.')
    if (mode === 'login' && !password) return setError('Saisis ton mot de passe.')

    setBusy(true)
    try {
      if (mode === 'login') {
        await signIn(email.trim(), password)
        navigate(location.state?.from || '/admin-bri/dashboard', { replace: true })
      } else {
        const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/admin-bri/reinitialiser`,
        })
        if (err) throw err
        setMode('sent')
      }
    } catch (err) {
      setError(friendlyError(err))
      if (mode === 'login') {
        const n = attempts + 1
        setAttempts(n)
        if (n >= MAX_ATTEMPTS) {
          setLockedUntil(Date.now() + LOCK_MS)
          setNow(Date.now())
          setAttempts(0)
        }
      }
    } finally {
      setBusy(false)
      setPassword('')
    }
  }

  if (mode === 'sent')
    return (
      <Shell>
        <h1 className="font-display text-3xl font-bold tracking-[-0.03em]">Vérifie ta boîte mail</h1>
        <p className="mt-3 text-sm text-mute">
          Si un compte existe pour <strong className="text-ink">{email}</strong>, un lien de réinitialisation vient d’être envoyé.
        </p>
        <Button className="mt-8" onClick={() => setMode('login')}>
          ← Retour à la connexion
        </Button>
      </Shell>
    )

  return (
    <Shell>
      <p className="font-mono text-[11px] uppercase tracking-widest text-mute">{mode === 'login' ? 'Connexion' : 'Mot de passe oublié'}</p>
      <h1 className="mt-2 font-display text-3xl font-bold tracking-[-0.03em]">
        {mode === 'login' ? 'Bon retour.' : 'Réinitialiser'}
      </h1>
      {mode === 'forgot' && <p className="mt-2 text-sm text-mute">Saisis ton e-mail, tu recevras un lien pour choisir un nouveau mot de passe.</p>}

      <form onSubmit={submit} noValidate className="mt-8 space-y-5">
        <Field label="Adresse e-mail">
          {({ id }) => (
            <Input id={id} type="email" autoComplete="username" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="toi@exemple.com" />
          )}
        </Field>

        {mode === 'login' && (
          <Field label="Mot de passe">
            {({ id }) => (
              <div className="relative">
                <Input id={id} type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="pr-11" />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  className="absolute inset-y-0 right-0 grid w-11 place-items-center text-mute hover:text-ink"
                  aria-label={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                >
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            )}
          </Field>
        )}

        {(error || locked) && (
          <p role="alert" className="rounded-md bg-danger/10 px-3 py-2.5 text-sm text-danger">
            {locked ? `Trop de tentatives. Réessaie dans ${Math.ceil((lockedUntil - now) / 1000)} s.` : error}
          </p>
        )}

        <Button type="submit" variant="primary" loading={busy} disabled={locked} className="w-full justify-center">
          {mode === 'login' ? 'Se connecter' : 'Envoyer le lien'}
        </Button>
      </form>

      <button
        onClick={() => {
          setMode(mode === 'login' ? 'forgot' : 'login')
          setError('')
        }}
        className="mt-6 text-sm text-mute underline-offset-4 hover:text-ink hover:underline"
      >
        {mode === 'login' ? 'Mot de passe oublié ?' : '← Retour à la connexion'}
      </button>
    </Shell>
  )
}
