import Reveal, { SectionHead } from './Reveal'
import { TechIcon } from './shared'

/** Niveau exprimé en mots plutôt qu'en pourcentage. */
const levelLabel = (l) => (l >= 85 ? 'Expert' : l >= 70 ? 'Avancé' : l >= 50 ? 'Confirmé' : 'Notions')

export default function Skills({ skills }) {
  const groups = Object.entries(
    skills.reduce((acc, s) => {
      ;(acc[s.category || 'Autres'] ??= []).push(s)
      return acc
    }, {}),
  )
  // La carte du milieu (ou la seule) est mise en avant en orange
  const highlight = groups.length >= 3 ? 1 : 0

  return (
    <section id="expertise" className="py-24 md:py-32">
      <div className="container-x">
        <SectionHead
          eyebrow="Compétences"
          title="Les outils que je maîtrise."
          intro={`${skills.length} logiciels et outils que j’utilise au quotidien, regroupés par domaine.`}
        />

        {groups.length === 0 ? (
          <p className="mt-14 text-fog">Aucune compétence renseignée.</p>
        ) : (
          <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {groups.map(([cat, list], gi) => {
              const hot = gi === highlight
              return (
                <Reveal
                  key={cat}
                  delay={gi * 0.06}
                  className={`flex flex-col rounded-[1.75rem] p-7 ${hot ? 'bg-signal text-ink' : 'card text-fg'}`}
                >
                  <p className={`text-sm ${hot ? 'text-ink/75' : 'text-fog'}`}>{cat}</p>
                  <p className="mt-3 flex items-baseline gap-2">
                    <span className="text-5xl font-medium tracking-[-0.04em]">{String(list.length).padStart(2, '0')}</span>
                    <span className={`text-sm ${hot ? 'text-ink/75' : 'text-fog'}`}>outil{list.length > 1 ? 's' : ''}</span>
                  </p>
                  <ul className={`mt-6 space-y-3 border-t pt-6 ${hot ? 'border-ink/20' : 'border-edge'}`}>
                    {list.map((s) => (
                      <li key={s.id ?? s.name} className="flex items-center gap-3">
                        <TechIcon name={s.name} icon={s.icon} size="sm" />
                        <span className="flex-1">{s.name}</span>
                        <span className={`text-xs ${hot ? 'text-ink/70' : 'text-fog'}`}>{levelLabel(s.level ?? 0)}</span>
                      </li>
                    ))}
                  </ul>
                </Reveal>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
