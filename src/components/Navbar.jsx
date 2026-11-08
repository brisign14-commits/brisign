import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUpRight, Menu, Moon, Sun, X } from 'lucide-react'
import { Logo } from './shared'
import { navSections } from '../lib/sections'

const ease = [0.16, 1, 0.3, 1]

/**
 * Section active du menu (scroll-spy), y compris les sections personnalisées.
 * Active = la dernière section dont le haut a dépassé 40 % de l'écran ; tout en bas, la dernière.
 * `key` change quand la liste des liens change (section ajoutée / masquée) : on recalcule.
 * `select(id)` : clic sur un lien → actif tout de suite, sans clignoter pendant le défilement.
 */
function useActiveSection(enabled, key) {
  const [active, setActive] = useState(null)
  const lockUntil = useRef(0)

  useEffect(() => {
    if (!enabled) {
      setActive(null)
      return
    }
    let raf = 0
    const compute = () => {
      raf = 0
      if (Date.now() < lockUntil.current) return
      const els = [...document.querySelectorAll('main section[id]')]
      if (!els.length) return
      const line = window.innerHeight * 0.4
      let current = null
      for (const el of els) if (el.getBoundingClientRect().top <= line) current = el.id
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4
      if (atBottom) current = els[els.length - 1].id
      setActive(current)
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(compute)
    }
    // Les sections chargées après coup (ou ré-affichées) sont prises en compte
    const mo = new MutationObserver(onScroll)
    const main = document.querySelector('main')
    if (main) mo.observe(main, { childList: true, subtree: false })
    compute()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      mo.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [enabled, key])

  const select = useCallback((id) => {
    setActive(id)
    lockUntil.current = Date.now() + 1000 // le temps du défilement doux
  }, [])

  return [active, select]
}

/** Bascule clair / sombre. */
function ThemeToggle({ theme, onToggle }) {
  const dark = theme === 'dark'
  return (
    <button
      onClick={onToggle}
      aria-label={dark ? 'Passer en mode clair' : 'Passer en mode sombre'}
      title={dark ? 'Mode clair' : 'Mode sombre'}
      className="relative grid h-10 w-10 place-items-center overflow-hidden rounded-full border border-edge-strong text-fg transition-colors hover:border-signal hover:text-signal"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={theme}
          initial={{ y: 14, opacity: 0, rotate: -60 }}
          animate={{ y: 0, opacity: 1, rotate: 0 }}
          exit={{ y: -14, opacity: 0, rotate: 60 }}
          transition={{ duration: 0.25 }}
        >
          {dark ? <Sun size={17} /> : <Moon size={17} />}
        </motion.span>
      </AnimatePresence>
    </button>
  )
}

export default function Navbar({ profile, custom = [], theme, onToggleTheme }) {
  const { pathname } = useLocation()
  const onHome = pathname === '/'
  const links = [...navSections(profile, custom), { id: 'contact', label: 'Contact' }]
  const [active, select] = useActiveSection(onHome, links.map((l) => l.id).join('|'))
  // Beaucoup de liens (sections ajoutées) : la pilule n'apparaît qu'à partir des grands écrans
  const many = links.length > 7
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const href = (id) => (onHome ? `#${id}` : `/#${id}`)

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 border-b transition-colors duration-500 ${
          scrolled || open ? 'border-edge bg-bg/85 backdrop-blur-xl' : 'border-transparent'
        }`}
      >
        <nav className="container-x flex h-[4.5rem] items-center justify-between gap-6 md:h-[5.5rem]" aria-label="Navigation principale">
          <Logo />

          <div className="flex items-center gap-2">
            {/* Groupe de liens dans une pilule, comme sur la maquette */}
            <ul
              className={`hidden items-center gap-1 rounded-full border border-edge-strong bg-bg/40 p-1 backdrop-blur-md ${many ? 'xl:flex' : 'lg:flex'}`}
            >
              {links.map((s) => {
                const on = active === s.id
                return (
                  <li key={s.id}>
                    <a
                      href={href(s.id)}
                      onClick={() => onHome && select(s.id)}
                      aria-current={on ? 'true' : undefined}
                      title={s.label}
                      className={`block max-w-[11rem] truncate rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                        on ? 'bg-fg text-bg' : 'text-fog hover:text-fg'
                      }`}
                    >
                      {s.label}
                    </a>
                  </li>
                )
              })}
            </ul>
            {onToggleTheme && <ThemeToggle theme={theme} onToggle={onToggleTheme} />}
            <button
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls="mobile-menu"
              aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
              className={`grid h-10 w-10 place-items-center rounded-full border border-edge-strong text-fg ${many ? 'xl:hidden' : 'lg:hidden'}`}
            >
              {open ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </nav>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-menu"
            className={`fixed inset-0 z-40 flex flex-col bg-bg pb-8 pt-24 ${many ? 'xl:hidden' : 'lg:hidden'}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease }}
          >
            <ul className="container-x flex-1 space-y-1 overflow-y-auto">
              {links.map((s, i) => {
                const on = active === s.id
                return (
                  <li key={s.id} className="overflow-hidden border-b border-edge">
                    <motion.a
                      href={href(s.id)}
                      onClick={() => {
                        if (onHome) select(s.id)
                        setOpen(false)
                      }}
                      aria-current={on ? 'true' : undefined}
                      className={`flex items-center justify-between py-5 text-3xl font-medium tracking-tight ${on ? 'text-signal' : 'text-fg'}`}
                      initial={{ y: '100%' }}
                      animate={{ y: 0 }}
                      transition={{ duration: 0.6, delay: 0.05 + i * 0.05, ease }}
                    >
                      <span className="flex items-center gap-3">
                        {on && <span className="h-2 w-2 rounded-full bg-signal" aria-hidden />}
                        {s.label}
                      </span>
                      <ArrowUpRight size={22} className="text-signal" />
                    </motion.a>
                  </li>
                )
              })}
            </ul>
            {profile?.email && (
              <a href={`mailto:${profile.email}`} className="container-x text-fog">
                {profile.email}
              </a>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
