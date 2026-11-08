import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { usePortfolio } from '../lib/portfolio'
import { isShown } from '../lib/sections'
import Hero from '../components/Hero'
import Projects from '../components/Projects'
import Services from '../components/Services'
import About from '../components/About'
import Skills from '../components/Skills'
import Experience from '../components/Experience'
import Stats from '../components/Stats'
import Contact from '../components/Contact'
import CustomSection from '../components/CustomSection'

export default function Home() {
  const { data } = usePortfolio()
  const { profile, projects, skills, experiences, services, customSections = [] } = data
  const { hash } = useLocation()

  useEffect(() => {
    document.title = [profile.full_name, profile.role].filter(Boolean).join(' — ') || 'Portfolio'
  }, [profile.full_name, profile.role])

  // Arrivée depuis une autre page avec une ancre (ex: /#travaux)
  useEffect(() => {
    if (!hash) return
    requestAnimationFrame(() => document.getElementById(hash.slice(1))?.scrollIntoView())
  }, [hash])

  return (
    <main>
      <Hero profile={profile} projects={projects} services={services} />
      {isShown(profile, 'travaux') && <Projects projects={projects} />}
      {isShown(profile, 'services') && <Services services={services} />}
      {isShown(profile, 'a-propos') && <About profile={profile} projects={projects} />}
      {isShown(profile, 'parcours') && <Experience experiences={experiences} />}
      {isShown(profile, 'stats') && <Stats profile={profile} projects={projects} skills={skills} experiences={experiences} />}
      {isShown(profile, 'expertise') && <Skills skills={skills} />}
      {customSections.map((s) => (
        <CustomSection key={s.id} section={s} />
      ))}
      <Contact profile={profile} />
    </main>
  )
}
