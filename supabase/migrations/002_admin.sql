-- =====================================================================
--  Migration 002 — Espace administrateur, brouillons, médias, Storage
--  À exécuter APRÈS schema.sql, dans : Supabase Dashboard > SQL Editor
--
--  100 % additive : aucune table supprimée, aucune donnée effacée.
--  Idempotente : peut être relancée sans risque.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Utilitaires
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 1. Administrateurs
--    Être connecté ne suffit PAS : seul un user_id présent dans
--    public.admins a les droits. Aucune policy d'insertion n'existe,
--    un utilisateur ne peut donc pas s'auto-promouvoir.
-- ---------------------------------------------------------------------
create table if not exists public.admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;

drop policy if exists "admins read self" on public.admins;
create policy "admins read self" on public.admins
  for select to authenticated using (user_id = auth.uid());

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Médias (fichiers dans Storage, métadonnées ici)
-- ---------------------------------------------------------------------
create table if not exists public.media (
  id         uuid primary key default gen_random_uuid(),
  path       text not null unique,          -- chemin dans le bucket "portfolio"
  url        text not null,                 -- URL publique
  name       text,                          -- nom d'origine du fichier
  mime_type  text,
  size_bytes int,
  width      int,
  height     int,
  alt        text,
  folder     text not null default 'projects', -- projects | profile | misc
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists media_updated_at on public.media;
create trigger media_updated_at before update on public.media
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 3. Catégories de projets
-- ---------------------------------------------------------------------
create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  slug       text not null unique,
  sort_order int  not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists categories_updated_at on public.categories;
create trigger categories_updated_at before update on public.categories
  for each row execute function public.set_updated_at();

-- Reprend les catégories texte déjà utilisées par les projets existants
insert into public.categories (name, slug)
select distinct p.category,
       trim(both '-' from lower(regexp_replace(p.category, '[^a-zA-Z0-9]+', '-', 'g')))
from public.projects p
where coalesce(p.category, '') <> ''
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 4. Projets : statut, date, catégorie, image principale
--    Les projets existants restent PUBLIÉS (default 'published').
-- ---------------------------------------------------------------------
alter table public.projects add column if not exists status         text not null default 'published';
alter table public.projects add column if not exists project_date   date;
alter table public.projects add column if not exists category_id    uuid references public.categories(id) on delete set null;
alter table public.projects add column if not exists cover_media_id uuid references public.media(id) on delete restrict;
alter table public.projects add column if not exists updated_at     timestamptz not null default now();

do $$ begin
  alter table public.projects add constraint projects_status_check check (status in ('draft', 'published'));
exception when duplicate_object then null; end $$;

update public.projects p set category_id = c.id
from public.categories c
where p.category_id is null and c.name = p.category;

drop trigger if exists projects_updated_at on public.projects;
create trigger projects_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

-- Galerie d'images d'un projet (ordre libre)
create table if not exists public.project_images (
  project_id uuid not null references public.projects(id) on delete cascade,
  media_id   uuid not null references public.media(id) on delete restrict,
  sort_order int  not null default 0,
  primary key (project_id, media_id)
);
create index if not exists project_images_media_idx on public.project_images(media_id);

-- ---------------------------------------------------------------------
-- 5. Profil : photo gérée via la médiathèque + textes jusqu'ici codés en dur
-- ---------------------------------------------------------------------
alter table public.profile add column if not exists avatar_media_id   uuid references public.media(id) on delete restrict;
alter table public.profile add column if not exists years_experience  int;
alter table public.profile add column if not exists availability_note text;

update public.profile
set years_experience  = coalesce(years_experience, 3),
    availability_note = coalesce(availability_note, 'Ouvert aux missions freelance & CDI')
where id = 1;

-- ---------------------------------------------------------------------
-- 6. Compétences & expériences
-- ---------------------------------------------------------------------
alter table public.skills add column if not exists icon       text;  -- slug simpleicons.org (ex: "react")
alter table public.skills add column if not exists updated_at timestamptz not null default now();
drop trigger if exists skills_updated_at on public.skills;
create trigger skills_updated_at before update on public.skills
  for each row execute function public.set_updated_at();

alter table public.experiences add column if not exists start_date date;
alter table public.experiences add column if not exists end_date   date;
alter table public.experiences add column if not exists is_current boolean not null default false;
alter table public.experiences add column if not exists updated_at timestamptz not null default now();
drop trigger if exists experiences_updated_at on public.experiences;
create trigger experiences_updated_at before update on public.experiences
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 7. Services (reprend les 3 engagements affichés jusqu'ici en dur)
-- ---------------------------------------------------------------------
create table if not exists public.services (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
drop trigger if exists services_updated_at on public.services;
create trigger services_updated_at before update on public.services
  for each row execute function public.set_updated_at();

insert into public.services (title, description, sort_order)
select * from (values
  ('Identité visuelle', 'Logos, chartes graphiques et univers de marque cohérents.', 1),
  ('Print & affiches',  'Affiches, flyers, packaging et édition qui attirent l''œil.', 2),
  ('Réseaux sociaux',   'Posts, stories et bannières avec une ligne graphique forte.', 3),
  ('UI / Web design',   'Maquettes de sites et d''applications claires et agréables.', 4)
) v(title, description, sort_order)
where not exists (select 1 from public.services);

-- ---------------------------------------------------------------------
-- 8. Messages : lu / non lu
-- ---------------------------------------------------------------------
alter table public.messages add column if not exists is_read boolean not null default false;
alter table public.messages add column if not exists read_at timestamptz;

-- ---------------------------------------------------------------------
-- 9. Row Level Security
-- ---------------------------------------------------------------------
alter table public.media          enable row level security;
alter table public.categories     enable row level security;
alter table public.project_images enable row level security;
alter table public.services       enable row level security;

-- Projets : le public ne voit que les projets publiés
drop policy if exists "public read projects"          on public.projects;
drop policy if exists "read published projects"       on public.projects;
create policy "read published projects" on public.projects
  for select using (status = 'published' or public.is_admin());

drop policy if exists "public read project_images"    on public.project_images;
create policy "public read project_images" on public.project_images
  for select using (
    public.is_admin() or exists (
      select 1 from public.projects p where p.id = project_id and p.status = 'published'
    )
  );

drop policy if exists "public read media"      on public.media;
drop policy if exists "public read categories" on public.categories;
drop policy if exists "public read services"   on public.services;
create policy "public read media"      on public.media      for select using (true);
create policy "public read categories" on public.categories for select using (true);
create policy "public read services"   on public.services   for select using (true);

-- Écriture réservée aux administrateurs, table par table
do $$
declare t text;
begin
  foreach t in array array['profile','projects','project_images','media','categories','skills','experiences','services']
  loop
    execute format('drop policy if exists "admin insert %1$s" on public.%1$I', t);
    execute format('drop policy if exists "admin update %1$s" on public.%1$I', t);
    execute format('drop policy if exists "admin delete %1$s" on public.%1$I', t);
    execute format('create policy "admin insert %1$s" on public.%1$I for insert to authenticated with check (public.is_admin())', t);
    execute format('create policy "admin update %1$s" on public.%1$I for update to authenticated using (public.is_admin()) with check (public.is_admin())', t);
    execute format('create policy "admin delete %1$s" on public.%1$I for delete to authenticated using (public.is_admin())', t);
  end loop;
end $$;

-- Messages : le public peut en envoyer (non lus), seul l'admin les lit / modifie / supprime
drop policy if exists "public insert messages" on public.messages;
create policy "public insert messages" on public.messages
  for insert to anon, authenticated with check (is_read = false and read_at is null);

drop policy if exists "admin read messages"   on public.messages;
drop policy if exists "admin update messages" on public.messages;
drop policy if exists "admin delete messages" on public.messages;
create policy "admin read messages"   on public.messages for select to authenticated using (public.is_admin());
create policy "admin update messages" on public.messages for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin delete messages" on public.messages for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------
-- 10. Storage : bucket public en lecture, écriture admin uniquement
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('portfolio', 'portfolio', true, 5242880,
        array['image/jpeg','image/png','image/webp','image/avif','image/gif'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "portfolio admin select" on storage.objects;
drop policy if exists "portfolio admin insert" on storage.objects;
drop policy if exists "portfolio admin update" on storage.objects;
drop policy if exists "portfolio admin delete" on storage.objects;
create policy "portfolio admin select" on storage.objects for select to authenticated
  using (bucket_id = 'portfolio' and public.is_admin());
create policy "portfolio admin insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'portfolio' and public.is_admin());
create policy "portfolio admin update" on storage.objects for update to authenticated
  using (bucket_id = 'portfolio' and public.is_admin()) with check (bucket_id = 'portfolio' and public.is_admin());
create policy "portfolio admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'portfolio' and public.is_admin());

-- =====================================================================
--  DERNIÈRE ÉTAPE (une seule fois) — donner les droits admin à ton compte
--  1. Authentication > Users > Add user (email + mot de passe, "Auto confirm")
--  2. Puis exécute (remplace l'email) :
--
--  insert into public.admins (user_id)
--  select id from auth.users where email = 'ton-email@exemple.com'
--  on conflict do nothing;
-- =====================================================================
