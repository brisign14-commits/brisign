import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'

const ease = [0.16, 1, 0.3, 1]

/** Valeurs partagées des animations d'entrée / sortie au scroll. */
export const scrollInOut = {
  hidden: (y = 40) => ({ opacity: 0, y, scale: 0.97, filter: 'blur(6px)' }),
  shown: { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' },
  // `once: false` : l'élément rejoue l'animation à chaque entrée et se retire en sortant de l'écran
  viewport: { once: false, amount: 0.15, margin: '-40px 0px -40px 0px' },
}

/** Apparition au scroll (entrée) et disparition quand l'élément quitte l'écran (sortie). */
export default function Reveal({ children, delay = 0, y = 40, className = '', as = 'div' }) {
  const Tag = motion[as]
  return (
    <Tag
      className={className}
      custom={y}
      variants={{ hidden: scrollInOut.hidden, shown: scrollInOut.shown }}
      initial="hidden"
      whileInView="shown"
      viewport={scrollInOut.viewport}
      transition={{ duration: 0.85, delay, ease }}
    >
      {children}
    </Tag>
  )
}

/** Image qui se dévoile de bas en haut en entrant dans l'écran, et se referme en sortant. */
export function ImageReveal({ children, className = '', style }) {
  // L'élément observé (conteneur) est distinct de l'élément masqué : un élément
  // entièrement clippé n'est pas détecté de façon fiable par IntersectionObserver.
  const ref = useRef(null)
  const inView = useInView(ref, { once: false, margin: '0px 0px -10% 0px' })
  return (
    <div ref={ref} className={className} style={style}>
      <motion.div
        className="absolute inset-0"
        initial={{ clipPath: 'inset(100% 0 0 0)', scale: 1.08 }}
        animate={inView ? { clipPath: 'inset(0% 0 0 0)', scale: 1 } : { clipPath: 'inset(100% 0 0 0)', scale: 1.08 }}
        transition={{ duration: 1.1, ease }}
      >
        {children}
      </motion.div>
    </div>
  )
}

/** En-tête de section : libellé orange + titre à gauche, texte d'intro à droite. */
export function SectionHead({ eyebrow, title, intro }) {
  return (
    <header className="grid gap-6 md:grid-cols-2 md:items-end md:gap-12">
      <Reveal>
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="h-section mt-4 max-w-xl">{title}</h2>
      </Reveal>
      {intro && (
        <Reveal delay={0.1} className="md:justify-self-end">
          <p className="max-w-md leading-relaxed text-fog">{intro}</p>
        </Reveal>
      )}
    </header>
  )
}
