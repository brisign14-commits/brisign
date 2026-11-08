import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText, ImageIcon, Mail, Plus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { count, friendlyError, unwrap } from '../lib/errors'
import { Button, EmptyState, PageHeader, Panel, Spinner } from '../components/ui'
import { formatDate, timeAgo } from '../lib/format'

const head = (table) => supabase.from(table).select('id', { count: 'exact', head: true })

async function loadStats() {
  const [projects, published, drafts, skills, messages, unread, media] = await Promise.all([
    count(head('projects')),
    count(head('projects').eq('status', 'published')),
    count(head('projects').eq('status', 'draft')),
    count(head('skills')),
    count(head('messages')),
    count(head('messages').eq('is_read', false)),
    count(head('media')),
  ])
  const [recentProjects, recentMessages, recentMedia] = await Promise.all([
    unwrap(supabase.from('projects').select('id, title, status, created_at, updated_at').order('updated_at', { ascending: false }).limit(6)),
    unwrap(supabase.from('messages').select('id, name, subject, is_read, created_at').order('created_at', { ascending: false }).limit(6)),
    unwrap(supabase.from('media').select('id, name, created_at').order('created_at', { ascending: false }).limit(6)),
  ])

  const activity = [
    ...recentProjects.map((p) => ({
      key: `p${p.id}`,
      at: p.updated_at || p.created_at,
      icon: FileText,
      to: `/admin-bri/projets/${p.id}`,
      text: (
        <>
          Projet <strong>{p.title}</strong> {Math.abs(new Date(p.updated_at) - new Date(p.created_at)) < 2000 ? 'créé' : 'modifié'}
          {p.status === 'draft' && <span className="text-mute"> · brouillon</span>}
        </>
      ),
    })),
    ...recentMessages.map((m) => ({
      key: `m${m.id}`,
      at: m.created_at,
      icon: Mail,
      to: `/admin-bri/messages?id=${m.id}`,
      text: (
        <>
          Message de <strong>{m.name}</strong>
          {m.subject && <span className="text-mute"> — {m.subject}</span>}
        </>
      ),
      unread: !m.is_read,
    })),
    ...recentMedia.map((m) => ({
      key: `i${m.id}`,
      at: m.created_at,
      icon: ImageIcon,
      to: '/admin-bri/medias',
      text: (
        <>
          Image <strong>{m.name || 'sans nom'}</strong> ajoutée
        </>
      ),
    })),
  ]
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 10)

  return { projects, published, drafts, skills, messages, unread, media, activity }
}

function Stat({ label, value, to, accent }) {
  return (
    <Link to={to} className="group rounded-lg border border-line bg-card p-5 transition-colors hover:border-ink">
      <p className="font-mono text-[10px] uppercase tracking-widest text-mute">{label}</p>
      <p className={`mt-3 font-display text-4xl font-bold tracking-[-0.04em] ${accent ? 'text-signal' : ''}`}>{value}</p>
    </Link>
  )
}

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    loadStats().then(setData).catch((e) => setError(friendlyError(e)))
  }, [])

  return (
    <>
      <PageHeader
        title="Tableau de bord"
        description={`Aperçu du contenu publié sur le portfolio · ${formatDate(new Date())}`}
        actions={
          <Button as={Link} to="/admin-bri/projets/nouveau" variant="primary" icon={Plus}>Nouveau projet</Button>
        }
      />

      {error ? (
        <p className="rounded-md bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>
      ) : !data ? (
        <Spinner />
      ) : (
        <div className="space-y-8">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Stat label="Projets" value={data.projects} to="/admin-bri/projets" />
            <Stat label="Publiés" value={data.published} to="/admin-bri/projets?statut=published" />
            <Stat label="Brouillons" value={data.drafts} to="/admin-bri/projets?statut=draft" />
            <Stat label="Compétences" value={data.skills} to="/admin-bri/competences" />
            <Stat label="Messages" value={data.messages} to="/admin-bri/messages" />
            <Stat label="Non lus" value={data.unread} to="/admin-bri/messages?filtre=non-lus" accent={data.unread > 0} />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Panel title="Activité récente" className="min-w-0 lg:col-span-2">
              {data.activity.length === 0 ? (
                <EmptyState title="Aucune activité" text="Ajoute un projet ou une image pour commencer." />
              ) : (
                <ul className="-my-2 divide-y divide-line">
                  {data.activity.map((a) => (
                    <li key={a.key}>
                      <Link to={a.to} className="flex items-center gap-3 py-3 text-sm hover:text-ink">
                        <a.icon size={15} strokeWidth={1.75} className="shrink-0 text-mute" />
                        <span className="min-w-0 flex-1 truncate">{a.text}</span>
                        {a.unread && <span className="h-1.5 w-1.5 rounded-full bg-signal" />}
                        <span className="shrink-0 text-xs text-mute">{timeAgo(a.at)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Raccourcis">
              <ul className="-my-1 space-y-1 text-sm">
                {[
                  ['/admin-bri/projets/nouveau', 'Ajouter un projet'],
                  ['/admin-bri/medias', `Gérer les médias (${data.media})`],
                  ['/admin-bri/profil', 'Modifier mon profil'],
                  ['/admin-bri/competences', 'Mettre à jour mes compétences'],
                ].map(([to, l]) => (
                  <li key={to}>
                    <Link to={to} className="flex justify-between rounded px-2 py-2 hover:bg-paper-2">
                      {l} <span className="text-mute">→</span>
                    </Link>
                  </li>
                ))}
                <li>
                  <a href="/" target="_blank" rel="noreferrer" className="flex justify-between rounded px-2 py-2 hover:bg-paper-2">
                    Voir le portfolio public <span className="text-mute">↗</span>
                  </a>
                </li>
              </ul>
            </Panel>
          </div>
        </div>
      )}
    </>
  )
}
