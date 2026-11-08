import { useCallback, useEffect, useState, useRef } from 'react'
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { friendlyError, unwrap } from '../lib/errors'
import { move, persistOrder } from '../lib/reorder'
import { Button, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, TagInput, Textarea, Toggle, useFeedback } from './ui'

/*
 * CRUD générique pour les tables simples (catégories, compétences, expériences, services).
 *
 * fields: [{ name, label, type: text|textarea|number|range|select|tags|toggle|date|month,
 *            required, maxLength, options, hint, placeholder, list (datalist), span: 1|2,
 *            render(form, set) (champ sur mesure), visible(form) }]
 */
function FieldInput({ f, form, set, error, options }) {
  const value = form[f.name]
  const onChange = (e) => set(f.name, e?.target ? (f.type === 'number' || f.type === 'range' ? Number(e.target.value) : e.target.value) : e)

  if (f.type === 'toggle') return <Toggle checked={Boolean(value)} onChange={onChange} label={f.label} description={f.hint} />

  return (
    <Field label={f.label} required={f.required} hint={typeof f.hint === 'function' ? f.hint(form) : f.hint} error={error}>
      {({ id, invalid }) => {
        const common = { id, 'aria-invalid': invalid, placeholder: f.placeholder, maxLength: f.maxLength }
        if (f.render) return f.render(form, set, common)
        switch (f.type) {
          case 'textarea':
            return <Textarea {...common} rows={f.rows ?? 4} value={value ?? ''} onChange={onChange} />
          case 'select':
            return (
              <Select {...common} value={value ?? ''} onChange={onChange}>
                {(options ?? f.options).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            )
          case 'tags':
            return <TagInput id={id} value={value ?? []} onChange={onChange} placeholder={f.placeholder} />
          case 'range':
            return (
              <div className="flex items-center gap-3">
                <input id={id} type="range" min={0} max={100} step={1} value={value ?? 0} onChange={onChange} className="flex-1 accent-ink" />
                <span className="w-10 text-right font-mono text-sm">{value ?? 0}</span>
              </div>
            )
          default:
            return (
              <>
                <Input {...common} type={f.type ?? 'text'} value={value ?? ''} onChange={onChange} list={f.list ? `${id}-list` : undefined} />
                {f.list && (
                  <datalist id={`${id}-list`}>
                    {f.list.map((o) => (
                      <option key={o} value={o} />
                    ))}
                  </datalist>
                )}
              </>
            )
        }
      }}
    </Field>
  )
}

export default function ResourceManager({
  table,
  title,
  description,
  singular,
  fields,
  defaults = {},
  select = '*',
  orderable = true,
  renderItem,
  toPayload = (f) => f,
  validate,
  onChangeField, // (name, value, form) => patch partiel
  beforeSave, // async (payload, original) => void
  beforeDelete, // async (item) => message de confirmation | false
  onDelete, // async (item) => appelé après confirmation, juste avant la suppression
  fromRow = (row) => ({ ...row }), // ligne en base → valeurs du formulaire
  groupBy,
  filter, // (requête) => requête filtrée, ex. q => q.eq('section_id', id)
  rowExtra, // (élément) => bouton / lien supplémentaire sur la ligne
}) {
  const { toast, confirm } = useFeedback()
  const [items, setItems] = useState(null)
  const [editing, setEditing] = useState(null) // objet en cours d'édition (nouveau = sans id)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const baseline = useRef(null) // valeurs à l'ouverture de la fenêtre

  /** Empreinte de ce qui serait enregistré (sert à griser le bouton sans modification). */
  const fingerprint = (form) => {
    const p = { ...toPayload({ ...form }) }
    ;['id', 'created_at', 'updated_at', 'sort_order'].forEach((k) => delete p[k])
    return JSON.stringify(
      Object.keys(p)
        .sort()
        .map((k) => [k, typeof p[k] === 'string' ? p[k].trim() || null : (p[k] ?? null)]),
    )
  }
  const dirty = editing ? fingerprint(editing) !== baseline.current : false

  const load = useCallback(async () => {
    try {
      let q = supabase.from(table).select(select)
      if (filter) q = filter(q)
      // Tri sur des colonnes présentes dans TOUTES les tables gérées : `skills` et `experiences`
      // n'ont pas de `created_at` (le demander provoquait l'erreur « base pas à jour »).
      q = orderable ? q.order('sort_order').order('id') : q.order('id')
      setItems(await unwrap(q))
    } catch (e) {
      toast.error(friendlyError(e))
      setItems([])
    }
  }, [table, select, orderable, filter]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load()
  }, [load])

  const set = (name, value) =>
    setEditing((f) => {
      const next = { ...f, [name]: value }
      return onChangeField ? { ...next, ...onChangeField(name, value, next) } : next
    })

  const openNew = () => {
    setErrors({})
    baseline.current = fingerprint({ ...defaults })
    setEditing({ ...defaults })
  }
  const openEdit = (item) => {
    setErrors({})
    const form = fromRow(item)
    baseline.current = fingerprint(form)
    setEditing(form)
  }

  const submit = async (e) => {
    e?.preventDefault()
    if (!dirty) return // rien n'a changé
    const errs = {}
    fields.forEach((f) => {
      const v = editing[f.name]
      if (f.required && (v == null || String(v).trim() === '')) errs[f.name] = 'Requis.'
      else if (f.maxLength && typeof v === 'string' && v.length > f.maxLength) errs[f.name] = `${f.maxLength} caractères max.`
    })
    Object.assign(errs, validate?.(editing) ?? {})
    setErrors(errs)
    if (Object.keys(errs).length) return

    setSaving(true)
    try {
      const original = items.find((x) => x.id === editing.id)
      const payload = toPayload(editing)
      // Ne jamais envoyer les colonnes gérées par la base
      ;['id', 'created_at', 'updated_at'].forEach((k) => delete payload[k])
      Object.keys(payload).forEach((k) => typeof payload[k] === 'string' && (payload[k] = payload[k].trim() || null))
      await beforeSave?.(payload, original)

      if (editing.id) {
        await unwrap(supabase.from(table).update(payload).eq('id', editing.id))
      } else {
        if (orderable) payload.sort_order = Math.max(0, ...items.map((x) => x.sort_order ?? 0)) + 1
        await unwrap(supabase.from(table).insert(payload))
      }
      toast.success(editing.id ? 'Modifications enregistrées.' : `${singular} ajouté(e).`)
      setEditing(null)
      load()
    } catch (err) {
      toast.error(friendlyError(err))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (item) => {
    const custom = beforeDelete ? await beforeDelete(item) : null
    if (custom === false) return
    const ok = await confirm({
      title: `Supprimer`,
      message: custom || 'Cet élément sera définitivement supprimé du portfolio.',
      confirmLabel: 'Supprimer',
      danger: true,
    })
    if (!ok) return
    try {
      await onDelete?.(item)
      await unwrap(supabase.from(table).delete().eq('id', item.id))
      setItems((l) => l.filter((x) => x.id !== item.id))
      toast.success('Supprimé.')
    } catch (e) {
      toast.error(friendlyError(e))
    }
  }

  const reorder = async (index, dir) => {
    const next = move(items, index, index + dir)
    if (next === items) return
    const before = items
    setItems(next)
    try {
      await persistOrder(table, before, next)
    } catch (e) {
      setItems(before)
      toast.error(friendlyError(e))
    }
  }

  const row = (item, index) => (
    <li key={item.id} className="flex items-center gap-3 px-4 py-3">
      <button onClick={() => openEdit(item)} className="min-w-0 flex-1 text-left">
        {renderItem(item)}
      </button>
      <div className="flex shrink-0 items-center">
        {rowExtra?.(item)}
        {orderable && (
          <>
            <Button variant="ghost" size="icon" icon={ArrowUp} disabled={index === 0} onClick={() => reorder(index, -1)} aria-label="Monter" />
            <Button variant="ghost" size="icon" icon={ArrowDown} disabled={index === items.length - 1} onClick={() => reorder(index, 1)} aria-label="Descendre" />
          </>
        )}
        <Button variant="ghost" size="icon" icon={Pencil} onClick={() => openEdit(item)} aria-label="Modifier" />
        <Button variant="ghost" size="icon" icon={Trash2} onClick={() => remove(item)} aria-label="Supprimer" className="hover:text-danger" />
      </div>
    </li>
  )

  const groups = groupBy && items ? Object.entries(items.reduce((a, it, i) => ((a[it[groupBy] || 'Autres'] ??= []).push([it, i]), a), {})) : null

  return (
    <>
      <PageHeader title={title} description={description} actions={<Button variant="primary" icon={Plus} onClick={openNew}>Ajouter</Button>} />

      {items === null ? (
        <Spinner />
      ) : items.length === 0 ? (
        <EmptyState title="Rien pour l’instant" text={`Ajoute ton premier élément : il apparaîtra sur le portfolio.`} action={<Button variant="primary" icon={Plus} onClick={openNew}>Ajouter</Button>} />
      ) : groups ? (
        <div className="space-y-6">
          {groups.map(([g, list]) => (
            <section key={g}>
              <h2 className="mb-2 font-mono text-[11px] uppercase tracking-widest text-mute">
                {g} · {list.length}
              </h2>
              <ul className="divide-y divide-line rounded-lg border border-line bg-card">{list.map(([it, i]) => row(it, i))}</ul>
            </section>
          ))}
        </div>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-card">{items.map(row)}</ul>
      )}

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?.id ? `Modifier` : `Ajouter — ${singular}`}
        footer={
          <>
            <Button onClick={() => setEditing(null)}>Annuler</Button>
            <Button variant="primary" loading={saving} disabled={!dirty} onClick={submit}>
              Enregistrer
            </Button>
          </>
        }
      >
        {editing && (
          <form onSubmit={submit} className="grid gap-5 sm:grid-cols-2">
            {fields
              .filter((f) => !f.visible || f.visible(editing))
              .map((f) => (
                <div key={f.name} className={f.span === 1 ? '' : 'sm:col-span-2'}>
                  <FieldInput f={f} form={editing} set={set} error={errors[f.name]} options={typeof f.options === 'function' ? f.options(items) : undefined} />
                </div>
              ))}
            <button type="submit" hidden />
          </form>
        )}
      </Modal>
    </>
  )
}
