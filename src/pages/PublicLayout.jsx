import { Outlet } from 'react-router-dom'
import { usePortfolio } from '../lib/portfolio'
import { useTheme } from '../lib/theme'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import ChatWidget from '../components/ChatWidget'

function Splash({ children }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-bg px-5 text-center text-fog">{children}</div>
  )
}

export default function PublicLayout() {
  const { status, data, error, reload } = usePortfolio()
  const { theme, toggle } = useTheme()

  if (status === 'loading')
    return (
      <Splash>
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-edge-strong border-t-signal" aria-hidden />
        <span className="text-sm">Chargement…</span>
      </Splash>
    )
  if (status === 'error')
    return (
      <Splash>
        <p>Le contenu n’a pas pu être chargé ({error?.message}).</p>
        <button onClick={reload} className="btn btn-primary">
          Réessayer
        </button>
      </Splash>
    )

  return (
    <div className="min-h-svh bg-bg text-fg selection:bg-signal selection:text-ink">
      <Navbar profile={data.profile} custom={data.customSections} theme={theme} onToggleTheme={toggle} />
      <Outlet />
      <Footer profile={data.profile} custom={data.customSections} demo={status === 'demo'} />
      {status !== 'demo' && <ChatWidget profile={data.profile} />}
    </div>
  )
}
