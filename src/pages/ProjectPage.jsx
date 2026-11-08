import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, ArrowUpRight, Calendar, Layers, Palette, Tag } from 'lucide-react'
import { coverOf, fetchProjectGallery, usePortfolio } from '../lib/portfolio'
import { ImageReveal } from '../components/Reveal'
import { Poster, projectYear, TechList } from '../components/shared'
import NotFound from './NotFound'
import ProjectSocial from '../components/ProjectSocial'
import ProjectShare from '../components/ProjectShare'

const ease = [0.16, 1, 0.3, 1]
const rise = (delay) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.9, delay, ease },
})
const pad = (n) => String(n).padStart(2, '0')

/** Ratio réel d'une image (réserve la place, évite les sauts de mise en page). */
const ratioOf = (m) => (m.width && m.height ? `${m.width} / ${m.height}` : '4 / 3')

export default function ProjectPage() {
  const { slug } = useParams()
  const { data } = usePortfolio()
  const projects = data.projects
  const index = projects.findIndex((p) => (p.slug || String(p.id)) === slug)
  const project = projects[index]
  const prev = projects.length > 1 ? projects[(index - 1 + projects.length) % projects.length] : null
  const next = projects.length > 1 ? projects[(index + 1) % projects.length] : null
  const [gallery, setGallery] = useState([])

  const projectId = project?.id
  const projectTitle = project?.title

  // Accolades obligatoires : dans Chrome récent, scrollTo() renvoie une Promise,
  // que React prendrait pour une fonction de nettoyage (→ « destroy is not a function »).
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [slug])

  useEffect(() => {
    if (projectTitle) document.title = `${projectTitle} — ${data.profile.full_name ?? 'Portfolio'}`
  }, [projectTitle, data.profile.full_name])

  useEffect(() => {
    if (!projectId) return
    let cancelled = false
    fetchProjectGallery(projectId)
      .then((g) => !cancelled && setGallery(g))
      .catch((e) => console.error('[galerie]', e))
    return () => {
      cancelled = true
      setGallery([])
    }
  }, [projectId])

  if (!project) return <NotFound />

  const cover = coverOf(project)
  const year = projectYear(project)
  const facts = [
    project.category && { icon: Layers, label: 'Catégorie', value: project.category },
    year && { icon: Calendar, label: 'Année', value: year },
    project.tags?.length > 0 && { icon: Palette, label: 'Outils', value: `${project.tags.length} utilisés` },
    { icon: Tag, label: 'Projet', value: `${pad(index + 1)} / ${pad(projects.length)}` },
  ].filter(Boolean)

  return (
    <main id="top" className="pb-24 pt-28 md:pt-32">
      {/* Fil d'Ariane */}
      <div className="container-x">
        <motion.div {...rise(0)}>
          <Link to="/#travaux" className="btn btn-ghost !py-2 text-sm">
            <ArrowLeft size={15} /> Tous les projets
          </Link>
        </motion.div>
      </div>

      {/* En-tête : titre + description à gauche, fiche à droite */}
      <header className="container-x mt-10 grid gap-10 lg:grid-cols-12 lg:gap-12">
        <div className="lg:col-span-8">
          <motion.p {...rise(0.05)} className="eyebrow">
            {[project.category, year].filter(Boolean).join(' · ') || 'Projet'}
          </motion.p>
          <motion.h1
            {...rise(0.1)}
            className="mt-5 text-[clamp(2.6rem,6.5vw,5.75rem)] font-medium leading-[0.98] tracking-[-0.045em] text-fg"
          >
            {project.title}
            <span className="text-signal">.</span>
          </motion.h1>
          {project.description && (
            <motion.p {...rise(0.2)} className="mt-6 max-w-2xl text-lg leading-relaxed text-fog md:text-xl">
              {project.description}
            </motion.p>
          )}
          {(project.live_url || project.repo_url) && (
            <motion.div {...rise(0.3)} className="mt-8 flex flex-wrap gap-3">
              {project.live_url && (
                <a href={project.live_url} target="_blank" rel="noreferrer" className="btn btn-primary">
                  Voir le projet en ligne <ArrowUpRight size={16} />
                </a>
              )}
              {project.repo_url && (
                <a href={project.repo_url} target="_blank" rel="noreferrer" className="btn btn-ghost">
                  Voir plus de visuels <ArrowUpRight size={16} />
                </a>
              )}
            </motion.div>
          )}
          <motion.div {...rise(0.35)} className="mt-8">
            <ProjectShare title={project.title} image={cover} />
          </motion.div>
        </div>

        <motion.aside {...rise(0.25)} className="card self-start p-6 lg:col-span-4">
          <dl className="divide-y divide-edge">
            {facts.map((f) => (
              <div key={f.label} className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-signal/40 text-signal">
                  <f.icon size={16} strokeWidth={1.75} />
                </span>
                <div>
                  <dt className="text-xs text-fog">{f.label}</dt>
                  <dd className="text-fg">{f.value}</dd>
                </div>
              </div>
            ))}
          </dl>
          {project.tags?.length > 0 && <TechList items={project.tags} className="mt-6 border-t border-edge pt-6" />}
        </motion.aside>
      </header>

      {/* Image principale */}
      <div className="container-x mt-14">
        <ImageReveal className="relative aspect-[16/10] overflow-hidden rounded-[2rem] border border-edge bg-surface md:aspect-[16/8]">
          {cover ? (
            <img src={cover} alt={project.cover?.alt || project.title} className="h-full w-full object-cover" />
          ) : (
            <Poster project={project} large />
          )}
        </ImageReveal>
      </div>

      {/* Galerie en mosaïque : chaque image garde ses proportions, rien n'est recadré */}
      {gallery.length > 0 && (
        <section className="container-x mt-16" aria-label="Galerie">
          <div className="mb-6 flex items-baseline justify-between">
            <h2 className="text-2xl font-medium tracking-tight text-fg">Galerie</h2>
            <span className="text-sm text-fog">
              {gallery.length} image{gallery.length > 1 ? 's' : ''}
            </span>
          </div>
          <div className={gallery.length > 1 ? 'gap-5 md:columns-2' : ''}>
            {gallery.map((m, i) => (
              <a key={m.id} href={m.url} target="_blank" rel="noreferrer" className="mb-5 block break-inside-avoid" title="Ouvrir l’image en grand">
                <ImageReveal
                  className="relative overflow-hidden rounded-[1.75rem] border border-edge bg-surface"
                  style={{ aspectRatio: ratioOf(m) }}
                >
                  <img
                    src={m.url}
                    alt={m.alt || `${project.title} — image ${i + 2}`}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-contain"
                  />
                </ImageReveal>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Réactions + commentaires des visiteurs (1 de chaque par appareil) */}
      <ProjectSocial projectId={project.id} />

      {/* Navigation entre projets */}
      {next && next !== project && (
        <nav className="container-x mt-20 grid gap-4 md:grid-cols-2" aria-label="Autres projets">
          {[
            { p: prev, label: 'Projet précédent', Icon: ArrowLeft },
            { p: next, label: 'Projet suivant', Icon: ArrowRight },
          ]
            .filter(({ p }, i) => p && (i === 1 || p !== next))
            .map(({ p, label, Icon }) => {
              const c = coverOf(p)
              return (
                <Link
                  key={label}
                  to={`/projets/${p.slug || p.id}`}
                  className="group card flex items-center gap-5 p-4 transition-colors hover:border-signal/60 md:p-5"
                >
                  <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-2xl bg-surface-2 md:h-24 md:w-36">
                    {c ? <img src={c} alt="" loading="lazy" className="h-full w-full object-cover" /> : <Poster project={p} title={false} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-fog">{label}</p>
                    <p className="mt-1 truncate text-xl font-medium tracking-tight text-fg md:text-2xl">{p.title}</p>
                  </div>
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ink text-white transition-colors group-hover:bg-signal group-hover:text-ink">
                    <Icon size={18} />
                  </span>
                </Link>
              )
            })}
        </nav>
      )}
    </main>
  )
}
