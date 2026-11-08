import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { fallback } from '../data/fallback'

/*
 * Source de vérité unique du site public : Supabase.
 * Les données sont chargées une fois puis partagées par toutes les pages publiques.
 * Les données de démo ne servent QUE si Supabase n'est pas configuré.
 */

const COVER = 'cover:media!projects_cover_media_id_fkey(url, width, height, alt)'

const PortfolioContext = createContext(null)

/** Image principale d'un projet : média de la médiathèque, sinon ancienne URL `image_url`. */
export const coverOf = (project) => project?.cover?.url || project?.image_url || null

/** Retire les éléments masqués dans l'admin (« Afficher sur le site » désactivé). */
const shown = (rows) => (rows ?? []).filter((r) => r.visible !== false)

async function loadAll() {
  const [profile, projects, skills, experiences, services] = await Promise.all([
    supabase.from('profile').select('*').eq('id', 1).maybeSingle(),
    supabase
      .from('projects')
      .select(`*, ${COVER}`)
      .eq('status', 'published')
      .order('featured', { ascending: false })
      .order('sort_order')
      .order('project_date', { ascending: false, nullsFirst: false }),
    supabase.from('skills').select('*').order('sort_order'),
    supabase.from('experiences').select('*').order('sort_order'),
    supabase.from('services').select('*').order('sort_order'),
  ])
  const failed = [profile, projects, skills, experiences, services].find((r) => r.error)
  if (failed) throw failed.error

  // Sections personnalisées (migration 007) : facultatives, ignorées si la table n'existe pas encore
  const custom = await supabase
    .from('custom_sections')
    .select('*, items:custom_section_items(*)')
    .eq('visible', true)
    .order('sort_order')
  if (custom.error) console.warn('[sections personnalisées]', custom.error.message)

  return {
    profile: profile.data ?? {},
    projects: projects.data ?? [],
    skills: shown(skills.data),
    experiences: shown(experiences.data),
    services: shown(services.data),
    customSections: custom.error ? [] : (custom.data ?? []),
  }
}

export function PortfolioProvider({ children }) {
  const [state, setState] = useState(() =>
    supabase ? { status: 'loading', data: null, error: null } : { status: 'demo', data: fallback, error: null },
  )

  const load = useCallback(async () => {
    if (!supabase) return
    try {
      const data = await loadAll()
      setState({ status: 'ready', data, error: null })
    } catch (error) {
      console.error('[supabase]', error)
      setState((s) => ({ status: s.data ? 'ready' : 'error', data: s.data, error }))
    }
  }, [])

  useEffect(() => {
    load()
    // Quand on revient sur l'onglet (ex. après une modif dans l'admin), on rafraîchit le contenu.
    const onVisible = () => document.visibilityState === 'visible' && load()
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [load])

  return <PortfolioContext.Provider value={{ ...state, reload: load }}>{children}</PortfolioContext.Provider>
}

export function usePortfolio() {
  const ctx = useContext(PortfolioContext)
  if (!ctx) throw new Error('usePortfolio doit être utilisé dans <PortfolioProvider>')
  return ctx
}

/** Galerie d'un projet publié (images secondaires ordonnées). */
export async function fetchProjectGallery(projectId) {
  if (!supabase || !projectId) return []
  const { data, error } = await supabase
    .from('project_images')
    .select('sort_order, media(id, url, width, height, alt)')
    .eq('project_id', projectId)
  if (error) throw error
  return (data ?? []).sort((a, b) => a.sort_order - b.sort_order).map((r) => r.media).filter(Boolean)
}

/** Envoie un message du formulaire de contact dans la table `messages`. */
export async function sendMessage(payload) {
  if (!supabase) throw new Error("Mode démo : Supabase n'est pas configuré.")
  // Route serveur : enregistre le message + réponse automatique éventuelle
  const r = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).catch(() => null)
  if (r && r.status !== 404 && r.status !== 405) {
    const json = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(json.error || 'Une erreur est survenue. Réessaie dans un instant.')
    return json
  }
  // Route absente (ex. `vite preview`) : enregistrement direct
  const { error } = await supabase.from('messages').insert(payload)
  if (error) throw error
  return { ok: true }
}
