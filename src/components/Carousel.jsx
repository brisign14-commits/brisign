import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, ArrowUpRight } from 'lucide-react'
import { Poster } from './shared'

const ease = [0.16, 1, 0.3, 1]
const variants = {
  enter: (dir) => ({ x: dir > 0 ? '100%' : '-100%', scale: 1.05 }),
  center: { x: '0%', scale: 1 },
  exit: (dir) => ({ x: dir > 0 ? '-30%' : '30%', scale: 0.95, opacity: 0.4 }),
}

/**
 * Carrousel d'images qui glissent.
 * slides: [{ src, alt, title?, subtitle?, to? }]
 * - défilement automatique (pause au survol / au toucher),
 * - flèches, points, glisser au doigt / à la souris, flèches du clavier.
 */
export default function Carousel({ slides, interval = 4500, className = '' }) {
  const [[index, dir], setState] = useState([0, 1])
  const [paused, setPaused] = useState(false)
  const count = slides.length

  const go = useCallback((step) => setState(([i]) => [(i + step + count) % count, step]), [count])
  const goTo = (i) => setState(([cur]) => [i, i > cur ? 1 : -1])

  useEffect(() => {
    if (paused || count < 2) return
    const t = setTimeout(() => go(1), interval)
    return () => clearTimeout(t)
  }, [index, paused, count, interval, go])

  if (!count) return null
  const slide = slides[index % count]

  return (
    <div
      className={`group relative overflow-hidden rounded-[1.5rem] bg-surface-2 ${className}`}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') go(1)
        if (e.key === 'ArrowLeft') go(-1)
      }}
      tabIndex={0}
      role="region"
      aria-roledescription="carrousel"
      aria-label="Images"
    >
      <AnimatePresence initial={false} custom={dir}>
        <motion.div
          key={index}
          custom={dir}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.9, ease }}
          drag={count > 1 ? 'x' : false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.6}
          onDragEnd={(_, info) => {
            if (info.offset.x < -60 || info.velocity.x < -400) go(1)
            else if (info.offset.x > 60 || info.velocity.x > 400) go(-1)
          }}
          className="absolute inset-0 cursor-grab active:cursor-grabbing"
          aria-roledescription="diapositive"
          aria-label={`${(index % count) + 1} sur ${count}`}
        >
          {slide.src ? (
            <img src={slide.src} alt={slide.alt || ''} draggable={false} className="h-full w-full select-none object-cover" />
          ) : (
            // Pas d'image : visuel coloré (le titre est déjà dans la légende)
            slide.project && <Poster project={slide.project} title={false} />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Légende de la diapositive */}
      {(slide.title || slide.subtitle) && (
        <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-end justify-between gap-4 rounded-2xl bg-night/85 p-4 text-white backdrop-blur-sm md:p-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.5, ease }}
            >
              {slide.subtitle && <p className="text-sm text-white/75">{slide.subtitle}</p>}
              {slide.title && <p className="text-xl font-medium tracking-tight md:text-2xl">{slide.title}</p>}
            </motion.div>
          </AnimatePresence>
          {slide.to && (
            <Link
              to={slide.to}
              className="pointer-events-auto grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-ink transition-transform duration-300 hover:rotate-45"
              aria-label={`Voir ${slide.title}`}
            >
              <ArrowUpRight size={18} />
            </Link>
          )}
        </div>
      )}

      {count > 1 && (
        <>
          {/* Flèches */}
          <div className="absolute right-4 top-4 flex gap-2">
            {[
              { step: -1, Icon: ArrowLeft, label: 'Image précédente' },
              { step: 1, Icon: ArrowRight, label: 'Image suivante' },
            ].map(({ step, Icon, label }) => (
              <button
                key={step}
                onClick={() => go(step)}
                aria-label={label}
                className="grid h-10 w-10 place-items-center rounded-full bg-white/85 text-ink backdrop-blur transition-colors hover:bg-signal hover:text-ink"
              >
                <Icon size={17} />
              </button>
            ))}
          </div>

          {/* Points + barre de progression de la diapositive active */}
          <div className="absolute left-5 top-5 flex items-center gap-1.5 md:left-6 md:top-6">
            {slides.map((_, i) => {
              const active = i === index % count
              return (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  aria-label={`Aller à l'image ${i + 1}`}
                  aria-current={active}
                  className={`relative h-1.5 overflow-hidden rounded-full bg-white/40 transition-all duration-500 ${active ? 'w-8' : 'w-1.5'}`}
                >
                  {active && (
                    <motion.span
                      key={`${index}-${paused}`}
                      className="absolute inset-y-0 left-0 bg-white"
                      initial={{ width: '0%' }}
                      animate={{ width: '100%' }}
                      transition={{ duration: paused ? 0 : interval / 1000, ease: 'linear' }}
                    />
                  )}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
