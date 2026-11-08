import { ArrowUpRight, Quote } from 'lucide-react'
import Reveal, { SectionHead } from './Reveal'

/** Ancre d'une section personnalisée (lien du menu). */
export const customAnchor = (s) => `s-${s.slug}`

const Stars = ({ n }) => (
  <span className="text-signal" aria-label={`${n} sur 5`}>
    {'★'.repeat(n)}
    <span className="text-fg/20">{'★'.repeat(5 - n)}</span>
  </span>
)

/** Bouton d'action d'un élément (offre, carte, bloc). */
function Action({ item, fallbackLabel, fallbackHref }) {
  const href = item.link_url || fallbackHref
  if (!href) return null
  const external = /^https?:\/\//.test(href)
  return (
    <a href={href} {...(external ? { target: '_blank', rel: 'noreferrer' } : {})} className="btn btn-primary mt-6 self-start !py-2.5">
      {item.link_label || fallbackLabel} <ArrowUpRight size={16} />
    </a>
  )
}

function Testimonials({ items }) {
  return (
    <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {items.map((it, i) => (
        <Reveal key={it.id} delay={i * 0.06} className="card flex flex-col p-7">
          <Quote size={28} className="text-signal" aria-hidden />
          {it.body && <p className="mt-5 flex-1 leading-relaxed text-fg">{it.body}</p>}
          {it.rating ? (
            <p className="mt-5">
              <Stars n={it.rating} />
            </p>
          ) : null}
          <div className="mt-6 flex items-center gap-3 border-t border-edge pt-5">
            {it.image_url ? (
              <img src={it.image_url} alt="" loading="lazy" className="h-11 w-11 rounded-full object-cover" />
            ) : (
              <span className="grid h-11 w-11 place-items-center rounded-full bg-signal font-medium text-ink">{it.title.charAt(0)}</span>
            )}
            <span>
              <span className="block font-medium text-fg">{it.title}</span>
              {it.subtitle && <span className="block text-sm text-fog">{it.subtitle}</span>}
            </span>
          </div>
        </Reveal>
      ))}
    </div>
  )
}

function Offers({ items }) {
  return (
    <ul className="mt-14 space-y-4">
      {items.map((it, i) => (
        <Reveal as="li" key={it.id} delay={i * 0.05} className="card grid gap-6 p-7 md:grid-cols-12 md:items-start">
          <div className="md:col-span-5">
            <h3 className="text-2xl font-medium tracking-tight text-fg">{it.title}</h3>
            {it.subtitle && <p className="mt-1 text-fog">{it.subtitle}</p>}
            {it.tags?.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-2">
                {it.tags.map((t) => (
                  <li key={t} className="rounded-full border border-edge-strong px-3 py-1 text-xs text-fg">
                    {t}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex flex-col md:col-span-7">
            {it.body && <p className="whitespace-pre-line leading-relaxed text-fog">{it.body}</p>}
            <Action item={it} fallbackLabel="Postuler" fallbackHref="#contact" />
          </div>
        </Reveal>
      ))}
    </ul>
  )
}

function Cards({ items }) {
  return (
    <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((it, i) => (
        <Reveal key={it.id} delay={i * 0.06} className="card flex flex-col overflow-hidden">
          {it.image_url && <img src={it.image_url} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover" />}
          <div className="flex flex-1 flex-col p-7">
            {it.subtitle && <p className="text-sm text-fog">{it.subtitle}</p>}
            <h3 className="mt-1 text-xl font-medium tracking-tight text-fg">{it.title}</h3>
            {it.body && <p className="mt-3 flex-1 whitespace-pre-line leading-relaxed text-fog">{it.body}</p>}
            {it.link_url && <Action item={it} fallbackLabel="En savoir plus" />}
          </div>
        </Reveal>
      ))}
    </div>
  )
}

function TextBlocks({ items }) {
  return (
    <div className="mt-14 space-y-16">
      {items.map((it, i) => (
        <Reveal key={it.id} className="grid items-center gap-8 md:grid-cols-2 md:gap-14">
          {it.image_url && (
            <img src={it.image_url} alt="" loading="lazy" className={`w-full rounded-[1.75rem] border border-edge object-cover ${i % 2 ? 'md:order-2' : ''}`} />
          )}
          <div className={it.image_url ? '' : 'md:col-span-2 md:max-w-3xl'}>
            {it.subtitle && <p className="eyebrow">{it.subtitle}</p>}
            <h3 className="mt-3 text-[clamp(1.6rem,3vw,2.4rem)] font-medium leading-tight tracking-[-0.03em] text-fg">{it.title}</h3>
            {it.body && <p className="mt-5 whitespace-pre-line leading-relaxed text-fog">{it.body}</p>}
            {it.link_url && <Action item={it} fallbackLabel="En savoir plus" />}
          </div>
        </Reveal>
      ))}
    </div>
  )
}

const LAYOUT = { testimonials: Testimonials, offers: Offers, cards: Cards, text: TextBlocks }

/** Section créée dans l'admin (Sections) : retours clients, offres, cartes, texte & images. */
export default function CustomSection({ section }) {
  const items = (section.items ?? []).filter((it) => it.visible !== false).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  if (!items.length) return null
  const Body = LAYOUT[section.layout] || Cards
  return (
    <section id={customAnchor(section)} className="py-24 md:py-32">
      <div className="container-x">
        <SectionHead eyebrow={section.eyebrow || section.title} title={section.title} intro={section.intro} />
        <Body items={items} />
      </div>
    </section>
  )
}
