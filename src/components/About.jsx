import { ArrowRight, Briefcase, Download, Mail, MapPin } from 'lucide-react'
import Reveal from './Reveal'
import Carousel from './Carousel'
import { coverOf } from '../lib/portfolio'

/** Bloc « À propos » : grande carte sombre, texte à gauche, visuels à droite. */
export default function About({ profile, projects }) {
  const facts = [
    profile.location && { icon: MapPin, label: 'Basé à', value: profile.location },
    profile.availability_note && { icon: Briefcase, label: 'Disponibilité', value: profile.availability_note },
    profile.email && { icon: Mail, label: 'Email', value: profile.email, href: `mailto:${profile.email}` },
  ].filter(Boolean)
  // Carrousel : ta photo puis TOUS les projets (visuel coloré si le projet n'a pas encore d'image)
  const slides = [
    profile.avatar_url && { src: profile.avatar_url, alt: `Portrait de ${profile.full_name}`, title: profile.full_name, subtitle: profile.role },
    ...projects.map((p) => ({
      src: coverOf(p),
      project: p,
      alt: p.cover?.alt || p.title,
      title: p.title,
      subtitle: p.category,
      to: `/projets/${p.slug || p.id}`,
    })),
  ].filter(Boolean)

  return (
    <section id="a-propos" className="py-24 md:py-32">
      <div className="container-x">
        <div className="card grid gap-10 p-6 md:p-10 lg:grid-cols-12 lg:gap-12 lg:p-14">
          <Reveal className="lg:col-span-7">
            <p className="eyebrow">À propos</p>
            <h2 className="h-section mt-4 text-fg">Des visuels qui font la différence.</h2>
            {profile.bio && <p className="mt-6 leading-relaxed text-fog">{profile.bio}</p>}

            {facts.length > 0 && (
              <ul className="mt-8 space-y-4">
                {facts.map((f) => (
                  <li key={f.label} className="flex items-start gap-4">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-signal/40 text-signal">
                      <f.icon size={17} strokeWidth={1.75} />
                    </span>
                    <span>
                      <span className="block text-xs text-fog">{f.label}</span>
                      {f.href ? (
                        <a href={f.href} className="break-all text-fg hover:text-signal">
                          {f.value}
                        </a>
                      ) : (
                        <span className="text-fg">{f.value}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-9 flex flex-wrap gap-3">
              <a href="#travaux" className="btn btn-primary">
                Voir mes projets <ArrowRight size={16} />
              </a>
              {profile.resume_url && (
                <a href={profile.resume_url} target="_blank" rel="noreferrer" className="btn btn-ghost">
                  Télécharger le CV <Download size={16} />
                </a>
              )}
            </div>
          </Reveal>

          {slides.length > 0 && (
            <Reveal delay={0.1} className="flex items-center justify-center lg:col-span-5">
              <Carousel slides={slides} className="aspect-[4/5] w-full max-w-[20rem] lg:max-w-[22rem]" />
            </Reveal>
          )}
        </div>
      </div>
    </section>
  )
}
