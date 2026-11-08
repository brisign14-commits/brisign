import ResourceManager from '../components/ResourceManager'
import { Input } from '../components/ui'

const CATEGORIES = ['Adobe', 'UI design', 'Fondamentaux', 'Motion', 'Outils']
const levelLabel = (l) => (l >= 85 ? 'Expert' : l >= 70 ? 'Avancé' : l >= 50 ? 'Confirmé' : 'Notions')

export default function Skills() {
  return (
    <ResourceManager
      table="skills"
      title="Compétences"
      singular="Compétence"
      description="Regroupées par catégorie sur le portfolio. Le niveau est affiché en mots (Expert, Avancé…)."
      groupBy="category"
      defaults={{ category: 'Adobe', level: 75, visible: true }}
      fromRow={(r) => ({ ...r, visible: r.visible !== false })}
      fields={[
        { name: 'name', label: 'Nom', required: true, maxLength: 60, span: 1, placeholder: 'React' },
        { name: 'category', label: 'Catégorie', required: true, maxLength: 40, span: 1, list: CATEGORIES },
        { name: 'level', label: 'Niveau', type: 'range', hint: (f) => levelLabel(f.level ?? 0) },
        {
          name: 'icon',
          label: 'Icône (facultatif)',
          hint: 'Facultatif — slug simpleicons.org, ex : figma, canva',
          render: (form, set, common) => (
            <div className="flex items-center gap-2">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-line-strong bg-ink">
                {form.icon && <img src={`https://cdn.simpleicons.org/${encodeURIComponent(form.icon)}/f1efe9`} alt="" className="h-4 w-4" />}
              </span>
              <Input {...common} value={form.icon ?? ''} onChange={(e) => set('icon', e.target.value.toLowerCase().trim())} placeholder="figma" />
            </div>
          ),
        },
        { name: 'visible', label: 'Afficher sur le site', type: 'toggle', hint: 'Désactive pour masquer sans supprimer.' },
      ]}
      toPayload={({ name, category, level, icon, visible }) => ({ name, category, level: Math.max(0, Math.min(100, level ?? 0)), icon, visible: visible !== false })}
      renderItem={(s) => (
        <span className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
          <span className="truncate font-medium">
            {s.name}
            {s.visible === false && <span className="ml-2 rounded-full bg-paper-2 px-2 py-0.5 text-[11px] font-normal text-mute">Masquée</span>}
          </span>
          <span className="whitespace-nowrap text-xs text-mute">
            {levelLabel(s.level ?? 0)} · {s.level}
          </span>
        </span>
      )}
    />
  )
}
