import { ArrowRight, Compass, Image, Layers, Palette, PenTool, Sparkles } from 'lucide-react'
import Reveal, { SectionHead } from './Reveal'

const ICONS = [PenTool, Palette, Image, Layers, Compass, Sparkles]

/** Section claire (contraste avec le reste du site) : les services proposés. */
export default function Services({ services }) {
  if (!services.length) return null
  const cols = services.length >= 4 ? 'lg:grid-cols-4' : services.length === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2'

  return (
    <section id="services" className="bg-cream py-24 text-fg md:py-32">
      <div className="container-x">
        <SectionHead
          light
          eyebrow="Ce que je fais"
          title="Des visuels forts pour des marques qui marquent."
          intro="Du premier croquis au fichier final, j’accompagne chaque étape pour créer des visuels qui attirent l’œil et restent en mémoire."
        />

        <div className={`mt-14 grid gap-4 sm:grid-cols-2 ${cols}`}>
          {services.map((s, i) => {
            const Icon = ICONS[i % ICONS.length]
            // La dernière carte est mise en avant, comme une carte « active »
            const featured = i === services.length - 1
            return (
              <Reveal
                key={s.id ?? s.title}
                delay={i * 0.06}
                className={`group flex flex-col rounded-[1.5rem] p-7 transition-transform duration-500 hover:-translate-y-1 ${
                  featured ? 'bg-ink text-white ring-1 ring-white/10' : 'border border-edge bg-bg'
                }`}
              >
                <span className="grid h-11 w-11 place-items-center rounded-full border border-signal/40 text-signal">
                  <Icon size={19} strokeWidth={1.75} />
                </span>
                <h3 className={`mt-8 text-xl font-medium tracking-tight ${featured ? 'text-signal' : ''}`}>{s.title}</h3>
                {s.description && (
                  <p className={`mt-3 flex-1 leading-relaxed ${featured ? 'text-white/60' : 'text-fog'}`}>{s.description}</p>
                )}
                <a href="#contact" className="mt-8 flex items-center justify-between text-sm font-medium">
                  En discuter
                  <ArrowRight size={16} className="transition-transform duration-300 group-hover:translate-x-1" />
                </a>
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}
