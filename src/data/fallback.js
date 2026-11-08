// Mode démo UNIQUEMENT : utilisé quand VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY ne sont pas définis.
// Dès que Supabase est configuré, ces données ne sont plus jamais affichées.
export const fallback = {
  profile: {
    full_name: 'Brillant',
    role: 'Graphiste Designer',
    tagline: 'Je crée des identités et des visuels qui donnent du caractère aux marques.',
    bio: "Graphiste designer passionné par la typographie, la couleur et les identités fortes. J'aime transformer des idées floues en visuels concrets, du logo jusqu'aux supports print, réseaux sociaux et interfaces.",
    location: 'Madagascar, Madagascar',
    email: 'hello@brillant.design',
    available: true,
    years_experience: 3,
    availability_note: 'Ouvert aux missions freelance & collaborations',
    github: null,
    linkedin: 'https://linkedin.com/',
    twitter: null,
    resume_url: null,
    avatar_url: null,
  },
  projects: [
    { id: 1, slug: 'nova', title: 'Nova Café', category: 'Identité visuelle', year: 2026, description: 'Logo, charte graphique et papeterie pour un coffee shop de quartier.', tags: ['Illustrator', 'Photoshop', 'InDesign'], color: '#c8ff3d', featured: true },
    { id: 2, slug: 'pulse', title: 'Pulse Festival', category: 'Print & affiches', year: 2025, description: 'Affiches, flyers et billetterie pour un festival de musique.', tags: ['Illustrator', 'Photoshop'], color: '#8b7bff', featured: true },
    { id: 3, slug: 'orbit', title: 'Orbit Sport', category: 'Réseaux sociaux', year: 2025, description: 'Templates de posts et stories Instagram pour une marque de sport.', tags: ['Photoshop', 'Canva', 'After Effects'], color: '#ff6b4a' },
    { id: 4, slug: 'lumen', title: 'Lumen Store', category: 'UI / Web design', year: 2024, description: 'Maquettes d’une boutique en ligne de cosmétiques, du wireframe au prototype.', tags: ['Figma'], color: '#3de0ff' },
  ],
  skills: [
    { name: 'Photoshop', category: 'Adobe', level: 92 },
    { name: 'Illustrator', category: 'Adobe', level: 90 },
    { name: 'InDesign', category: 'Adobe', level: 80 },
    { name: 'After Effects', category: 'Adobe', level: 65 },
    { name: 'Figma', category: 'UI design', level: 85 },
    { name: 'Canva', category: 'UI design', level: 88 },
    { name: 'Typographie', category: 'Fondamentaux', level: 85 },
    { name: 'Couleur', category: 'Fondamentaux', level: 85 },
    { name: 'Mise en page', category: 'Fondamentaux', level: 82 },
  ],
  experiences: [
    { company: 'Freelance', role: 'Graphiste Designer', period: '2024 — Présent', is_current: true, description: 'Identités visuelles, supports print et visuels réseaux sociaux pour PME et entrepreneurs.', stack: ['Illustrator', 'Photoshop', 'Figma'] },
    { company: 'Studio Créatif', role: 'Graphiste junior', period: '2022 — 2024', description: 'Création d’affiches, de packagings et de campagnes pour des marques locales.', stack: ['Photoshop', 'InDesign'] },
    { company: 'École de design', role: 'Formation en design graphique', period: '2019 — 2022', description: 'Typographie, identité visuelle, mise en page et communication visuelle.', stack: ['Illustrator', 'InDesign'] },
  ],
  customSections: [],
  services: [
    { title: 'Identité visuelle', description: 'Logos, chartes graphiques et univers de marque cohérents.' },
    { title: 'Print & affiches', description: 'Affiches, flyers, packaging et édition qui attirent l’œil.' },
    { title: 'Réseaux sociaux', description: 'Posts, stories et bannières avec une ligne graphique forte.' },
    { title: 'UI / Web design', description: 'Maquettes de sites et d’applications claires et agréables.' },
  ],
}
