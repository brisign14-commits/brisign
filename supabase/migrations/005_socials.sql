-- =====================================================================
-- 005 — Réseaux sociaux supplémentaires (WhatsApp, Facebook, Instagram…)
--
-- Liste libre dans le profil : [{ "network": "whatsapp", "value": "+261…", "label": null }, …]
-- GitHub / LinkedIn / X gardent leurs colonnes existantes.
--
-- À exécuter dans Supabase › SQL Editor. Ré-exécutable.
-- =====================================================================

alter table public.profile add column if not exists socials jsonb not null default '[]'::jsonb;

alter table public.profile drop constraint if exists profile_socials_check;
alter table public.profile add constraint profile_socials_check
  check (jsonb_typeof(socials) = 'array' and jsonb_array_length(socials) <= 15);
