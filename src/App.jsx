import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { PortfolioProvider } from './lib/portfolio'
import PublicLayout from './pages/PublicLayout'
import Home from './pages/Home'
import ProjectPage from './pages/ProjectPage'
import NotFound from './pages/NotFound'

// L'espace admin est chargé à la demande : il n'alourdit pas le site public.
const AdminApp = lazy(() => import('./admin/AdminApp'))

export default function App() {
  return (
    <Routes>
      <Route
        path="/admin-bri/*"
        element={
          <Suspense fallback={<div className="min-h-svh bg-paper" />}>
            <AdminApp />
          </Suspense>
        }
      />
      <Route
        element={
          <PortfolioProvider>
            <PublicLayout />
          </PortfolioProvider>
        }
      >
        <Route index element={<Home />} />
        <Route path="projets/:slug" element={<ProjectPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
