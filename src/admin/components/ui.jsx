import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Check, CheckCircle2, Loader2, X } from 'lucide-react'

/* ---------------------------------------------------------------------------
 * Boutons
 * ------------------------------------------------------------------------- */
const VARIANTS = {
  primary: 'bg-ink text-paper hover:bg-ink-2',
  signal: 'bg-signal text-white hover:brightness-95',
  secondary: 'border border-line-strong bg-card text-ink hover:border-ink',
  ghost: 'text-mute hover:bg-paper-2 hover:text-ink',
  danger: 'border border-danger/30 text-danger hover:bg-danger hover:text-white',
}
const SIZES = { sm: 'h-8 px-3 text-[13px] gap-1.5', md: 'h-10 px-4 text-sm gap-2', icon: 'h-9 w-9 justify-center' }

/** `as={Link}` permet d'afficher un lien avec le style d'un bouton (sans imbriquer <button> dans <a>). */
export function Button({ as: Comp = 'button', variant = 'secondary', size = 'md', loading, icon: Icon, children, className = '', ...props }) {
  const isButton = Comp === 'button'
  return (
    <Comp
      {...(isButton ? { type: 'button' } : {})}
      {...props}
      {...(isButton ? { disabled: props.disabled || loading } : {})}
      className={`inline-flex shrink-0 items-center rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    >
      {loading ? <Loader2 size={15} className="animate-spin" /> : Icon && <Icon size={15} strokeWidth={1.75} />}
      {children}
    </Comp>
  )
}

/* ---------------------------------------------------------------------------
 * Champs de formulaire
 * ------------------------------------------------------------------------- */
const inputCls =
  'w-full rounded-md border border-line-strong bg-card px-3 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-mute/60 focus:border-ink aria-[invalid=true]:border-danger'

export function Field({ label, hint, error, required, children, className = '' }) {
  const id = useId()
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="mb-1.5 flex items-baseline justify-between gap-2 text-[13px] font-medium text-ink">
          <span className="shrink-0 whitespace-nowrap">
            {label}
            {required && <span className="text-signal"> *</span>}
          </span>
          {hint && !error && <span className="text-right text-xs font-normal text-mute">{hint}</span>}
        </label>
      )}
      {typeof children === 'function' ? children({ id, invalid: Boolean(error) }) : children}
      {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
    </div>
  )
}

export const Input = ({ className = '', ...p }) => <input {...p} className={`${inputCls} ${className}`} />
export const Textarea = ({ className = '', ...p }) => <textarea {...p} className={`${inputCls} min-h-28 resize-y ${className}`} />
// `size="sm"` : version compacte (en-têtes de panneau…) sans conflit de classes avec la taille par défaut
const selectBase =
  'rounded-md border border-line-strong bg-card text-ink outline-none transition-colors focus:border-ink aria-[invalid=true]:border-danger appearance-none bg-no-repeat cursor-pointer'
const selectSizes = {
  md: 'w-full px-3 py-2.5 pr-8 text-sm bg-[length:12px] bg-[right_0.75rem_center]',
  sm: 'w-auto h-9 pl-3 pr-8 py-0 text-[13px] leading-9 bg-[length:11px] bg-[right_0.65rem_center]',
}
export const Select = ({ className = '', size = 'md', children, ...p }) => (
  <select {...p} className={`${selectBase} ${selectSizes[size] ?? selectSizes.md} ${className}`}
    style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' fill='none' stroke='%23141414' stroke-width='1.5'/%3E%3C/svg%3E\")" }}>
    {children}
  </select>
)

/** Interrupteur activé / désactivé (role="switch", utilisable au clavier). */
export function Toggle({ checked, onChange, label, description, disabled = false }) {
  return (
    <label className={`group flex items-start justify-between gap-4 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {description && <span className="mt-0.5 block text-xs leading-relaxed text-mute">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={Boolean(checked)}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:ring-offset-2 focus-visible:ring-offset-card ${
          checked ? 'bg-success' : 'bg-line-strong group-hover:bg-mute/50'
        }`}
      >
        <span
          className={`grid h-5 w-5 place-items-center rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/0.3)] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        >
          <Check size={12} strokeWidth={3} aria-hidden="true" className={`text-success transition-opacity duration-200 ${checked ? 'opacity-100' : 'opacity-0'}`} />
        </span>
      </button>
    </label>
  )
}

/** Case à cocher assortie (sélections multiples). */
export function Checkbox({ checked, onChange, className = '', ...props }) {
  return (
    <span className={`relative inline-grid h-[18px] w-[18px] shrink-0 place-items-center ${className}`}>
      <input
        type="checkbox"
        checked={Boolean(checked)}
        onChange={onChange}
        {...props}
        className="peer absolute inset-0 m-0 cursor-pointer appearance-none rounded-[5px] border-[1.5px] border-line-strong bg-card outline-none transition-colors checked:border-success checked:bg-success hover:border-ink focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:ring-offset-1"
      />
      <Check size={12} strokeWidth={3.25} aria-hidden="true" className="pointer-events-none relative text-white opacity-0 transition-opacity peer-checked:opacity-100" />
    </span>
  )
}

/** Saisie de tags (technologies) : Entrée ou virgule pour ajouter. */
export function TagInput({ value = [], onChange, placeholder = 'Ajouter puis Entrée', id }) {
  const [draft, setDraft] = useState('')
  const add = (raw) => {
    const items = raw.split(',').map((t) => t.trim()).filter(Boolean)
    const next = [...value]
    items.forEach((t) => !next.some((x) => x.toLowerCase() === t.toLowerCase()) && next.push(t))
    onChange(next)
    setDraft('')
  }
  return (
    <div className={`${inputCls} flex flex-wrap items-center gap-1.5 py-2`}>
      {value.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 rounded bg-paper-2 py-0.5 pl-2 pr-1 text-[13px]">
          {t}
          <button type="button" onClick={() => onChange(value.filter((x) => x !== t))} aria-label={`Retirer ${t}`} className="rounded p-0.5 text-mute hover:text-ink">
            <X size={12} />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={draft}
        onChange={(e) => (e.target.value.endsWith(',') ? add(e.target.value) : setDraft(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && draft.trim()) {
            e.preventDefault()
            add(draft)
          }
          if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1))
        }}
        onBlur={() => draft.trim() && add(draft)}
        placeholder={value.length ? '' : placeholder}
        className="min-w-24 flex-1 bg-transparent outline-none placeholder:text-mute/60"
      />
    </div>
  )
}

/* ---------------------------------------------------------------------------
 * Affichage
 * ------------------------------------------------------------------------- */
const TONES = {
  neutral: 'bg-paper-2 text-ink-2',
  success: 'bg-success/10 text-success',
  warning: 'bg-amber-500/15 text-amber-800',
  signal: 'bg-signal/10 text-signal',
  danger: 'bg-danger/10 text-danger',
}
export const Badge = ({ tone = 'neutral', children, className = '' }) => (
  <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium ${TONES[tone]} ${className}`}>{children}</span>
)

export const Spinner = ({ label = 'Chargement…' }) => (
  <div className="flex items-center justify-center gap-2 py-16 text-sm text-mute">
    <Loader2 size={16} className="animate-spin" /> {label}
  </div>
)

export function PageHeader({ title, description, actions }) {
  return (
    <div className="mb-8 flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-[-0.03em]">{title}</h1>
        {description && <p className="mt-1.5 max-w-xl text-sm text-mute">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function EmptyState({ icon: Icon, title, text, action }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed border-line-strong px-6 py-14 text-center">
      {Icon && <Icon size={22} strokeWidth={1.5} className="text-mute" />}
      <p className="mt-3 font-medium">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-mute">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export const Panel = ({ title, actions, children, className = '' }) => (
  <section className={`rounded-lg border border-line bg-card ${className}`}>
    {title && (
      <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
        <h2 className="text-sm font-semibold">{title}</h2>
        {actions}
      </header>
    )}
    <div className="p-5">{children}</div>
  </section>
)

export const ProgressBar = ({ value }) => (
  <div className="h-1 overflow-hidden rounded-full bg-paper-2">
    <div className="h-full bg-ink transition-[width] duration-200" style={{ width: `${Math.round(value * 100)}%` }} />
  </div>
)

/* ---------------------------------------------------------------------------
 * Modale
 * ------------------------------------------------------------------------- */
export function Modal({ open, onClose, title, children, footer, size = 'md' }) {
  const ref = useRef(null)
  // onClose change à chaque rendu (fonction fléchée du parent) : on le garde dans une ref,
  // sinon l'effet ci-dessous se relance à chaque frappe et vole le focus du champ en cours.
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement
    const onKey = (e) => e.key === 'Escape' && closeRef.current?.()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    ref.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      prev?.focus?.()
    }
  }, [open])

  if (!open) return null
  const width = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' }[size]
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-ink/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title}
        className={`flex max-h-[92svh] w-full ${width} flex-col rounded-t-xl bg-card shadow-xl outline-none sm:rounded-xl`}>
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-semibold">{title}</h2>
          <Button variant="ghost" size="icon" icon={X} onClick={onClose} aria-label="Fermer" />
        </header>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3.5">{footer}</footer>}
      </div>
    </div>,
    document.body,
  )
}

/* ---------------------------------------------------------------------------
 * Notifications + confirmation (contexte global)
 * ------------------------------------------------------------------------- */
const FeedbackContext = createContext(null)

export function FeedbackProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const [confirmState, setConfirmState] = useState(null)

  const push = useCallback((tone, message) => {
    const id = crypto.randomUUID()
    setToasts((t) => [...t, { id, tone, message }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'error' ? 6000 : 3500)
  }, [])

  const toast = useRef({ success: (m) => push('success', m), error: (m) => push('error', m) })
  toast.current.success = (m) => push('success', m)
  toast.current.error = (m) => push('error', m)

  const confirm = useCallback(
    (opts) => new Promise((resolve) => setConfirmState({ ...opts, resolve })),
    [],
  )
  const close = (v) => {
    confirmState?.resolve(v)
    setConfirmState(null)
  }

  return (
    <FeedbackContext.Provider value={{ toast: toast.current, confirm }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[110] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto flex items-start gap-2.5 rounded-lg border border-line bg-card px-4 py-3 text-sm shadow-lg">
            {t.tone === 'success' ? <CheckCircle2 size={17} className="mt-px shrink-0 text-success" /> : <AlertTriangle size={17} className="mt-px shrink-0 text-danger" />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
      <Modal
        open={Boolean(confirmState)}
        onClose={() => close(false)}
        title={confirmState?.title ?? 'Confirmer'}
        size="sm"
        footer={
          <>
            <Button onClick={() => close(false)}>Annuler</Button>
            <Button variant={confirmState?.danger ? 'signal' : 'primary'} onClick={() => close(true)}>
              {confirmState?.confirmLabel ?? 'Confirmer'}
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-ink-2">{confirmState?.message}</p>
      </Modal>
    </FeedbackContext.Provider>
  )
}

export const useFeedback = () => useContext(FeedbackContext)
