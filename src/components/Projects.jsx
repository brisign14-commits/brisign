import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUpRight } from 'lucide-react'
import { scrollInOut, SectionHead } from './Reveal'
import { coverOf } from '../lib/portfolio'
import { Poster, projectYear, TechList } from './shared'

function ProjectCard({ project, index }) {
  const cover = coverOf(project)
  const year = projectYear(project)

  return (
    <motion.li
      layout
      // Entrée / sortie au scroll ; décalage en quinconce entre les deux colonnes
      custom={60}
      variants={{ hidden: scrollInOut.hidden, shown: scrollInOut.shown }}
      initial="hidden"
      whileInView="shown"
      exit={{ opacity: 0, scale: 0.97 }}
      viewport={scrollInOut.viewport}
      transition={{ duration: 0.9, delay: (index % 2) * 0.12, ease: [0.16, 1, 0.3, 1] }}
    >
      <Link to={`/projets/${project.slug || project.id}`} className="group block">
        <div className="relative aspect-[4/3] overflow-hidden rounded-[1.75rem] border border-edge bg-surface">
          {cover ? (
            <img
              src={cover}
              alt={project.cover?.alt || project.title}
              loading={index < 2 ? 'eager' : 'lazy'}
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1.2s] ease-[cubic-bezier(.16,1,.3,1)] group-hover:scale-[1.05]"
            />
          ) : (
            <Poster project={project} title={false} />
          )}
          {/* Titre en surimpression en haut à gauche (aplat, sans dégradé) */}
          <div className="absolute left-4 top-4 max-w-[75%] rounded-2xl bg-night/85 px-4 py-3 backdrop-blur-sm">
            <h3 className="text-xl font-medium tracking-tight text-white md:text-2xl">{project.title}</h3>
            <p className="mt-1 text-sm text-white/70">{[project.category, year].filter(Boolean).join(' · ')}</p>
          </div>
          {project.featured && (
            <span className="absolute right-5 top-5 rounded-full bg-signal px-3 py-1 text-xs font-medium text-ink">Vedette</span>
          )}
          <span className="absolute bottom-5 right-5 grid h-12 w-12 place-items-center rounded-full bg-white text-ink transition-all duration-500 group-hover:rotate-45 group-hover:bg-signal group-hover:text-ink">
            <ArrowUpRight size={20} />
          </span>
        </div>
        <TechList items={project.tags} size="sm" max={6} className="mt-4" />
      </Link>
    </motion.li>
  )
}

export default function Projects({ projects }) {
  const [filter, setFilter] = useState('Tous')
  const categories = useMemo(() => ['Tous', ...new Set(projects.map((p) => p.category).filter(Boolean))], [projects])
  const visible = filter === 'Tous' ? projects : projects.filter((p) => p.category === filter)

  return (
    <section id="travaux" className="py-24 md:py-32">
      <div className="container-x">
        <SectionHead
          eyebrow="Projets"
          title="Des projets dont je suis fier."
          intro={`${projects.length} projet${projects.length > 1 ? 's' : ''} imaginé${projects.length > 1 ? 's' : ''} et réalisé${projects.length > 1 ? 's' : ''} de A à Z, du brief jusqu’au visuel final.`}
        />

        {categories.length > 2 && (
          <div className="mt-10 flex flex-wrap gap-2" role="group" aria-label="Filtrer par catégorie">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setFilter(c)}
                aria-pressed={filter === c}
                className={`rounded-full px-4 py-2 text-sm transition-colors ${
                  filter === c ? 'bg-signal text-ink' : 'border border-edge text-fog hover:border-edge-strong hover:text-fg'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}

        {visible.length === 0 ? (
          <p className="mt-14 text-fog">Aucun projet publié pour le moment.</p>
        ) : (
          <ul className="mt-10 grid gap-x-5 gap-y-10 md:grid-cols-2">
            <AnimatePresence mode="popLayout">
              {visible.map((p, i) => (
                <ProjectCard key={p.id ?? p.slug} project={p} index={i} />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </section>
  )
}
