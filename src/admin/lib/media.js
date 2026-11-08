import { BUCKET, SUPABASE_ANON_KEY, SUPABASE_URL, supabase } from '../../lib/supabase'
import { unwrap } from './errors'

/*
 * Gestion des images : Supabase Storage (fichiers) + table `media` (métadonnées).
 * Les binaires ne sont jamais stockés en base, seulement le chemin et l'URL publique.
 */

export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']
export const MAX_SIZE = 5 * 1024 * 1024 // 5 Mo (identique à la limite du bucket)
const MAX_DIMENSION = 2400
const OPTIMIZE_ABOVE = 1.2 * 1024 * 1024

export const formatBytes = (b) =>
  b == null ? '—' : b < 1024 ? `${b} o` : b < 1048576 ? `${(b / 1024).toFixed(0)} Ko` : `${(b / 1048576).toFixed(1)} Mo`

/** Renvoie un message d'erreur, ou null si le fichier est valide. */
export function validateFile(file) {
  if (!ACCEPTED_TYPES.includes(file.type)) return 'Format non pris en charge (JPG, PNG, WebP, AVIF ou GIF).'
  if (file.size > 25 * 1024 * 1024) return 'Fichier trop lourd (25 Mo maximum avant optimisation).'
  return null
}

function loadImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Image illisible ou corrompue.'))
    }
    img.src = url
  })
}

/**
 * Redimensionne (max 2400 px) et convertit en WebP les images lourdes.
 * Les GIF (animés) et AVIF sont conservés tels quels.
 */
export async function optimizeImage(file) {
  const img = await loadImage(file)
  let { naturalWidth: width, naturalHeight: height } = img
  const keep = { blob: file, width, height, type: file.type }

  if (file.type === 'image/gif' || file.type === 'image/avif') return keep
  const tooBig = Math.max(width, height) > MAX_DIMENSION
  if (!tooBig && file.size <= OPTIMIZE_ABOVE) return keep

  const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height))
  width = Math.round(width * scale)
  height = Math.round(height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d').drawImage(img, 0, 0, width, height)
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/webp', 0.86))
  if (!blob || (blob.size >= file.size && !tooBig)) return keep
  return { blob, width, height, type: 'image/webp' }
}

const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif', 'image/gif': 'gif' }

function buildPath(folder, originalName, type) {
  const base =
    originalName
      .replace(/\.[^.]+$/, '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50) || 'image'
  const d = new Date()
  const id = crypto.randomUUID().slice(0, 8)
  return `${folder}/${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${id}-${base}.${EXT[type]}`
}

/** Upload via XHR pour disposer d'une vraie progression (le SDK n'en expose pas). */
async function putObject(path, blob, type, onProgress) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Session expirée, reconnecte-toi.')

  await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`)
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.setRequestHeader('apikey', SUPABASE_ANON_KEY)
    xhr.setRequestHeader('Content-Type', type)
    xhr.setRequestHeader('x-upsert', 'false')
    xhr.setRequestHeader('cache-control', 'max-age=31536000')
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total)
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve()
      let message = `Échec de l'envoi (${xhr.status}).`
      try {
        const body = JSON.parse(xhr.responseText)
        message = body.message || body.error || message
        if (/row-level security|unauthorized/i.test(message)) message = "Upload refusé : droits administrateur requis."
        if (/bucket not found/i.test(message)) message = 'Bucket « portfolio » introuvable : exécute la migration 002.'
        if (/maximum allowed size|too large/i.test(message)) message = 'Fichier trop lourd (5 Mo maximum).'
      } catch {
        /* réponse non JSON */
      }
      reject(new Error(message))
    }
    xhr.onerror = () => reject(new Error('Connexion interrompue pendant l’envoi.'))
    xhr.send(blob)
  })
}

const publicUrl = (path) => supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl

async function prepare(file) {
  const invalid = validateFile(file)
  if (invalid) throw new Error(invalid)
  const optimized = await optimizeImage(file)
  if (optimized.blob.size > MAX_SIZE) throw new Error(`Encore trop lourd après optimisation (${formatBytes(optimized.blob.size)} > 5 Mo).`)
  return optimized
}

/** Envoie une image dans Storage puis enregistre ses métadonnées dans `media`. */
export async function uploadMedia(file, { folder = 'projects', onProgress } = {}) {
  const img = await prepare(file)
  const path = buildPath(folder, file.name, img.type)
  await putObject(path, img.blob, img.type, onProgress)

  const { data, error } = await supabase
    .from('media')
    .insert({
      path,
      url: publicUrl(path),
      name: file.name,
      mime_type: img.type,
      size_bytes: img.blob.size,
      width: img.width,
      height: img.height,
      folder,
    })
    .select()
    .single()

  if (error) {
    await supabase.storage.from(BUCKET).remove([path]) // pas de fichier orphelin
    throw error
  }
  return data
}

/**
 * Remplace le fichier d'un média existant. Toutes les références (projets, galerie,
 * profil) pointent vers l'id du média : elles affichent automatiquement la nouvelle image.
 */
export async function replaceMedia(media, file, { onProgress } = {}) {
  const img = await prepare(file)
  const path = buildPath(media.folder || 'projects', file.name, img.type)
  await putObject(path, img.blob, img.type, onProgress)
  const url = publicUrl(path)

  const { data, error } = await supabase
    .from('media')
    .update({ path, url, name: file.name, mime_type: img.type, size_bytes: img.blob.size, width: img.width, height: img.height })
    .eq('id', media.id)
    .select()
    .single()
  if (error) {
    await supabase.storage.from(BUCKET).remove([path])
    throw error
  }

  // Les colonnes d'URL historiques restent synchronisées
  await Promise.all([
    supabase.from('projects').update({ image_url: url }).eq('cover_media_id', media.id),
    supabase.from('profile').update({ avatar_url: url }).eq('avatar_media_id', media.id),
  ])
  await supabase.storage.from(BUCKET).remove([media.path])
  return data
}

/** Où chaque média est utilisé : { [mediaId]: ['Couverture · Nova', 'Galerie · Pulse', 'Photo de profil'] } */
export async function getMediaUsage() {
  const [covers, gallery, profile] = await Promise.all([
    unwrap(supabase.from('projects').select('title, cover_media_id').not('cover_media_id', 'is', null)),
    unwrap(supabase.from('project_images').select('media_id, projects(title)')),
    unwrap(supabase.from('profile').select('avatar_media_id').not('avatar_media_id', 'is', null)),
  ])
  const usage = {}
  const add = (id, label) => (usage[id] ??= []).push(label)
  covers.forEach((p) => add(p.cover_media_id, `Couverture · ${p.title}`))
  gallery.forEach((g) => add(g.media_id, `Galerie · ${g.projects?.title ?? 'projet'}`))
  profile.forEach((p) => add(p.avatar_media_id, 'Photo de profil'))
  return usage
}

/** Supprime un média seulement s'il n'est plus utilisé nulle part. */
export async function deleteMedia(media) {
  const usage = (await getMediaUsage())[media.id]
  if (usage?.length) throw new Error(`Image encore utilisée : ${usage.join(', ')}.`)
  // La contrainte FK « on delete restrict » protège aussi côté base
  await unwrap(supabase.from('media').delete().eq('id', media.id))
  const { error } = await supabase.storage.from(BUCKET).remove([media.path])
  if (error) console.warn('[storage] fichier non supprimé :', media.path, error.message)
}
