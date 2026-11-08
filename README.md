# Brillant — Portfolio Graphiste Designer

Portfolio de Brillant, graphiste designer basé à Madagascar : identité visuelle, print, réseaux sociaux et UI design.

**En ligne : https://portfolio-brillant-dev.vercel.app**

## Fonctionnalités

- **Accueil** : présentation, projets, services, parcours, compétences et formulaire de contact
- **Pages projet** (`/projets/:slug`) : description, galerie d'images, outils utilisés et liens
- **Réactions et commentaires** sur chaque projet
- **Assistant de discussion** (bulle en bas à droite) : répond aux questions des visiteurs sur le parcours,
  les projets, les compétences et la disponibilité, en français, en anglais ou en malgache
- **Thème clair / sombre**, animations soignées, mise en page adaptée au mobile

## Stack

| Domaine | Outils |
|---|---|
| Front | React 19, Vite, React Router, Tailwind CSS v4, Framer Motion, Lucide |
| Données | Supabase (PostgreSQL, Storage), sécurisé par Row Level Security |
| Assistant | Fonction serverless Vercel + API Gemini, avec réponses automatiques de secours |
| Hébergement | Vercel (déploiement automatique à chaque push sur `main`) |

## Lancer le projet en local

```bash
npm install
cp .env.example .env.local   # puis remplis les valeurs
npm run dev                  # http://localhost:5173
```

Variables d'environnement (`.env.local` en local, *Settings → Environment Variables* sur Vercel) :

```
VITE_SUPABASE_URL=...        # Supabase → Project Settings → API
VITE_SUPABASE_ANON_KEY=...
GEMINI_API_KEY=...           # optionnel : réponses de l'assistant rédigées par Gemini
```

Sans `GEMINI_API_KEY`, l'assistant répond quand même, à partir des données du portfolio.
Sans les variables Supabase, le site tourne en **mode démo** avec des données d'exemple.

La base de données se crée en exécutant, dans le SQL Editor de Supabase, `supabase/schema.sql`
puis les fichiers de `supabase/migrations/` dans l'ordre.

## Structure

```
api/              fonctions serverless Vercel (assistant, …)
server/           logique serveur partagée entre Vercel et le serveur de dev
src/
  components/     sections du site (Hero, Projects, About, Skills, Experience, Contact, ChatWidget…)
  pages/          Home, ProjectPage, NotFound, PublicLayout
  lib/            client Supabase, chargement des données, thème
supabase/         schéma et migrations SQL
```

## Build

```bash
npm run build     # dossier dist/
npm run preview   # prévisualise le build
```
