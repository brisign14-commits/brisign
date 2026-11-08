import { useCallback, useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Briefcase, ExternalLink, FolderKanban, Images, LayoutDashboard, LayoutList, LogOut, Layers, Mail, Menu, MessageSquare, Palette, Settings, Tags, User, Wrench, X,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../lib/auth'
import { useFeedback } from './ui'
import { BrandMark } from '../../components/shared'

/** Logo admin : monogramme B + point orange + « Admin » en Poppins ExtraBold. */
const AdminBrand = ({ className = '' }) => (
  <span className={`flex items-center gap-2 ${className}`}>
    <span className="flex items-end gap-[2px]">
      <BrandMark className="h-5 w-auto text-ink" />
      <span className="mb-px h-[5px] w-[5px] rounded-full bg-signal" aria-hidden="true" />
    </span>
    <span className="font-brand text-[15px] font-extrabold tracking-[-0.01em]">Admin</span>
  </span>
)

const NAV = [
  {
    group: 'Général',
    items: [
      { to: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
      { to: 'messages', label: 'Messages', icon: Mail, badge: 'unread' },
      { to: 'commentaires', label: 'Commentaires', icon: MessageSquare },
    ],
  },
  {
    group: 'Contenu',
    items: [
      { to: 'projets', label: 'Projets', icon: FolderKanban },
      { to: 'categories', label: 'Catégories', icon: Tags },
      { to: 'competences', label: 'Compétences', icon: Wrench },
      { to: 'experiences', label: 'Expériences', icon: Briefcase },
      { to: 'services', label: 'Services', icon: Layers },
      { to: 'sections', label: 'Sections', icon: LayoutList },
      { to: 'medias', label: 'Médias', icon: Images },
      { to: 'visuels', label: 'Visuels de marque', icon: Palette },
    ],
  },
]

// Compte : icônes compactes en bas de la barre latérale
const ACCOUNT = [
  { to: 'profil', label: 'Profil', icon: User },
  { to: 'parametres', label: 'Paramètres', icon: Settings },
]

const iconBtn = 'grid h-9 w-9 place-items-center rounded-md transition-colors'

/** Événement global pour rafraîchir le compteur de messages non lus. */
export const refreshUnread = () => window.dispatchEvent(new Event('admin:unread'))

export default function AdminLayout() {
  const { user, signOut } = useAuth()
  const { confirm } = useFeedback()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)

  const loadUnread = useCallback(async () => {
    const { count } = await supabase.from('messages').select('id', { count: 'exact', head: true }).eq('is_read', false)
    setUnread(count ?? 0)
  }, [])

  useEffect(() => {
    loadUnread()
    window.addEventListener('admin:unread', loadUnread)
    return () => window.removeEventListener('admin:unread', loadUnread)
  }, [loadUnread])

  useEffect(() => setOpen(false), [pathname])

  // Présence : tant que l'admin est ouvert et visible, tu es « en ligne »
  // (la réponse automatique ne part que lorsque tu es hors ligne).
  useEffect(() => {
    const beat = () => document.visibilityState === 'visible' && supabase.rpc('admin_heartbeat').then(() => {}, () => {})
    beat()
    const timer = setInterval(beat, 60_000)
    document.addEventListener('visibilitychange', beat)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', beat)
    }
  }, [])

  const logout = async () => {
    if (!(await confirm({ title: 'Déconnexion', message: 'Fermer la session administrateur sur cet appareil ?', confirmLabel: 'Se déconnecter' }))) return
    await signOut()
    navigate('/admin-bri', { replace: true })
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-14 shrink-0 items-center border-b border-line justify-between px-5">
        <AdminBrand />
        <button className="rounded p-1 text-mute lg:hidden" onClick={() => setOpen(false)} aria-label="Fermer le menu">
          <X size={18} />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4 pt-3">
        {NAV.map((g) => (
          <div key={g.group} className="mt-5 first:mt-1">
            <p className="px-2 pb-1.5 font-mono text-[10px] uppercase tracking-widest text-mute/80">{g.group}</p>
            <ul className="space-y-0.5">
              {g.items.map((it) => (
                <li key={it.to}>
                  <NavLink
                    to={`/admin-bri/${it.to}`}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors ${
                        isActive ? 'bg-ink text-paper' : 'text-ink-2 hover:bg-paper-2'
                      }`
                    }
                  >
                    <it.icon size={16} strokeWidth={1.75} />
                    <span className="flex-1">{it.label}</span>
                    {it.badge === 'unread' && unread > 0 && (
                      <span className="rounded-full bg-signal px-1.5 text-[11px] font-semibold leading-5 text-white">{unread}</span>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

    </div>
  )

  return (
    <div className="min-h-svh bg-paper text-ink">
      <aside className="fixed inset-y-0 left-0 hidden w-60 border-r border-line bg-card lg:block">{sidebar}</aside>

      {open && <div className="fixed inset-0 z-40 bg-ink/30 lg:hidden" onClick={() => setOpen(false)} />}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 border-r border-line bg-card transition-transform duration-300 lg:hidden ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-hidden={!open}
      >
        {sidebar}
      </aside>

      {/* Barre supérieure fixe : navigation mobile + compte (icônes) */}
      <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-card/90 px-4 backdrop-blur sm:px-6 lg:left-60">
        <button onClick={() => setOpen(true)} className="-ml-1.5 rounded p-1.5 hover:bg-paper-2 lg:hidden" aria-label="Ouvrir le menu">
          <Menu size={20} />
        </button>
        <AdminBrand className="lg:hidden" />

        <div className="ml-auto flex items-center gap-1">
          {unread > 0 && (
            <NavLink to="/admin-bri/messages" className="mr-2 rounded-full bg-signal px-2 text-xs font-semibold leading-5 text-white">
              {unread} non lu{unread > 1 ? "s" : ""}
            </NavLink>
          )}
          <span className="mr-2 hidden max-w-56 truncate text-xs text-mute md:block" title={user?.email}>
            {user?.email}
          </span>
          {ACCOUNT.map((it) => (
            <NavLink
              key={it.to}
              to={`/admin-bri/${it.to}`}
              title={it.label}
              aria-label={it.label}
              className={({ isActive }) => `${iconBtn} ${isActive ? "bg-ink text-paper" : "text-ink-2 hover:bg-paper-2"}`}
            >
              <it.icon size={17} strokeWidth={1.75} />
            </NavLink>
          ))}
          <a href="/" target="_blank" rel="noreferrer" title="Voir le site" aria-label="Voir le site" className={`${iconBtn} text-ink-2 hover:bg-paper-2`}>
            <ExternalLink size={17} strokeWidth={1.75} />
          </a>
          <span className="mx-1 h-5 w-px bg-line" aria-hidden />
          <button onClick={logout} title="Déconnexion" aria-label="Déconnexion" className={`${iconBtn} text-ink-2 hover:bg-danger/10 hover:text-danger`}>
            <LogOut size={17} strokeWidth={1.75} />
          </button>
        </div>
      </header>

      <main className="px-4 pb-8 pt-22 sm:px-8 lg:ml-60 lg:px-10 lg:pb-10 lg:pt-24">
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
