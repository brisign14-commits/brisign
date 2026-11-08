const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
const dateTimeFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const monthFmt = new Intl.DateTimeFormat('fr-FR', { month: 'short', year: 'numeric' })
const rtf = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' })

export const formatDate = (d) => (d ? dateFmt.format(new Date(d)) : '—')
export const formatDateTime = (d) => (d ? dateTimeFmt.format(new Date(d)) : '—')
export const formatMonth = (d) => (d ? monthFmt.format(new Date(d)) : '')

export function timeAgo(d) {
  const s = (new Date(d) - Date.now()) / 1000
  const steps = [
    [60, 'second'],
    [3600, 'minute', 60],
    [86400, 'hour', 3600],
    [604800, 'day', 86400],
    [2629800, 'week', 604800],
    [31557600, 'month', 2629800],
    [Infinity, 'year', 31557600],
  ]
  for (const [limit, unit, div = 1] of steps) if (Math.abs(s) < limit) return rtf.format(Math.round(s / div), unit)
  return ''
}

/** "Mon Projet Été" → "mon-projet-ete" */
export const slugify = (s = '') =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)

export const isUrl = (v) => {
  if (!v) return true
  try {
    const u = new URL(v)
    return u.protocol === 'https:' || u.protocol === 'http:'
  } catch {
    return false
  }
}
