-- =====================================================================
-- 004 — Réponse automatique aux messages du formulaire de contact
--
--   * Réglages privés (table lisible / modifiable uniquement par l'admin).
--   * L'admin ouvert dans un navigateur signale sa présence (admin_heartbeat).
--   * Le serveur demande seulement « faut-il répondre maintenant ? »
--     (auto_reply_due) : il n'obtient ni l'heure de présence, ni rien d'autre.
--
-- À exécuter dans Supabase › SQL Editor (après 003_social.sql). Ré-exécutable.
-- =====================================================================

create table if not exists public.auto_reply_settings (
  id                    int primary key default 1 check (id = 1),
  enabled               boolean not null default false,
  mode                  text not null default 'offline' check (mode in ('offline', 'always')),
  offline_after_minutes int not null default 10 check (offline_after_minutes between 1 and 1440),
  subject               text not null default 'Bien reçu ton message 👋' check (char_length(subject) between 1 and 150),
  message               text not null default 'Bonjour {prenom},

Merci pour ton message ! Je ne suis pas disponible pour le moment, mais je l''ai bien reçu et je te réponds dès que possible, en général sous 24 h.

À très vite,' check (char_length(message) between 1 and 3000),
  last_seen_at          timestamptz,
  updated_at            timestamptz not null default now()
);
insert into public.auto_reply_settings (id) values (1) on conflict do nothing;

alter table public.auto_reply_settings enable row level security;
drop policy if exists "admin read auto reply"   on public.auto_reply_settings;
drop policy if exists "admin update auto reply" on public.auto_reply_settings;
create policy "admin read auto reply"   on public.auto_reply_settings for select to authenticated using (public.is_admin());
create policy "admin update auto reply" on public.auto_reply_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Présence de l'admin (appelée toutes les minutes par l'admin ouvert)
create or replace function public.admin_heartbeat()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Réservé aux administrateurs' using errcode = '42501';
  end if;
  update public.auto_reply_settings set last_seen_at = now() where id = 1;
end;
$$;

-- Faut-il envoyer la réponse automatique maintenant ? (une ligne si oui, aucune sinon)
create or replace function public.auto_reply_due()
returns table (subject text, message text)
language sql
stable
security definer
set search_path = public
as $$
  select s.subject, s.message
  from public.auto_reply_settings s
  where s.id = 1
    and s.enabled
    and (
      s.mode = 'always'
      or s.last_seen_at is null
      or s.last_seen_at < now() - make_interval(mins => s.offline_after_minutes)
    );
$$;

revoke all on function public.admin_heartbeat() from public, anon;
grant execute on function public.admin_heartbeat() to authenticated;
revoke all on function public.auto_reply_due() from public;
grant execute on function public.auto_reply_due() to anon, authenticated;
