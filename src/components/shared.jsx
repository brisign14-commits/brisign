import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Camera, Clapperboard, LayoutTemplate, Monitor, Package, Palette, PenTool, Printer, Shapes, Stamp, Type, WandSparkles } from 'lucide-react'
import { HORIZ, ICON } from './brandPaths'

/**
 * Logo Brisign, tracés exacts de la charte (voir brandPaths.js).
 * - parties noires = currentColor (passent en #F7F7F7 sur fond sombre) ;
 * - parties jaunes = #F4B000, sauf `mono` où tout prend currentColor.
 */
function BrandSvg({ art, className, title, mono }) {
  return (
    <svg viewBox={`0 0 ${art.w} ${art.h}`} className={className} role={title ? 'img' : undefined} aria-hidden={title ? undefined : true}>
      {title && <title>{title}</title>}
      <path d={art.y} fill={mono ? 'currentColor' : '#F4B000'} fillRule="evenodd" />
      <path d={art.k} fill="currentColor" fillRule="evenodd" />
    </svg>
  )
}

/** Icône seule (le « B » à plume). */
export function BrandMark({ className = '', title, mono = false }) {
  return <BrandSvg art={ICON} className={className} title={title} mono={mono} />
}

/** Logo horizontal : icône + « Brisign », exactement comme la variante de droite de la charte. */
export function Logo({ mono = false, className = '' }) {
  return (
    <Link to="/" className={`group flex items-center ${mono ? 'text-ink' : 'text-fg'} ${className}`} aria-label="Brisign — accueil">
      <BrandSvg art={HORIZ} mono={mono} className="h-10 w-auto transition-transform duration-500 group-hover:scale-[1.03]" />
    </Link>
  )
}

/* ------------------------------------------------------------------ */
/* Logos des technologies (simpleicons.org, en noir de la charte)      */
/* ------------------------------------------------------------------ */

// Noms courants → identifiant simpleicons quand la conversion automatique ne suffit pas
const TECH_ALIASES = {
  'react native': 'react',
  'react.js': 'react',
  reactjs: 'react',
  tailwind: 'tailwindcss',
  'tailwind css': 'tailwindcss',
  'node.js': 'nodedotjs',
  node: 'nodedotjs',
  nodejs: 'nodedotjs',
  'next.js': 'nextdotjs',
  nextjs: 'nextdotjs',
  'vue.js': 'vuedotjs',
  vue: 'vuedotjs',
  'nuxt.js': 'nuxt',
  'express.js': 'express',
  postgres: 'postgresql',
  gsap: 'greensock',
  java: 'openjdk',
  'c#': 'dotnet',
  '.net': 'dotnet',
  'c++': 'cplusplus',
  html: 'html5',
  css: 'css',
  css3: 'css',
  sql: 'mysql',
  aws: 'amazonwebservices',
  'framer motion': 'framer',
  'tanstack router': 'tanstack',
  'tanstack query': 'reactquery',
  'react query': 'reactquery',
  'react router': 'reactrouter',
  'vs code': 'visualstudiocode',
  vscode: 'visualstudiocode',
}

/** Identifiant simpleicons d'une technologie à partir de son nom (ou d'un slug fourni). */
export function techSlug(name, icon) {
  if (icon) return icon
  const key = String(name || '').trim().toLowerCase()
  if (TECH_ALIASES[key]) return TECH_ALIASES[key]
  return key.replace(/\+/g, 'plus').replace(/\./g, 'dot').replace(/[^a-z0-9]/g, '')
}

/*
 * Icônes des compétences, dans la charte (#111111 / #F4B000 / #F7F7F7) :
 * - logiciels sans logo disponible (Adobe, Canva…) → tuile monogramme façon Adobe ;
 * - savoir-faire (typographie, couleur…) → pictogramme ;
 * - autres → logo simpleicons en noir, sinon pictogramme générique.
 * Clés en minuscules, sans le préfixe « adobe ».
 */
const MONOGRAMS = {
  photoshop: 'Ps',
  illustrator: 'Ai',
  indesign: 'Id',
  'after effects': 'Ae',
  'premiere pro': 'Pr',
  premiere: 'Pr',
  lightroom: 'Lr',
  'lightroom classic': 'Lr',
  xd: 'Xd',
  animate: 'An',
  audition: 'Au',
  dimension: 'Dn',
  firefly: 'Ff',
  express: 'Ex',
  'creative cloud': 'Cc',
  canva: 'Ca',
  coreldraw: 'Cd',
  procreate: 'Pc',
  'affinity designer': 'Ad',
  'affinity photo': 'Ap',
  'affinity publisher': 'Ap',
}

const GLYPHS = {
  typographie: Type,
  typography: Type,
  couleur: Palette,
  couleurs: Palette,
  'colorimétrie': Palette,
  'mise en page': LayoutTemplate,
  layout: LayoutTemplate,
  'édition': LayoutTemplate,
  branding: Stamp,
  'identité visuelle': Stamp,
  logo: Stamp,
  'retouche photo': WandSparkles,
  retouche: WandSparkles,
  photomontage: WandSparkles,
  illustration: PenTool,
  dessin: PenTool,
  vectorisation: PenTool,
  'motion design': Clapperboard,
  motion: Clapperboard,
  'montage vidéo': Clapperboard,
  packaging: Package,
  print: Printer,
  impression: Printer,
  'ui design': Monitor,
  'web design': Monitor,
  'ui / ux': Monitor,
  photographie: Camera,
  photo: Camera,
}

const iconKey = (name) => String(name || '').trim().toLowerCase().replace(/^adobe\s+/, '')

/** Infobulle commune (nom de la compétence au survol). */
function Tip({ name }) {
  return (
    <span className="pointer-events-none absolute -top-8 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[11px] text-white opacity-0 transition-opacity group-hover/tech:opacity-100">
      {name}
    </span>
  )
}

/**
 * Icône d'un outil ou d'une compétence, dans une pastille (lisible en clair comme en sombre).
 * Le nom apparaît au survol.
 */
export function TechIcon({ name, icon, size = 'md' }) {
  const [failed, setFailed] = useState(false)
  const key = iconKey(name)
  const box = size === 'sm' ? 'h-8 w-8' : 'h-10 w-10'
  const glyphSize = size === 'sm' ? 15 : 18

  // 1. Monogramme (logiciels)
  const mono = !icon && MONOGRAMS[key]
  if (mono) {
    return (
      <span
        title={name}
        className={`group/tech relative grid ${box} shrink-0 place-items-center rounded-[0.6rem] bg-ink font-semibold tracking-tight text-signal shadow-sm ring-1 ring-signal/40 transition-transform duration-300 hover:-translate-y-0.5 ${
          size === 'sm' ? 'text-[0.7rem]' : 'text-[0.85rem]'
        }`}
      >
        {mono}
        <Tip name={name} />
      </span>
    )
  }

  // 2. Pictogramme (savoir-faire) — aussi en secours si aucun logo n'existe
  const Glyph = (!icon && GLYPHS[key]) || (failed ? Shapes : null)
  const slug = techSlug(name, icon)
  if (Glyph || !slug) {
    const G = Glyph || Shapes
    return (
      <span
        title={name}
        className={`group/tech relative grid ${box} shrink-0 place-items-center rounded-full border border-edge bg-white text-ink shadow-sm transition-transform duration-300 hover:-translate-y-0.5`}
      >
        <G size={glyphSize} strokeWidth={1.9} aria-hidden />
        <Tip name={name} />
      </span>
    )
  }

  // 3. Logo simpleicons, en noir de la charte
  const src = /^https?:\/\//.test(slug) ? slug : `https://cdn.simpleicons.org/${encodeURIComponent(slug)}/111111`
  const img = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'
  return (
    <span
      title={name}
      className={`group/tech relative grid ${box} shrink-0 place-items-center rounded-full border border-edge bg-white shadow-sm transition-transform duration-300 hover:-translate-y-0.5`}
    >
      <img src={src} alt={name} loading="lazy" onError={() => setFailed(true)} className={`${img} object-contain`} />
      <Tip name={name} />
    </span>
  )
}

/** Rangée de logos de technologies. */
export function TechList({ items, size = 'md', max, className = '' }) {
  if (!items?.length) return null
  const shown = max ? items.slice(0, max) : items
  const rest = items.length - shown.length
  return (
    <ul className={`flex flex-wrap items-center gap-2 ${className}`} aria-label="Outils">
      {shown.map((t) => (
        <li key={t}>
          <TechIcon name={t} size={size} />
        </li>
      ))}
      {rest > 0 && <li className="text-xs text-fog">+{rest}</li>}
    </ul>
  )
}

/** Visuel typographique quand un projet n'a pas encore d'image : aplat jaune de la charte, sans dégradé. */
export function Poster({ project, large = false, title = true }) {
  return (
    <div className="absolute inset-0 flex items-end bg-signal p-6 md:p-8">
      {title && (
        <span
          className={`font-medium leading-[0.9] tracking-[-0.04em] text-ink ${
            large ? 'text-[clamp(3rem,9vw,8rem)]' : 'text-[clamp(2.25rem,5vw,4rem)]'
          }`}
        >
          {project.title}
        </span>
      )}
    </div>
  )
}

/** Année d'un projet (champ `year` ou date du projet). */
export const projectYear = (p) => p.year || (p.project_date ? new Date(p.project_date).getFullYear() : null)
