-- =====================================================================
-- 008 — Masquer un élément sans le supprimer (compétences, expériences, services)
--
-- Dans l'admin, chaque élément a un interrupteur « Afficher sur le site ».
-- Un élément masqué reste en base mais n'apparaît plus sur le portfolio.
--
-- À exécuter dans Supabase › SQL Editor. Ré-exécutable.
-- =====================================================================

alter table public.skills      add column if not exists visible boolean not null default true;
alter table public.experiences add column if not exists visible boolean not null default true;
alter table public.services    add column if not exists visible boolean not null default true;

-- Exemple : masquer Photoshop (enlève les « -- » pour l'exécuter, ou utilise l'interrupteur dans l'admin)
-- update public.skills set visible = false where lower(name) = 'photoshop';
