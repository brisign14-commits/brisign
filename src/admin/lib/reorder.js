import { supabase } from '../../lib/supabase'

/** Déplace un élément et renvoie la nouvelle liste (sort_order recalculé). */
export function move(list, from, to) {
  if (to < 0 || to >= list.length) return list
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next.map((x, i) => ({ ...x, sort_order: i + 1 }))
}

/** Enregistre uniquement les sort_order qui ont changé. */
export async function persistOrder(table, before, after) {
  const prev = Object.fromEntries(before.map((x) => [x.id, x.sort_order]))
  const changed = after.filter((x) => prev[x.id] !== x.sort_order)
  const results = await Promise.all(changed.map((x) => supabase.from(table).update({ sort_order: x.sort_order }).eq('id', x.id)))
  const failed = results.find((r) => r.error)
  if (failed) throw failed.error
}
