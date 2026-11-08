/** Traduit les erreurs Supabase / réseau en messages compréhensibles. */
export function friendlyError(err) {
  if (!err) return 'Erreur inconnue.'
  const code = err.code
  const msg = err.message || String(err)

  if (code === '23503') return 'Impossible : cet élément est encore utilisé ailleurs.'
  if (code === '23505') return 'Cette valeur existe déjà (doublon). Choisis-en une autre.'
  if (code === '23514') return 'Une valeur ne respecte pas les règles de la base (vérifie les champs).'
  if (code === '42501' || /row-level security|permission denied/i.test(msg))
    return "Action refusée : ce compte n'a pas les droits administrateur."
  if (code === '42703' || code === '42P01' || code === 'PGRST200' || code === 'PGRST204')
    return 'La base de données n’est pas à jour : exécute supabase/migrations/002_admin.sql.'
  if (/Invalid login credentials/i.test(msg)) return 'Email ou mot de passe incorrect.'
  if (/Email not confirmed/i.test(msg)) return "Cet email n'a pas encore été confirmé."
  if (/rate limit|too many/i.test(msg)) return 'Trop de tentatives. Patiente quelques minutes.'
  if (/JWT expired|session.*missing/i.test(msg)) return 'Session expirée, reconnecte-toi.'
  if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) return 'Connexion impossible. Vérifie ta connexion internet.'
  return msg
}

/** Déballe une réponse Supabase : renvoie `data` ou lève l'erreur. */
export async function unwrap(query) {
  const { data, error } = await query
  if (error) throw error
  return data
}

/** Compte les lignes sans les télécharger. */
export async function count(query) {
  const { count: n, error } = await query
  if (error) throw error
  return n ?? 0
}
