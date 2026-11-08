import { useCallback, useEffect, useState } from 'react'

const KEY = 'theme'

/** Thème initial : choix mémorisé du visiteur, sinon sombre par défaut. */
function initialTheme() {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    /* stockage indisponible (navigation privée…) */
  }
  return 'dark'
}

/**
 * Mode clair / sombre du site public.
 * Le thème est posé sur <html data-theme> ; il est retiré quand on quitte le site public
 * pour que l'admin garde toujours son apparence.
 */
export function useTheme() {
  const [theme, setTheme] = useState(initialTheme)

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = theme
    root.style.background = 'var(--color-bg)'
    return () => {
      delete root.dataset.theme
      root.style.background = ''
    }
  }, [theme])

  const toggle = useCallback(() => {
    setTheme((t) => {
      const next = t === 'dark' ? 'light' : 'dark'
      try {
        localStorage.setItem(KEY, next)
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  return { theme, toggle }
}
