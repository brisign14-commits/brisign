import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { isSupabaseReady } from '../lib/supabase'
import { AuthProvider, RequireAdmin, useAuth } from './lib/auth'
import { Button, FeedbackProvider, Spinner } from './components/ui'
import AdminLayout from './components/AdminLayout'
import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'
import Dashboard from './pages/Dashboard'
import ProjectsList from './pages/ProjectsList'
import ProjectEditor from './pages/ProjectEditor'
import Categories from './pages/Categories'
import Skills from './pages/Skills'
import Experiences from './pages/Experiences'
import Services from './pages/Services'
import CustomSections, { SectionItems } from './pages/CustomSections'
import MediaLibrary from './pages/MediaLibrary'
import BrandGenerator from './pages/BrandGenerator'
import Messages from './pages/Messages'
import Comments from './pages/Comments'
import Profile from './pages/Profile'
import Settings from './pages/Settings'

function Centered({ children }) {
  return <div className="flex min-h-svh items-center justify-center bg-paper p-6">{children}</div>
}

function AccessDenied() {
  const { user, signOut } = useAuth()
  return (
    <Centered>
      <div className="max-w-sm text-center">
        <p className="font-mono text-[11px] uppercase tracking-widest text-signal">Accès refusé</p>
        <h1 className="mt-3 font-display text-3xl font-bold tracking-[-0.03em]">Droits insuffisants</h1>
        <p className="mt-3 text-sm text-mute">
          Le compte <strong className="text-ink">{user?.email}</strong> est connecté mais n’est pas administrateur.
        </p>
        <Button variant="primary" className="mt-6" onClick={() => signOut()}>
          Se déconnecter
        </Button>
      </div>
    </Centered>
  )
}

function Protected({ children }) {
  return (
    <RequireAdmin fallback={<Centered><Spinner label="Vérification de la session…" /></Centered>} denied={<AccessDenied />}>
      {children}
    </RequireAdmin>
  )
}

export default function AdminApp() {
  // L'espace admin ne doit jamais être indexé
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    const prevTitle = document.title
    document.title = 'Administration'
    return () => {
      meta.remove()
      document.title = prevTitle
    }
  }, [])

  if (!isSupabaseReady)
    return (
      <Centered>
        <p className="max-w-sm text-center text-sm text-mute">
          Supabase n’est pas configuré. Renseigne <code>VITE_SUPABASE_URL</code> et <code>VITE_SUPABASE_ANON_KEY</code> dans{' '}
          <code>.env.local</code>.
        </p>
      </Centered>
    )

  return (
    <AuthProvider>
      <FeedbackProvider>
        <Routes>
          <Route index element={<Login />} />
          <Route path="reinitialiser" element={<ResetPassword />} />
          <Route
            element={
              <Protected>
                <AdminLayout />
              </Protected>
            }
          >
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="projets" element={<ProjectsList />} />
            <Route path="projets/nouveau" element={<ProjectEditor />} />
            <Route path="projets/:id" element={<ProjectEditor />} />
            <Route path="categories" element={<Categories />} />
            <Route path="competences" element={<Skills />} />
            <Route path="experiences" element={<Experiences />} />
            <Route path="services" element={<Services />} />
            <Route path="sections" element={<CustomSections />} />
            <Route path="sections/:id" element={<SectionItems />} />
            <Route path="medias" element={<MediaLibrary />} />
            <Route path="visuels" element={<BrandGenerator />} />
            <Route path="messages" element={<Messages />} />
            <Route path="commentaires" element={<Comments />} />
            <Route path="profil" element={<Profile />} />
            <Route path="parametres" element={<Settings />} />
          </Route>
          <Route path="*" element={<Navigate to="/admin-bri/dashboard" replace />} />
        </Routes>
      </FeedbackProvider>
    </AuthProvider>
  )
}
