import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Eye, EyeOff, ImagePlus, ListPlus, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { friendlyError, unwrap } from '../lib/errors'
import { isUrl, slugify } from '../lib/format'
import ResourceManager from '../components/ResourceManager'
import MediaPicker from '../components/MediaPicker'
import { Badge, Button, Input, Spinner, useFeedback } from '../components/ui'

/** Mises en page disponibles, et le vocabulaire des champs pour chacune. */
export const LAYOUTS = {
  testimonials: {
    label: 'Retours clients',
    hint: 'Citations avec nom, fonction, note et photo.',
    item: 'Témoignage',
    title: 'Nom du client',
    subtitle: 'Fonction / entreprise',
    body: 'Témoignage',
    image: 'Photo ou logo du client',
    link: false,
  },
  offers: {
    label: 'Offres / recrutement',
    hint: 'Liste d’offres avec étiquettes (contrat, lieu…) et bouton « Postuler ».',
    item: 'Offre',
    title: 'Intitulé de l’offre',
    subtitle: 'Lieu · contrat · durée',
    body: 'Description',
    image: 'Image (facultatif)',
    link: true,
    linkLabel: 'Postuler',
  },
  cards: {
    label: 'Cartes',
    hint: 'Grille de cartes avec image : partenaires, prix, formations, événements…',
    item: 'Carte',
    title: 'Titre',
    subtitle: 'Sous-titre',
    body: 'Texte',
    image: 'Image',
    link: true,
    linkLabel: 'En savoir plus',
  },
  text: {
    label: 'Texte & images',
    hint: 'Blocs de texte alternés avec une image : présentation, engagements, FAQ…',
    item: 'Bloc',
    title: 'Titre du bloc',
    subtitle: 'Petit titre (facultatif)',
    body: 'Texte',
    image: 'Image',
    link: true,
    linkLabel: 'En savoir plus',
  },
}

const MIGRATION_HINT = 'Exécute d’abord supabase/migrations/007_custom_sections.sql dans Supabase (SQL Editor).'
const notInstalled = (e) => /custom_section|relation .* does not exist|schema cache/i.test(e?.message || '')

/* ------------------------------------------------------------------ */
/* Liste des sections                                                   */
/* ------------------------------------------------------------------ */

export default function CustomSections() {
  return (
    <ResourceManager
      table="custom_sections"
      title="Sections"
      singular="Section"
      description="Ajoute tes propres sections à la page d’accueil (retours clients, offres de recrutement, partenaires…). Elles s’affichent juste avant le contact, dans cet ordre. Clique sur « Contenu » pour y ajouter des éléments."
      defaults={{ layout: 'testimonials', visible: true, in_nav: true }}
      fields={[
        { name: 'title', label: 'Titre de la section', required: true, maxLength: 120, placeholder: 'Ils m’ont fait confiance' },
        { name: 'eyebrow', label: 'Petit libellé', maxLength: 60, span: 1, placeholder: 'Retours clients', hint: 'Au-dessus du titre et dans le menu' },
        {
          name: 'layout',
          label: 'Mise en page',
          type: 'select',
          span: 1,
          options: Object.entries(LAYOUTS).map(([value, l]) => ({ value, label: l.label })),
          hint: (f) => LAYOUTS[f.layout]?.hint,
        },
        { name: 'intro', label: 'Introduction', type: 'textarea', rows: 3, maxLength: 600 },
        { name: 'visible', label: 'Afficher sur le site', type: 'toggle', span: 1 },
        { name: 'in_nav', label: 'Lien dans le menu', type: 'toggle', span: 1 },
      ]}
      toPayload={({ title, eyebrow, intro, layout, visible, in_nav, slug }) => ({
        title,
        slug: slug || slugify(title) || `section-${Date.now()}`,
        eyebrow,
        intro,
        layout,
        visible: Boolean(visible),
        in_nav: Boolean(in_nav),
      })}
      renderItem={(s) => (
        <span className="flex items-center gap-2">
          <span className="min-w-0">
            <span className="block truncate font-medium">{s.title}</span>
            <span className="block text-xs text-mute">
              {LAYOUTS[s.layout]?.label} · #{s.slug}
            </span>
          </span>
          {!s.visible && <Badge>Masquée</Badge>}
        </span>
      )}
      rowExtra={(s) => (
        <Button as={Link} to={`/admin-bri/sections/${s.id}`} size="sm" variant="ghost" icon={ListPlus} className="mr-1">
          Contenu
        </Button>
      )}
    />
  )
}

/* ------------------------------------------------------------------ */
/* Contenu d'une section                                                */
/* ------------------------------------------------------------------ */

/** Image choisie dans la médiathèque (ou collée en URL). */
function ImageField({ value, onChange, common }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-md border border-line bg-paper-2">
        {value ? <img src={value} alt="" className="h-full w-full object-cover" /> : <ImagePlus size={18} className="text-mute" />}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Input {...common} type="url" value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder="https://… ou choisir dans la médiathèque" />
        <div className="flex gap-2">
          <Button size="sm" icon={ImagePlus} onClick={() => setOpen(true)}>
            Médiathèque
          </Button>
          {value && (
            <Button size="sm" variant="ghost" icon={Trash2} onClick={() => onChange('')}>
              Retirer
            </Button>
          )}
        </div>
      </div>
      <MediaPicker open={open} folder="misc" onClose={() => setOpen(false)} onSelect={(m) => (onChange(m.url), setOpen(false))} />
    </div>
  )
}

export function SectionItems() {
  const { id } = useParams()
  const { toast } = useFeedback()
  const [section, setSection] = useState(null)
  const filter = useCallback((q) => q.eq('section_id', id), [id])

  useEffect(() => {
    unwrap(supabase.from('custom_sections').select('*').eq('id', id).single())
      .then(setSection)
      .catch((e) => {
        toast.error(notInstalled(e) ? MIGRATION_HINT : friendlyError(e))
        setSection(false)
      })
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (section === null) return <Spinner />
  if (section === false)
    return (
      <Link to="/admin-bri/sections" className="inline-flex items-center gap-1.5 text-sm text-mute hover:text-ink">
        <ArrowLeft size={15} /> Retour aux sections
      </Link>
    )

  const L = LAYOUTS[section.layout] || LAYOUTS.cards
  const fields = [
    { name: 'title', label: L.title, required: true, maxLength: 160 },
    { name: 'subtitle', label: L.subtitle, maxLength: 160 },
    { name: 'body', label: L.body, type: 'textarea', rows: 5, maxLength: 3000 },
    section.layout === 'testimonials' && {
      name: 'rating',
      label: 'Note',
      type: 'select',
      span: 1,
      options: [
        { value: '', label: 'Sans note' },
        ...[5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: `${'★'.repeat(n)}${'☆'.repeat(5 - n)}` })),
      ],
    },
    section.layout === 'offers' && { name: 'tags', label: 'Étiquettes', type: 'tags', placeholder: 'CDI, Télétravail…' },
    { name: 'image_url', label: L.image, render: (form, set, common) => <ImageField value={form.image_url} onChange={(v) => set('image_url', v)} common={common} /> },
    L.link && { name: 'link_url', label: 'Lien du bouton', type: 'url', span: 1, placeholder: section.layout === 'offers' ? 'Vide = formulaire de contact' : 'https://…' },
    L.link && { name: 'link_label', label: 'Texte du bouton', maxLength: 40, span: 1, placeholder: L.linkLabel },
    { name: 'visible', label: 'Afficher sur le site', type: 'toggle' },
  ].filter(Boolean)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/admin-bri/sections" className="inline-flex items-center gap-1.5 text-sm text-mute hover:text-ink">
          <ArrowLeft size={15} /> Toutes les sections
        </Link>
        <span className="inline-flex items-center gap-1.5 text-xs text-mute">
          {section.visible ? <Eye size={14} /> : <EyeOff size={14} />}
          {section.visible ? 'Section affichée sur le site' : 'Section masquée : active-la dans la liste des sections'}
        </span>
      </div>
      <ResourceManager
        table="custom_section_items"
        title={section.title}
        singular={L.item}
        description={`${L.label} — ${L.hint}`}
        filter={filter}
        defaults={{ section_id: id, visible: true, rating: section.layout === 'testimonials' ? '5' : '', tags: [] }}
        fromRow={(row) => ({ ...row, rating: row.rating ? String(row.rating) : '' })}
        fields={fields}
        validate={(f) => ({
          ...(f.image_url && !isUrl(f.image_url) ? { image_url: 'URL invalide (https://…).' } : {}),
          ...(f.link_url && !isUrl(f.link_url) ? { link_url: 'URL invalide (https://…).' } : {}),
        })}
        toPayload={({ title, subtitle, body, rating, tags, image_url, link_url, link_label, visible }) => ({
          section_id: id,
          title,
          subtitle,
          body,
          rating: rating ? Number(rating) : null,
          tags: tags ?? [],
          image_url,
          link_url,
          link_label,
          visible: Boolean(visible),
        })}
        renderItem={(it) => (
          <span className="flex items-center gap-3">
            {it.image_url && <img src={it.image_url} alt="" className="h-9 w-9 shrink-0 rounded object-cover" />}
            <span className="min-w-0">
              <span className="block truncate font-medium">
                {it.title}
                {it.rating ? <span className="ml-2 text-xs text-signal">{'★'.repeat(it.rating)}</span> : null}
              </span>
              {(it.subtitle || it.body) && <span className="block truncate text-xs text-mute">{it.subtitle || it.body}</span>}
            </span>
            {!it.visible && <Badge>Masqué</Badge>}
          </span>
        )}
      />
    </div>
  )
}
