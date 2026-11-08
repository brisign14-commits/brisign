import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function NotFound() {
  return (
    <main className="container-x flex min-h-[80svh] flex-col items-start justify-center pt-24">
      <p className="eyebrow">Erreur 404</p>
      <h1 className="mt-5 text-[clamp(3rem,9vw,7.5rem)] font-medium leading-[0.85] tracking-[-0.06em] text-fg">
        Page introuvable<span className="text-signal">.</span>
      </h1>
      <p className="mt-6 max-w-md text-fog">Cette page n’existe pas ou n’est plus publiée.</p>
      <Link to="/" className="btn btn-primary mt-8">
        <ArrowLeft size={16} /> Retour à l’accueil
      </Link>
    </main>
  )
}
