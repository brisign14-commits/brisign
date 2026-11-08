import { useState } from 'react'
import { Check, Link2, Share2 } from 'lucide-react'

/* Logos des réseaux : silhouettes simpleicons en masque CSS, elles prennent la couleur du texte (charte). */
const LINKEDIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z'/%3E%3C/svg%3E\")"

const NETWORKS = [
  { id: 'facebook', label: 'Facebook', href: (u) => `https://www.facebook.com/sharer/sharer.php?u=${u}` },
  { id: 'linkedin', label: 'LinkedIn', href: (u) => `https://www.linkedin.com/sharing/share-offsite/?url=${u}`, mask: LINKEDIN },
  { id: 'whatsapp', label: 'WhatsApp', href: (u, t) => `https://wa.me/?text=${t}%20${u}` },
  { id: 'x', label: 'X', href: (u, t) => `https://twitter.com/intent/tweet?url=${u}&text=${t}` },
  { id: 'pinterest', label: 'Pinterest', href: (u, t, img) => `https://pinterest.com/pin/create/button/?url=${u}&description=${t}${img ? `&media=${img}` : ''}` },
  { id: 'telegram', label: 'Telegram', href: (u, t) => `https://t.me/share/url?url=${u}&text=${t}` },
]

const button =
  'grid h-11 w-11 place-items-center rounded-full border border-edge-strong text-fg transition-colors duration-300 hover:border-signal hover:bg-signal hover:text-ink'

/** Boutons de partage d'un projet publié : réseaux sociaux, lien à copier, partage natif sur mobile. */
export default function ProjectShare({ title, image }) {
  const [copied, setCopied] = useState(false)
  const url = typeof window !== 'undefined' ? window.location.href.split('#')[0] : ''
  const text = `${title} — à découvrir`
  const u = encodeURIComponent(url)
  const t = encodeURIComponent(text)
  const img = image ? encodeURIComponent(image) : ''
  const canNative = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      const el = document.createElement('textarea')
      el.value = url
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      el.remove()
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Partager ce projet">
      <span className="mr-1 text-sm text-fog">Partager</span>
      {NETWORKS.map((n) => (
        <a key={n.id} href={n.href(u, t, img)} target="_blank" rel="noreferrer" className={button} title={`Partager sur ${n.label}`} aria-label={`Partager sur ${n.label}`}>
          <span
            aria-hidden
            className="h-[18px] w-[18px] bg-current"
            style={{
              maskImage: n.mask || `url(https://cdn.simpleicons.org/${n.id})`,
              WebkitMaskImage: n.mask || `url(https://cdn.simpleicons.org/${n.id})`,
              maskSize: 'contain',
              WebkitMaskSize: 'contain',
              maskRepeat: 'no-repeat',
              WebkitMaskRepeat: 'no-repeat',
              maskPosition: 'center',
              WebkitMaskPosition: 'center',
            }}
          />
        </a>
      ))}
      <button type="button" onClick={copy} className={button} title="Copier le lien" aria-label="Copier le lien">
        {copied ? <Check size={18} /> : <Link2 size={18} />}
      </button>
      {canNative && (
        <button type="button" onClick={() => navigator.share({ title, text, url }).catch(() => {})} className={button} title="Plus d’options" aria-label="Plus d’options de partage">
          <Share2 size={18} />
        </button>
      )}
      <span className="sr-only" aria-live="polite">
        {copied ? 'Lien copié' : ''}
      </span>
      {copied && <span className="text-sm text-fog">Lien copié</span>}
    </div>
  )
}
