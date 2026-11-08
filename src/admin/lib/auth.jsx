import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

/*
 * Sécurité :
 *  - L'authentification passe exclusivement par Supabase Auth (mots de passe hachés côté Supabase).
 *  - Être connecté ne suffit PAS : on vérifie que l'utilisateur figure dans `public.admins`
 *    via la fonction SQL `is_admin()`.
 *  - Cette vérification côté client sert l'UX ; la vraie barrière est côté serveur :
 *    toutes les écritures (tables + Storage) sont protégées par des policies RLS `is_admin()`.
 */

export const AuthContext = createContext(null)

async function checkAdmin() {
  const { data, error } = await supabase.rpc('is_admin')
  if (error) throw error
  return data === true
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined) // undefined = en cours de lecture
  const [isAdmin, setIsAdmin] = useState(null) // null = inconnu
  const [recovery, setRecovery] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      setSession(s)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  // Dépend uniquement de l'utilisateur : le rafraîchissement du token ne relance pas la vérification.
  const userId = session?.user?.id
  const sessionRead = session !== undefined
  useEffect(() => {
    if (!sessionRead) return
    if (!userId) return setIsAdmin(false)
    let cancelled = false
    setIsAdmin(null)
    checkAdmin()
      .then((ok) => !cancelled && setIsAdmin(ok))
      .catch(() => !cancelled && setIsAdmin(false))
    return () => {
      cancelled = true
    }
  }, [userId, sessionRead])

  const signIn = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    const ok = await checkAdmin().catch(() => false)
    if (!ok) {
      await supabase.auth.signOut()
      throw new Error("Ce compte n'a pas les droits administrateur.")
    }
    setIsAdmin(true)
  }, [])

  const signOut = useCallback(async (scope = 'local') => {
    await supabase.auth.signOut({ scope })
    setIsAdmin(false)
  }, [])

  const value = {
    session,
    user: session?.user ?? null,
    isAdmin,
    loading: session === undefined || (Boolean(session) && isAdmin === null),
    recovery,
    setRecovery,
    signIn,
    signOut,
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)

/** Garde de route : session valide ET droits administrateur. */
export function RequireAdmin({ children, fallback, denied }) {
  const { session, isAdmin, loading } = useAuth()
  const location = useLocation()
  if (loading) return fallback
  if (!session) return <Navigate to="/admin-bri" replace state={{ from: location.pathname }} />
  if (!isAdmin) return denied
  return children
}
