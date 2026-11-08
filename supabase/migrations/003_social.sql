-- =====================================================================
-- 003 — Réactions et commentaires des visiteurs sur les projets
--
-- Règle : 1 réaction + 1 commentaire par appareil et par projet.
--   * Le navigateur génère un identifiant aléatoire (UUID) et le garde.
--   * La base ne stocke qu'une EMPREINTE (sha256) de cet identifiant :
--     personne ne peut lire ni réutiliser l'identifiant d'un autre appareil.
--   * Les visiteurs n'ont AUCUN accès direct aux tables : tout passe par
--     les fonctions ci-dessous, qui valident les données.
--   * Les commentaires s'affichent immédiatement ; l'admin peut les masquer
--     ou les supprimer (page Admin › Commentaires).
--
-- À exécuter dans Supabase › SQL Editor (après 002_admin.sql). Ré-exécutable.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------
create table if not exists public.project_reactions (
  project_id  uuid not null references public.projects(id) on delete cascade,
  device_hash text not null,
  reaction    text not null check (reaction in ('love', 'fire', 'clap', 'wow', 'idea')),
  created_at  timestamptz not null default now(),
  primary key (project_id, device_hash)
);

create table if not exists public.project_comments (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  device_hash text not null,
  author      text not null check (char_length(author) between 1 and 60),
  body        text not null check (char_length(body) between 2 and 600),
  hidden      boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (project_id, device_hash)
);

create index if not exists project_comments_project_idx on public.project_comments (project_id, created_at desc);
create index if not exists project_comments_created_idx on public.project_comments (created_at desc);

alter table public.project_reactions enable row level security;
alter table public.project_comments  enable row level security;

-- Seul l'admin accède directement aux tables (lecture, masquage, suppression)
drop policy if exists "admins manage reactions" on public.project_reactions;
create policy "admins manage reactions" on public.project_reactions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins manage comments" on public.project_comments;
create policy "admins manage comments" on public.project_comments
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- Outils internes
-- ---------------------------------------------------------------------
create or replace function public._device_hash(p_device text)
returns text
language plpgsql immutable
set search_path = public
as $$
begin
  if p_device is null or p_device !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return null;
  end if;
  return encode(sha256(convert_to('portfolio-device:' || p_device, 'UTF8')), 'hex');
end;
$$;
revoke all on function public._device_hash(text) from public, anon, authenticated;

create or replace function public._published_project(p_project uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.projects where id = p_project and status = 'published');
$$;
revoke all on function public._published_project(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Lecture : compteurs, ma réaction, commentaires visibles
-- ---------------------------------------------------------------------
create or replace function public.project_social(p_project uuid, p_device text default null)
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare
  h text := public._device_hash(p_device);
begin
  if not public._published_project(p_project) then
    return null;
  end if;

  return jsonb_build_object(
    'reactions', coalesce((
      select jsonb_object_agg(reaction, n)
      from (select reaction, count(*) as n from public.project_reactions where project_id = p_project group by reaction) s
    ), '{}'::jsonb),
    'mine', (select reaction from public.project_reactions where project_id = p_project and device_hash = h),
    'comments', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', c.id, 'author', c.author, 'body', c.body, 'created_at', c.created_at,
               'mine', h is not null and c.device_hash = h, 'hidden', c.hidden)
             order by c.created_at desc)
      from public.project_comments c
      where c.project_id = p_project and (not c.hidden or c.device_hash = h)   -- un commentaire masqué reste visible pour son auteur
    ), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------
-- Réagir : 1 réaction par appareil (la même → retirée, une autre → remplacée)
-- ---------------------------------------------------------------------
create or replace function public.react_to_project(p_project uuid, p_device text, p_reaction text)
returns jsonb
language plpgsql volatile security definer
set search_path = public
as $$
declare
  h text := public._device_hash(p_device);
begin
  if h is null then raise exception 'Appareil non reconnu.' using errcode = '22023'; end if;
  if not public._published_project(p_project) then raise exception 'Projet introuvable.' using errcode = '22023'; end if;

  if p_reaction is null then
    delete from public.project_reactions where project_id = p_project and device_hash = h;
  elsif p_reaction not in ('love', 'fire', 'clap', 'wow', 'idea') then
    raise exception 'Réaction inconnue.' using errcode = '22023';
  else
    insert into public.project_reactions (project_id, device_hash, reaction)
    values (p_project, h, p_reaction)
    on conflict (project_id, device_hash) do update set reaction = excluded.reaction, created_at = now();
  end if;

  return public.project_social(p_project, p_device);
end;
$$;

-- ---------------------------------------------------------------------
-- Commenter : 1 commentaire par appareil, pas de lien, longueurs bornées
-- ---------------------------------------------------------------------
create or replace function public.comment_on_project(p_project uuid, p_device text, p_author text, p_body text)
returns jsonb
language plpgsql volatile security definer
set search_path = public
as $$
declare
  h text := public._device_hash(p_device);
  a text := btrim(regexp_replace(coalesce(p_author, ''), '\s+', ' ', 'g'));
  b text := btrim(regexp_replace(coalesce(p_body, ''), '[ \t]+', ' ', 'g'));
begin
  if h is null then raise exception 'Appareil non reconnu.' using errcode = '22023'; end if;
  if not public._published_project(p_project) then raise exception 'Projet introuvable.' using errcode = '22023'; end if;
  if char_length(a) < 1 or char_length(a) > 60 then raise exception 'Ton nom doit faire entre 1 et 60 caractères.' using errcode = '22023'; end if;
  if char_length(b) < 2 or char_length(b) > 600 then raise exception 'Ton commentaire doit faire entre 2 et 600 caractères.' using errcode = '22023'; end if;
  if b ~* '(https?://|www\.|\.(com|net|org|ru|xyz|io)\b/)' or a ~* '(https?://|www\.)' then
    raise exception 'Les liens ne sont pas autorisés dans les commentaires.' using errcode = '22023';
  end if;
  if exists (select 1 from public.project_comments where project_id = p_project and device_hash = h) then
    raise exception 'Tu as déjà commenté ce projet depuis cet appareil.' using errcode = '23505';
  end if;

  insert into public.project_comments (project_id, device_hash, author, body) values (p_project, h, a, b);
  return public.project_social(p_project, p_device);
end;
$$;

-- ---------------------------------------------------------------------
-- Supprimer SON commentaire (libère la place pour en écrire un autre)
-- ---------------------------------------------------------------------
create or replace function public.delete_my_project_comment(p_project uuid, p_device text)
returns jsonb
language plpgsql volatile security definer
set search_path = public
as $$
declare
  h text := public._device_hash(p_device);
begin
  if h is null then raise exception 'Appareil non reconnu.' using errcode = '22023'; end if;
  delete from public.project_comments where project_id = p_project and device_hash = h;
  return public.project_social(p_project, p_device);
end;
$$;

revoke all on function public.project_social(uuid, text)                       from public;
revoke all on function public.react_to_project(uuid, text, text)               from public;
revoke all on function public.comment_on_project(uuid, text, text, text)       from public;
revoke all on function public.delete_my_project_comment(uuid, text)            from public;
grant execute on function public.project_social(uuid, text)                    to anon, authenticated;
grant execute on function public.react_to_project(uuid, text, text)            to anon, authenticated;
grant execute on function public.comment_on_project(uuid, text, text, text)    to anon, authenticated;
grant execute on function public.delete_my_project_comment(uuid, text)         to anon, authenticated;
