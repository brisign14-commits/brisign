import { supabase } from '../../lib/supabase'
import { unwrap } from '../lib/errors'
import { slugify } from '../lib/format'
import ResourceManager from '../components/ResourceManager'

export default function Categories() {
  return (
    <ResourceManager
      table="categories"
      title="Catégories"
      singular="Catégorie"
      description="Utilisées pour classer et filtrer les projets sur le portfolio."
      select="*, projects(count)"
      fields={[{ name: 'name', label: 'Nom', required: true, maxLength: 60, placeholder: 'Web App, Mobile, Branding…' }]}
      toPayload={({ name }) => ({ name, slug: slugify(name) })}
      renderItem={(c) => (
        <span className="flex items-baseline justify-between gap-3">
          <span className="font-medium">{c.name}</span>
          <span className="text-xs text-mute">{c.projects?.[0]?.count ?? 0} projet(s)</span>
        </span>
      )}
      // Le nom est aussi recopié sur les projets (colonne texte lue par le site public)
      beforeSave={async (payload, original) => {
        if (original && original.name !== payload.name) {
          await unwrap(supabase.from('projects').update({ category: payload.name }).eq('category_id', original.id))
        }
      }}
      onDelete={async (c) => {
        await unwrap(supabase.from('projects').update({ category: null }).eq('category_id', c.id))
      }}
      beforeDelete={async (c) => {
        const n = c.projects?.[0]?.count ?? 0
        return n
          ? `« ${c.name} » est utilisée par ${n} projet(s). Ils resteront en ligne, sans catégorie.`
          : `Supprimer la catégorie « ${c.name} » ?`
      }}
    />
  )
}
