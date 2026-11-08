import ResourceManager from '../components/ResourceManager'

export default function Services() {
  return (
    <ResourceManager
      table="services"
      title="Services"
      singular="Service"
      description="Ce que tu apportes — liste numérotée affichée dans la section À propos."
      fields={[
        { name: 'title', label: 'Titre', required: true, maxLength: 60, placeholder: 'Performance' },
        { name: 'description', label: 'Description', type: 'textarea', maxLength: 300, rows: 3 },
        { name: 'visible', label: 'Afficher sur le site', type: 'toggle', hint: 'Désactive pour masquer sans supprimer.' },
      ]}
      defaults={{ visible: true }}
      fromRow={(r) => ({ ...r, visible: r.visible !== false })}
      toPayload={({ title, description, visible }) => ({ title, description, visible: visible !== false })}
      renderItem={(s) => (
        <span className="block">
          <span className="font-medium">
            {s.title}
            {s.visible === false && <span className="ml-2 rounded-full bg-paper-2 px-2 py-0.5 text-[11px] font-normal text-mute">Masquée</span>}
          </span>
          {s.description && <span className="block truncate text-xs text-mute">{s.description}</span>}
        </span>
      )}
    />
  )
}
