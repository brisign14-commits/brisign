import { Briefcase, GraduationCap } from 'lucide-react'
import Reveal, { SectionHead } from './Reveal'
import { TechList } from './shared'

const pad = (n) => String(n).padStart(2, '0')
// Formation détectée par mots-clés pour choisir l'icône
const isSchool = (e) => /licence|master|universit|école|ecole|bac|dipl|formation|bootcamp/i.test(`${e.role} ${e.company}`)

export default function Experience({ experiences }) {
  return (
    <section id="parcours" className="py-24 md:py-32">
      <div className="container-x">
        <SectionHead
          eyebrow="Parcours"
          title="Mon parcours, étape par étape."
          intro="Les expériences et formations qui ont construit mon regard et ma façon de créer."
        />

        {experiences.length === 0 ? (
          <p className="mt-14 text-fog">Aucune expérience renseignée.</p>
        ) : (
          <ol className="mt-14 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {experiences.map((e, i) => {
              const Icon = isSchool(e) ? GraduationCap : Briefcase
              return (
                <Reveal
                  as="li"
                  key={e.id ?? `${e.company}-${i}`}
                  delay={i * 0.05}
                  className={`card flex flex-col p-7 ${e.is_current ? 'border-signal/50' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="grid h-11 w-11 place-items-center rounded-full border border-signal/40 text-signal">
                      <Icon size={18} strokeWidth={1.75} />
                    </span>
                    <span className="text-sm text-fog">{pad(i + 1)}</span>
                  </div>
                  <p className="mt-7 flex flex-wrap items-center gap-2 text-sm text-fog">
                    {e.period}
                    {e.is_current && <span className="rounded-full bg-signal px-2.5 py-0.5 text-xs font-medium text-ink">En poste</span>}
                  </p>
                  <h3 className="mt-2 text-xl font-medium tracking-tight text-fg">{e.role}</h3>
                  <p className="text-signal">{e.company}</p>
                  {e.description && <p className="mt-4 flex-1 leading-relaxed text-fog">{e.description}</p>}
                  <TechList items={e.stack} size="sm" className="mt-6" />
                </Reveal>
              )
            })}
          </ol>
        )}
      </div>
    </section>
  )
}
