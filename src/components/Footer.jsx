import { ArrowUp, Globe } from 'lucide-react'
import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { navSections } from '../lib/sections'
import { Logo } from './shared'
import { profileSocials } from '../lib/socials'

// Identifiants Simple Icons (logos officiels, couleurs de la marque)
const SIMPLE_ICONS = {
  github: 'github',
  x: 'x',
  whatsapp: 'whatsapp',
  facebook: 'facebook',
  instagram: 'instagram',
  tiktok: 'tiktok',
  youtube: 'youtube',
  telegram: 'telegram',
  behance: 'behance',
  dribbble: 'dribbble',
  malt: 'malt',
}

// LinkedIn a fait retirer son logo de Simple Icons : version SVG intégrée, couleur officielle
const LinkedInLogo = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
    <rect width="24" height="24" rx="4" fill="#111111" />
    <rect x="5" y="9.5" width="3" height="9.5" fill="#F7F7F7" />
    <circle cx="6.5" cy="6.3" r="1.75" fill="#F7F7F7" />
    <path d="M10.5 9.5h2.9v1.3c.5-.9 1.6-1.6 3.1-1.6 2.6 0 3.5 1.6 3.5 4.3v5.5h-3v-4.9c0-1.2-.3-2.2-1.6-2.2-1.4 0-1.9 1-1.9 2.3v4.8h-3z" fill="#F7F7F7" />
  </svg>
)

function SocialLogo({ network }) {
  const [failed, setFailed] = useState(false)
  if (network === 'linkedin') return <LinkedInLogo />
  const slug = SIMPLE_ICONS[network]
  if (!slug || failed) return <Globe size={19} className="text-ink" aria-hidden="true" />
  return <img src={`https://cdn.simpleicons.org/${slug}/111111`} alt="" loading="lazy" onError={() => setFailed(true)} className="h-5 w-5 object-contain" />
}

export default function Footer({ profile, custom = [], demo }) {
  const { pathname } = useLocation()
  const href = (id) => (pathname === '/' ? `#${id}` : `/#${id}`)
  const socials = profileSocials(profile)

  return (
    <footer className="border-t border-edge pt-16">
      <div className="container-x grid gap-10 pb-12 md:grid-cols-12">
        <div className="md:col-span-5">
          <Logo />
          {profile.tagline && <p className="mt-5 max-w-xs leading-relaxed text-fog">{profile.tagline}</p>}
          {socials.length > 0 && (
            <ul className="mt-6 flex flex-wrap gap-2.5">
              {socials.map((s) => (
                <li key={s.href}>
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noreferrer"
                    title={s.label}
                    aria-label={s.label}
                    className="group/social relative grid h-11 w-11 place-items-center rounded-full border border-edge bg-white shadow-sm transition-transform duration-300 hover:-translate-y-1"
                  >
                    <SocialLogo network={s.network} />
                    <span className="pointer-events-none absolute -top-8 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[11px] text-white opacity-0 transition-opacity group-hover/social:opacity-100">
                      {s.label}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        <nav className="md:col-span-3 md:col-start-7" aria-label="Plan du site">
          <p className="text-sm font-medium text-fg">Navigation</p>
          <ul className="mt-4 space-y-2.5">
            {navSections(profile, custom).map((s) => (
              <li key={s.id}>
                <a href={href(s.id)} className="text-fog transition-colors hover:text-fg">
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="md:col-span-3">
          <p className="text-sm font-medium text-fg">Contact</p>
          <ul className="mt-4 space-y-2.5 text-fog">
            {profile.email && (
              <li>
                <a href={`mailto:${profile.email}`} className="break-all transition-colors hover:text-fg">
                  {profile.email}
                </a>
              </li>
            )}
            {profile.location && <li>{profile.location}</li>}
            {profile.availability_note && <li>{profile.availability_note}</li>}
          </ul>
        </div>
      </div>

      <div className="container-x flex flex-wrap items-center justify-between gap-4 border-t border-edge py-6 text-sm text-fog">
        <p>
          © {new Date().getFullYear()} {profile.full_name}. Tous droits réservés.
          {demo && <span className="text-signal"> · Mode démo</span>}
        </p>
        <a href="#top" className="flex items-center gap-2 transition-colors hover:text-fg">
          Retour en haut <ArrowUp size={14} />
        </a>
      </div>
    </footer>
  )
}
