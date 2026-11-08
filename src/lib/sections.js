/**
 * Sections de la page d'accueil que l'on peut masquer depuis l'admin (Profil › Sections du site).
 * Les identifiants masqués sont stockés dans profile.hidden_sections.
 * Le hero et le contact restent toujours visibles.
 */
export const SITE_SECTIONS = [
  { id: 'travaux', label: 'Projets', nav: 'Projets' },
  { id: 'services', label: 'Services', nav: 'Services' },
  { id: 'a-propos', label: 'À propos', nav: 'À propos' },
  { id: 'parcours', label: 'Parcours', nav: 'Parcours' },
  { id: 'stats', label: 'Chiffres clés' },
  { id: 'expertise', label: 'Compétences', nav: 'Compétences' },
]

/** La section est-elle affichée ? */
export const isShown = (profile, id) => !(profile?.hidden_sections ?? []).includes(id)

/** Liens de navigation : sections visibles, puis sections personnalisées marquées « dans le menu ». */
export const navSections = (profile, custom = []) => [
  ...SITE_SECTIONS.filter((s) => s.nav && isShown(profile, s.id)).map((s) => ({ id: s.id, label: s.nav })),
  ...custom.filter((c) => c.in_nav && c.items?.some((it) => it.visible !== false)).map((c) => ({ id: `s-${c.slug}`, label: c.eyebrow || c.title })),
]
