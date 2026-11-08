import { supabase } from './supabase'

/** Les 5 réactions proposées (clé stockée en base → affichage). */
export const REACTIONS = [
  { key: 'love', emoji: '❤️', label: 'J’adore' },
  { key: 'fire', emoji: '🔥', label: 'Top' },
  { key: 'clap', emoji: '👏', label: 'Bravo' },
  { key: 'wow', emoji: '🤩', label: 'Wow' },
  { key: 'idea', emoji: '💡', label: 'Inspirant' },
]

const STORAGE_KEY = 'bp-device-id'
let memoryId = null

/**
 * Identifiant anonyme de l'appareil (UUID aléatoire, gardé dans le navigateur).
 * La base n'en stocke qu'une empreinte : il sert seulement à appliquer
 * « 1 réaction + 1 commentaire par appareil ».
 */
export function deviceId() {
  try {
    let id = localStorage.getItem(STORAGE_KEY)
    if (!id || !/^[0-9a-f-]{36}$/.test(id)) {
      id = crypto.randomUUID()
      localStorage.setItem(STORAGE_KEY, id)
    }
    return id
  } catch {
    // Stockage bloqué (navigation privée stricte…) : valable pour cette visite seulement
    memoryId ??= crypto.randomUUID()
    return memoryId
  }
}

const call = async (fn, args) => {
  if (!supabase) throw new Error('Mode démo : réactions et commentaires indisponibles.')
  const { data, error } = await supabase.rpc(fn, args)
  if (error) {
    if (/function .* does not exist|Could not find the function/i.test(error.message)) throw new Error('Fonction indisponible : exécute la migration 003_social.sql.')
    throw new Error(error.message)
  }
  return data
}

export const fetchSocial = (projectId) => call('project_social', { p_project: projectId, p_device: deviceId() })
export const react = (projectId, reaction) => call('react_to_project', { p_project: projectId, p_device: deviceId(), p_reaction: reaction })
export const comment = (projectId, author, body) => call('comment_on_project', { p_project: projectId, p_device: deviceId(), p_author: author, p_body: body })
export const deleteMyComment = (projectId) => call('delete_my_project_comment', { p_project: projectId, p_device: deviceId() })
