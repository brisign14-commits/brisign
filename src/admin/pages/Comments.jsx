import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, EyeOff, MessageSquare, Search, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { REACTIONS } from '../../lib/social'
import { friendlyError, unwrap } from '../lib/errors'
import { formatDateTime, timeAgo } from '../lib/format'
import { Badge, Button, EmptyState, Input, PageHeader, Panel, Spinner, useFeedback } from '../components/ui'

const MISSING = 'Les tables des commentaires n’existent pas encore : exécute supabase/migrations/003_social.sql dans Supabase.'
const explain = (e) => (['42P01', 'PGRST200', 'PGRST205'].includes(e?.code) || /project_comments|project_reactions/.test(e?.message || '') ? MISSING : friendlyError(e))

const FILTERS = [
  { key: 'all', label: 'Tous' },
  { key: 'visible', label: 'Visibles' },
  { key: 'hidden', label: 'Masqués' },
]

export default function Comments() {
  const { toast, confirm } = useFeedback()
  const [comments, setComments] = useState(null)
  const [reactions, setReactions] = useState([])
  const [projects, setProjects] = useState({})
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')

  useEffect(() => {
    Promise.all([
      unwrap(supabase.from('project_comments').select('id, project_id, author, body, hidden, created_at').order('created_at', { ascending: false })),
      unwrap(supabase.from('project_reactions').select('project_id, reaction')),
      unwrap(supabase.from('projects').select('id, title, slug')),
    ])
      .then(([c, r, p]) => {
        setComments(c)
        setReactions(r)
        setProjects(Object.fromEntries(p.map((x) => [x.id, x])))
      })
      .catch((e) => {
        toast.error(explain(e))
        setComments([])
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Réactions par projet : { projectId: { love: 3, fire: 1, … , total } }
  const reactionStats = useMemo(() => {
    const out = {}
    for (const r of reactions) {
      const s = (out[r.project_id] ??= { total: 0 })
      s[r.reaction] = (s[r.reaction] || 0) + 1
      s.total++
    }
    return Object.entries(out).sort((a, b) => b[1].total - a[1].total)
  }, [reactions])

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (comments ?? []).filter((c) => {
      if (filter === 'visible' && c.hidden) return false
      if (filter === 'hidden' && !c.hidden) return false
      if (!q) return true
      return `${c.author} ${c.body} ${projects[c.project_id]?.title || ''}`.toLowerCase().includes(q)
    })
  }, [comments, filter, query, projects])

  const setHidden = async (c, hidden) => {
    try {
      await unwrap(supabase.from('project_comments').update({ hidden }).eq('id', c.id))
      setComments((l) => l.map((x) => (x.id === c.id ? { ...x, hidden } : x)))
      toast.success(hidden ? 'Commentaire masqué (son auteur le voit encore).' : 'Commentaire de nouveau visible.')
    } catch (e) {
      toast.error(explain(e))
    }
  }

  const remove = async (c) => {
    const ok = await confirm({
      title: 'Supprimer le commentaire',
      message: `Le commentaire de ${c.author} sera définitivement supprimé. Son appareil pourra en écrire un nouveau.`,
      confirmLabel: 'Supprimer',
      danger: true,
    })
    if (!ok) return
    try {
      await unwrap(supabase.from('project_comments').delete().eq('id', c.id))
      setComments((l) => l.filter((x) => x.id !== c.id))
      toast.success('Commentaire supprimé.')
    } catch (e) {
      toast.error(explain(e))
    }
  }

  if (comments === null) return <Spinner />

  const hiddenCount = comments.filter((c) => c.hidden).length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Commentaires"
        description="Réactions et commentaires des visiteurs sur tes projets. Les commentaires s’affichent immédiatement : masque ou supprime ceux qui ne conviennent pas."
      />

      {reactionStats.length > 0 && (
        <Panel title={`Réactions (${reactions.length})`}>
          <ul className="divide-y divide-line">
            {reactionStats.map(([pid, s]) => (
              <li key={pid} className="flex flex-wrap items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <Link to={`/admin-bri/projets/${pid}`} className="min-w-0 truncate text-sm font-medium hover:underline">
                  {projects[pid]?.title || 'Projet supprimé'}
                </Link>
                <span className="flex flex-wrap items-center gap-3 text-sm">
                  {REACTIONS.filter((r) => s[r.key]).map((r) => (
                    <span key={r.key} title={r.label} className="tabular-nums">
                      {r.emoji} {s[r.key]}
                    </span>
                  ))}
                  <span className="text-xs text-mute">· {s.total}</span>
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-md bg-paper-2 p-1 text-sm">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`rounded px-3 py-1.5 transition-colors ${filter === f.key ? 'bg-card font-medium shadow-sm' : 'text-mute hover:text-ink'}`}
            >
              {f.label}
              {f.key === 'hidden' && hiddenCount > 0 ? ` (${hiddenCount})` : f.key === 'all' ? ` (${comments.length})` : ''}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mute" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher…" className="pl-9" aria-label="Rechercher un commentaire" />
        </div>
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title={comments.length ? 'Aucun commentaire pour ce filtre' : 'Aucun commentaire pour l’instant'}
          text="Les visiteurs peuvent laisser un commentaire (un par appareil) en bas de chaque page projet."
        />
      ) : (
        <ul className="space-y-3">
          {list.map((c) => {
            const p = projects[c.project_id]
            return (
              <li key={c.id} className={`rounded-lg border bg-card p-4 ${c.hidden ? 'border-dashed border-line-strong' : 'border-line'}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                      <span className="font-semibold">{c.author}</span>
                      <span className="text-mute">sur</span>
                      {p ? (
                        <a href={`/projets/${p.slug || p.id}`} target="_blank" rel="noreferrer" className="font-medium underline-offset-4 hover:underline">
                          {p.title}
                        </a>
                      ) : (
                        <span className="text-mute">projet supprimé</span>
                      )}
                      <time dateTime={c.created_at} title={formatDateTime(c.created_at)} className="text-xs text-mute">
                        {timeAgo(c.created_at)}
                      </time>
                      {c.hidden && <Badge tone="warning">Masqué</Badge>}
                    </p>
                    <p className={`mt-2 whitespace-pre-line break-words text-sm leading-relaxed ${c.hidden ? 'text-mute' : 'text-ink-2'}`}>{c.body}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button size="sm" variant="ghost" icon={c.hidden ? Eye : EyeOff} onClick={() => setHidden(c, !c.hidden)}>
                      {c.hidden ? 'Afficher' : 'Masquer'}
                    </Button>
                    <Button size="sm" variant="ghost" icon={Trash2} onClick={() => remove(c)} aria-label="Supprimer" className="hover:text-danger" />
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
