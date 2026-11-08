import ResourceManager from '../components/ResourceManager'
import { Badge } from '../components/ui'

/** "2022-09-01", null, true → "2022 — Présent" */
function periodFrom({ start_date, end_date, is_current }) {
  if (!start_date) return null
  const start = new Date(start_date).getFullYear()
  const end = is_current ? 'Présent' : end_date ? new Date(end_date).getFullYear() : null
  return end && end !== start ? `${start} — ${end}` : String(start)
}

const MONTHS = ['janv', 'fevr', 'mars', 'avr', 'mai', 'juin', 'juil', 'aout', 'sept', 'oct', 'nov', 'dec']

/**
 * Date saisie librement → "AAAA-MM-01" (ou null si vide, undefined si illisible).
 * Accepte : 2019 · 09/2019 · 9-2019 · 2019-09 · sept. 2019 · septembre 2019
 */
function parseDate(raw) {
  const s = String(raw ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
  if (!s) return null
  const year = /(19|20)\d{2}/.exec(s)?.[0]
  if (!year) return undefined
  const rest = s.replace(year, ' ')
  let month = Number(/\b(\d{1,2})\b/.exec(rest)?.[1] || 0)
  if (!month) {
    const i = MONTHS.findIndex((m) => rest.includes(m) || (m === 'fevr' && rest.includes('fev')) || (m === 'juil' && rest.includes('juillet')))
    month = i + 1
  }
  if (month < 0 || month > 12) return undefined
  return `${year}-${String(month || 1).padStart(2, '0')}-01`
}

/** "2019-09-01" → "09/2019" ; "2019-01-01" → "2019" (année seule) */
const showDate = (d) => (!d ? '' : d.slice(5, 7) === '01' ? d.slice(0, 4) : `${d.slice(5, 7)}/${d.slice(0, 4)}`)

export default function Experiences() {
  return (
    <ResourceManager
      table="experiences"
      title="Expériences"
      singular="Expérience"
      description="Postes, missions et formations affichés dans la section Parcours."
      defaults={{ is_current: false, stack: [], visible: true }}
      fields={[
        { name: 'role', label: 'Poste / diplôme', required: true, maxLength: 150, span: 1 },
        { name: 'company', label: 'Organisation', required: true, maxLength: 150, span: 1 },
        { name: 'start_text', label: 'Début', span: 1, placeholder: '2019 ou 09/2019', hint: 'Sert au tri' },
        { name: 'end_text', label: 'Fin', span: 1, placeholder: '2022 ou 06/2022', visible: (f) => !f.is_current },
        { name: 'is_current', label: 'Poste actuel', type: 'toggle', hint: 'Affiche « Présent » et le badge « En poste ».' },
        {
          name: 'period',
          label: 'Période affichée',
          required: true,
          maxLength: 80,
          hint: (f) => (f._periodManual ? 'Texte libre' : 'Remplie depuis les dates, modifiable librement'),
          placeholder: '2022 — 2024, Été 2021, 6 mois…',
        },
        { name: 'description', label: 'Description', type: 'textarea', maxLength: 2000 },
        { name: 'stack', label: 'Outils', type: 'tags' },
        { name: 'visible', label: 'Afficher sur le site', type: 'toggle', hint: 'Désactive pour masquer sans supprimer.' },
      ]}
      onChangeField={(name, value, f) => {
        // Dès que la période est écrite à la main, on ne l'écrase plus
        if (name === 'period') return { _periodManual: String(value).trim() !== '' }
        if (!['start_text', 'end_text', 'is_current'].includes(name) || f._periodManual) return null
        const start = parseDate(f.start_text)
        const end = parseDate(f.end_text)
        const auto = periodFrom({ start_date: start || null, end_date: end || null, is_current: f.is_current })
        return auto ? { period: auto } : null
      }}
      fromRow={(e) => ({
        ...e,
        visible: e.visible !== false,
        start_text: showDate(e.start_date),
        end_text: showDate(e.end_date),
        // Période personnalisée (différente du calcul automatique) : on la protège
        _periodManual: Boolean(e.period) && e.period !== periodFrom(e),
      })}
      toPayload={(f) => ({
        role: f.role,
        company: f.company,
        period: f.period,
        description: f.description,
        stack: f.stack ?? [],
        is_current: Boolean(f.is_current),
        visible: f.visible !== false,
        start_date: parseDate(f.start_text) ?? null,
        end_date: f.is_current ? null : (parseDate(f.end_text) ?? null),
      })}
      validate={(f) => {
        const errs = {}
        const start = parseDate(f.start_text)
        const end = f.is_current ? null : parseDate(f.end_text)
        if (start === undefined) errs.start_text = 'Format : 2019, 09/2019 ou sept. 2019'
        if (end === undefined) errs.end_text = 'Format : 2022, 06/2022 ou juin 2022'
        if (start && end && end < start) errs.end_text = 'La fin doit être après le début.'
        return errs
      }}
      renderItem={(e) => (
        <span className="block">
          <span className="flex items-center gap-2 font-medium">
            {e.role}
            {e.is_current && <Badge tone="signal">En poste</Badge>}
            {e.visible === false && <Badge>Masquée</Badge>}
          </span>
          <span className="text-xs text-mute">
            {e.company} · {e.period}
          </span>
        </span>
      )}
    />
  )
}
