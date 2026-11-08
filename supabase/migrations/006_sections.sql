-- =====================================================================
-- 006 — Sections du site masquables depuis l'admin (Profil › Sections du site)
--
-- Liste des sections masquées de la page d'accueil, ex. : {expertise,parcours}
-- Identifiants : travaux, services, a-propos, parcours, stats, expertise
--
-- À exécuter dans Supabase › SQL Editor. Ré-exécutable.
-- =====================================================================

alter table public.profile add column if not exists hidden_sections text[] not null default '{}';
