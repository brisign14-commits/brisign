-- =========================================================
--  Portfolio — schéma Supabase
--  À exécuter dans : Supabase Dashboard > SQL Editor > New query
-- =========================================================

-- ---------- PROFIL (une seule ligne) ----------
create table if not exists public.profile (
  id          int primary key default 1 check (id = 1),
  full_name   text not null,
  role        text not null,
  tagline     text,
  bio         text,
  location    text,
  email       text,
  available   boolean default true,
  avatar_url  text,
  resume_url  text,
  github      text,
  linkedin    text,
  twitter     text,
  updated_at  timestamptz default now()
);

-- ---------- PROJETS ----------
create table if not exists public.projects (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  slug         text unique,
  category     text,                   -- ex: "Web App", "Mobile", "API"
  year         int,
  description  text,
  tags         text[] default '{}',
  image_url    text,
  live_url     text,
  repo_url     text,
  color        text default '#c8ff3d', -- couleur d'accent de la carte
  featured     boolean default false,
  sort_order   int default 0,
  created_at   timestamptz default now()
);

-- ---------- COMPÉTENCES ----------
create table if not exists public.skills (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  category    text not null,           -- "Frontend", "Backend", "DevOps", "Outils"
  level       int check (level between 0 and 100) default 80,
  sort_order  int default 0
);

-- ---------- EXPÉRIENCES ----------
create table if not exists public.experiences (
  id          uuid primary key default gen_random_uuid(),
  company     text not null,
  role        text not null,
  period      text not null,           -- ex: "2023 — Présent"
  description text,
  stack       text[] default '{}',
  sort_order  int default 0
);

-- ---------- MESSAGES (formulaire de contact) ----------
create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 120),
  email       text not null check (char_length(email) between 3 and 200),
  subject     text check (char_length(subject) <= 200),
  message     text not null check (char_length(message) between 1 and 5000),
  created_at  timestamptz default now()
);

-- =========================================================
--  Row Level Security
--  - lecture publique du contenu du portfolio
--  - le public peut seulement INSÉRER un message (pas les lire)
--  - l'édition du contenu se fait depuis le Table Editor Supabase
-- =========================================================
alter table public.profile     enable row level security;
alter table public.projects    enable row level security;
alter table public.skills      enable row level security;
alter table public.experiences enable row level security;
alter table public.messages    enable row level security;

drop policy if exists "public read profile"     on public.profile;
drop policy if exists "public read projects"    on public.projects;
drop policy if exists "public read skills"      on public.skills;
drop policy if exists "public read experiences" on public.experiences;
drop policy if exists "public insert messages"  on public.messages;

create policy "public read profile"     on public.profile     for select using (true);
create policy "public read projects"    on public.projects    for select using (true);
create policy "public read skills"      on public.skills      for select using (true);
create policy "public read experiences" on public.experiences for select using (true);
create policy "public insert messages"  on public.messages    for insert to anon, authenticated with check (true);

-- =========================================================
--  Données d'exemple (modifie-les à ton image)
-- =========================================================
insert into public.profile (id, full_name, role, tagline, bio, location, email, available, github, linkedin)
values (1, 'Brillant', 'Graphiste Designer',
  'Je crée des identités et des visuels qui donnent du caractère aux marques.',
  'Graphiste designer passionné par la typographie, la couleur et les identités fortes. J''aime transformer des idées floues en visuels concrets, du logo jusqu''aux supports print, réseaux sociaux et interfaces.',
  'Madagascar, Madagascar', 'hello@brillant.design', true,
  null, 'https://linkedin.com/')
on conflict (id) do nothing;

insert into public.projects (title, slug, category, year, description, tags, color, featured, sort_order) values
 ('Nova Café',      'nova',  'Identité visuelle', 2026, 'Logo, charte graphique et papeterie pour un coffee shop de quartier.',          '{Illustrator,Photoshop,InDesign}', '#F4B000', true,  1),
 ('Pulse Festival', 'pulse', 'Print & affiches',  2025, 'Affiches, flyers et billetterie pour un festival de musique.',                  '{Illustrator,Photoshop}',          '#F4B000', true,  2),
 ('Orbit Sport',    'orbit', 'Réseaux sociaux',   2025, 'Templates de posts et stories Instagram pour une marque de sport.',             '{Photoshop,Canva,After Effects}',  '#F4B000', false, 3),
 ('Lumen Store',    'lumen', 'UI / Web design',   2024, 'Maquettes d''une boutique en ligne de cosmétiques, du wireframe au prototype.', '{Figma}',                          '#F4B000', false, 4)
on conflict (slug) do nothing;

insert into public.skills (name, category, level, sort_order)
select * from (values
 ('Photoshop', 'Adobe', 92, 1), ('Illustrator', 'Adobe', 90, 2), ('InDesign', 'Adobe', 80, 3), ('After Effects', 'Adobe', 65, 4),
 ('Figma', 'UI design', 85, 5), ('Canva', 'UI design', 88, 6),
 ('Typographie', 'Fondamentaux', 85, 7), ('Couleur', 'Fondamentaux', 85, 8), ('Mise en page', 'Fondamentaux', 82, 9)
) v(name, category, level, sort_order)
where not exists (select 1 from public.skills);

insert into public.experiences (company, role, period, description, stack, sort_order)
select * from (values
 ('Freelance',       'Graphiste Designer',             '2024 — Présent', 'Identités visuelles, supports print et visuels réseaux sociaux pour PME et entrepreneurs.', '{Illustrator,Photoshop,Figma}'::text[], 1),
 ('Studio Créatif',  'Graphiste junior',               '2022 — 2024',    'Création d''affiches, de packagings et de campagnes pour des marques locales.',          '{Photoshop,InDesign}',          2),
 ('École de design', 'Formation en design graphique',  '2019 — 2022',    'Typographie, identité visuelle, mise en page et communication visuelle.',                '{Illustrator,InDesign}',        3)
) v(company, role, period, description, stack, sort_order)
where not exists (select 1 from public.experiences);
