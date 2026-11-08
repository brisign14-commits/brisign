import { useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowUpRight } from 'lucide-react'
import { coverOf } from '../lib/portfolio'
import { isShown } from '../lib/sections'

const ease = [0.16, 1, 0.3, 1]
const rise = (delay) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.9, delay, ease },
})

const DEFAULT_TAGS = ['Identité visuelle', 'Print & affiches', 'Réseaux sociaux', 'UI / Web design']

/** Taille de police (md+) pour que le titre occupe exactement la largeur de son conteneur. */
function useFitWidth(text) {
  const boxRef = useRef(null)
  const textRef = useRef(null)
  const [size, setSize] = useState(null)

  useLayoutEffect(() => {
    const box = boxRef.current
    const el = textRef.current
    if (!box || !el) return
    const fit = () => {
      const prev = el.style.fontSize
      el.style.fontSize = '100px'
      const width = el.scrollWidth
      el.style.fontSize = prev
      if (width) setSize((box.clientWidth / width) * 100)
    }
    fit()
    document.fonts?.ready.then(fit)
    const ro = new ResizeObserver(fit)
    ro.observe(box)
    return () => ro.disconnect()
  }, [text])

  return { boxRef, textRef, size }
}

/** Photo en noir et blanc (reste dans la charte, quelle que soit l'image). */
function BwPhoto({ src, alt, className = '', onError, priority }) {
  return (
    <img
      src={src}
      alt={alt}
      onError={onError}
      fetchPriority={priority ? 'high' : undefined}
      className={`contrast-[1.15] grayscale ${className}`}
    />
  )
}

/*
 * Hero plein écran, d'après la maquette « Creative Agency » :
 * fond neutre (suit le thème), portrait au centre, titre géant devant,
 * accroche + bouton en haut à gauche, spécialités en haut à droite,
 * carte photo + carte chiffre en bas à gauche, projets récents en bas à droite.
 * Uniquement les 3 couleurs de la charte, aucun dégradé ; le jaune reste un accent.
 */
export default function Hero({ profile, projects = [], services = [] }) {
  const title = (profile.role || 'Graphiste Designer').toUpperCase()
  const words = title.split(/\s+/)
  const { boxRef, textRef, size } = useFitWidth(title)
  const [imgOk, setImgOk] = useState(true)
  const avatar = imgOk ? profile.avatar_url : null

  const tags = (services.length ? services.map((s) => s.title) : DEFAULT_TAGS).slice(0, 4)
  const covers = projects.map((p) => ({ p, src: coverOf(p) })).filter((x) => x.src)
  const thumbs = covers.slice(0, 4)
  // Carte chiffre : uniquement une valeur réelle
  const stat =
    profile.years_experience > 0
      ? { top: 'Créatif depuis', value: `${profile.years_experience} ans`, bottom: 'd’expérience' }
      : projects.length > 0
        ? { top: 'Déjà', value: `${projects.length}`, bottom: `projet${projects.length > 1 ? 's' : ''} livré${projects.length > 1 ? 's' : ''}` }
        : null
  const cardImg = avatar || covers[0]?.src

  return (
    <section id="top" className="relative isolate flex min-h-svh flex-col overflow-hidden bg-bg text-fg">

      {/* Portrait au centre, posé en bas, derrière le titre */}
      {avatar && (
        <motion.div
          className="pointer-events-none absolute inset-x-0 bottom-0 top-[18%] -z-10 mx-auto w-full max-w-[44rem] md:top-[10%]"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.3, delay: 0.15, ease }}
        >
          <BwPhoto
            src={avatar}
            alt={`Portrait de ${profile.full_name || ''}`}
            priority
            onError={() => setImgOk(false)}
            className="h-full w-full object-contain object-bottom"
          />
        </motion.div>
      )}

      <div className="container-x flex flex-1 flex-col pb-6 pt-24 md:pb-10 md:pt-32">
        {/* Haut : accroche + CTA à gauche, spécialités à droite */}
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <motion.div {...rise(0.3)} className="max-w-[22rem]">
            <p className="text-sm font-medium leading-relaxed md:text-base">
              {profile.tagline || 'Graphiste designer : je crée des identités et des visuels qui donnent du caractère aux marques.'}
            </p>
            <div className="mt-5 flex items-center gap-2">
              <a href="#contact" className="rounded-full bg-signal px-5 py-3 text-sm font-semibold text-ink transition-colors hover:bg-fg hover:text-bg">
                Démarrer un projet
              </a>
              <a
                href={isShown(profile, 'travaux') ? '#travaux' : '#contact'}
                aria-label={isShown(profile, 'travaux') ? 'Voir les travaux' : 'Me contacter'}
                className="grid h-11 w-11 place-items-center rounded-full bg-fg text-bg transition-transform duration-500 hover:rotate-45"
              >
                <ArrowUpRight size={18} />
              </a>
            </div>
          </motion.div>

          <motion.ul {...rise(0.45)} className="flex max-w-md flex-wrap gap-2 md:justify-end" aria-label="Spécialités">
            {tags.map((t) => (
              <li
                key={t}
                className="flex items-center gap-2 rounded-full border border-edge-strong bg-bg/40 px-3.5 py-1.5 text-xs font-medium backdrop-blur-md md:text-sm"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-signal" aria-hidden />
                {t}
              </li>
            ))}
          </motion.ul>
        </div>

        {/* Titre géant, devant le portrait */}
        <div ref={boxRef} className="mt-auto pt-10 md:pt-0">
          <h1
            ref={textRef}
            aria-label={title}
            className="font-brand text-[clamp(2.25rem,10.5vw,6rem)] font-extrabold break-words leading-[0.9] tracking-[-0.035em] md:w-max md:whitespace-nowrap md:[font-size:var(--fit)]"
            style={{ '--fit': size ? `${size}px` : '10vw' }}
          >
            {words.map((w, i) => (
              <span key={i} className="-mt-[0.14em] block overflow-hidden pt-[0.14em] md:inline-block" aria-hidden>
                <motion.span
                  className="inline-block"
                  initial={{ y: '105%' }}
                  animate={{ y: 0 }}
                  transition={{ duration: 1, delay: 0.25 + i * 0.12, ease }}
                >
                  {w}
                </motion.span>
                {i < words.length - 1 && <span className="hidden md:inline">&nbsp;</span>}
              </span>
            ))}
          </h1>
        </div>

        {/* Bas : carte photo + carte chiffre à gauche, projets récents à droite */}
        <div className="mt-6 flex flex-col gap-6 md:mt-8 md:flex-row md:items-end md:justify-between">
          <motion.div {...rise(0.6)} className="flex gap-3">
            {cardImg && (
              <div className="relative aspect-square w-32 overflow-hidden rounded-2xl border border-edge bg-surface md:w-44">
                <BwPhoto src={cardImg} alt="" className="absolute inset-0 h-full w-full object-cover" />
              </div>
            )}
            {stat && (
              <div className="flex w-32 flex-col justify-center rounded-2xl border border-edge-strong bg-bg/50 p-4 backdrop-blur-md md:w-44 md:p-5">
                <span className="text-xs font-medium md:text-sm">{stat.top}</span>
                <span className="font-brand text-3xl font-extrabold leading-tight tracking-[-0.03em] md:text-5xl">{stat.value}</span>
                <span className="text-xs font-medium md:text-sm">{stat.bottom}</span>
              </div>
            )}
          </motion.div>

          {projects.length > 0 && (
            <motion.div {...rise(0.75)} className="self-start rounded-2xl bg-bg/70 p-3 backdrop-blur-md md:self-auto md:backdrop-blur-none md:bg-transparent md:p-0 md:text-right">
              {thumbs.length > 0 && (
                <div className="flex items-center md:justify-end">
                  {thumbs.map(({ p, src }) => (
                    <Link
                      key={p.id ?? p.slug}
                      to={`/projets/${p.slug || p.id}`}
                      title={p.title}
                      className="-ml-2 h-10 w-10 overflow-hidden rounded-full border-2 border-bg bg-surface transition-transform first:ml-0 hover:-translate-y-1"
                    >
                      <img src={src} alt={p.title} className="h-full w-full object-cover" />
                    </Link>
                  ))}
                  <span className="-ml-2 grid h-10 min-w-10 place-items-center rounded-full border-2 border-bg bg-signal px-2 text-xs font-semibold text-ink">
                    {projects.length}
                  </span>
                </div>
              )}
              <div className="mt-3 flex items-center gap-3 md:justify-end">
                <span className="font-brand text-5xl font-extrabold leading-none tracking-[-0.03em] md:text-6xl">
                  {projects.length}
                  <span className="text-signal">+</span>
                </span>
                <span className="text-left text-sm font-medium leading-snug">
                  Projets livrés
                  <br />
                  pour marques & entrepreneurs
                </span>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </section>
  )
}
