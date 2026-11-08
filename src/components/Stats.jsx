import Reveal from './Reveal'

/** Bandeau orange de chiffres clés — uniquement des valeurs calculées depuis la base. */
export default function Stats({ profile, projects, skills, experiences }) {
  const items = [
    projects.length > 0 && { value: projects.length, label: 'Projets réalisés' },
    profile.years_experience > 0 && { value: `${profile.years_experience}+`, label: 'Années d’expérience' },
    skills.length > 0 && { value: skills.length, label: 'Logiciels maîtrisés' },
    experiences.length > 0 && { value: experiences.length, label: 'Expériences & formations' },
  ].filter(Boolean)
  if (items.length < 2) return null

  return (
    <section aria-label="Chiffres clés" className="container-x">
      <Reveal className="grid grid-cols-2 gap-y-8 rounded-[1.75rem] bg-signal px-6 py-10 text-ink md:grid-cols-4 md:px-12">
        {items.map((it) => (
          <div key={it.label} className="text-center">
            <p className="text-[clamp(2.25rem,4.5vw,3.5rem)] font-medium leading-none tracking-[-0.04em]">{it.value}</p>
            <p className="mt-2 text-sm text-ink/75">{it.label}</p>
          </div>
        ))}
      </Reveal>
    </section>
  )
}
