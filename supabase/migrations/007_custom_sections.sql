-- =====================================================================
-- 007 — Sections personnalisées (retours clients, offres, partenaires…)
--
-- Une section = un titre, une mise en page et une liste d'éléments.
-- Mises en page : cards (cartes), testimonials (retours clients),
--                 offers (offres / recrutement), text (texte & images).
-- Les sections visibles s'affichent sur l'accueil, juste avant le contact.
--
-- À exécuter dans Supabase › SQL Editor (après 002_admin.sql). Ré-exécutable.
-- =====================================================================

create table if not exists public.custom_sections (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(title) between 1 and 120),
  slug        text not null unique,
  eyebrow     text check (char_length(eyebrow) <= 60),
  intro       text check (char_length(intro) <= 600),
  layout      text not null default 'cards' check (layout in ('cards', 'testimonials', 'offers', 'text')),
  visible     boolean not null default true,
  in_nav      boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.custom_section_items (
  id          uuid primary key default gen_random_uuid(),
  section_id  uuid not null references public.custom_sections(id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 160),
  subtitle    text check (char_length(subtitle) <= 160),
  body        text check (char_length(body) <= 3000),
  image_url   text,
  link_url    text,
  link_label  text check (char_length(link_label) <= 40),
  rating      int check (rating between 1 and 5),
  tags        text[] not null default '{}',
  visible     boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists custom_section_items_section_idx on public.custom_section_items (section_id, sort_order);

drop trigger if exists custom_sections_updated_at on public.custom_sections;
create trigger custom_sections_updated_at before update on public.custom_sections
  for each row execute function public.set_updated_at();
drop trigger if exists custom_section_items_updated_at on public.custom_section_items;
create trigger custom_section_items_updated_at before update on public.custom_section_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Row Level Security : le public lit ce qui est visible, l'admin gère tout
-- ---------------------------------------------------------------------
alter table public.custom_sections      enable row level security;
alter table public.custom_section_items enable row level security;

drop policy if exists "read custom sections" on public.custom_sections;
create policy "read custom sections" on public.custom_sections
  for select using (visible or public.is_admin());

drop policy if exists "read custom section items" on public.custom_section_items;
create policy "read custom section items" on public.custom_section_items
  for select using (
    public.is_admin() or (
      visible and exists (select 1 from public.custom_sections s where s.id = section_id and s.visible)
    )
  );

do $$
declare t text;
begin
  foreach t in array array['custom_sections', 'custom_section_items']
  loop
    execute format('drop policy if exists "admin insert %1$s" on public.%1$I', t);
    execute format('drop policy if exists "admin update %1$s" on public.%1$I', t);
    execute format('drop policy if exists "admin delete %1$s" on public.%1$I', t);
    execute format('create policy "admin insert %1$s" on public.%1$I for insert to authenticated with check (public.is_admin())', t);
    execute format('create policy "admin update %1$s" on public.%1$I for update to authenticated using (public.is_admin()) with check (public.is_admin())', t);
    execute format('create policy "admin delete %1$s" on public.%1$I for delete to authenticated using (public.is_admin())', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Exemple : une section « Retours clients » (ajoutée une seule fois, modifiable / supprimable dans l'admin)
-- ---------------------------------------------------------------------
insert into public.custom_sections (title, slug, eyebrow, intro, layout, visible, in_nav, sort_order)
select 'Ils m’ont fait confiance', 'retours-clients', 'Retours clients',
       'Ce que disent les marques et entrepreneurs avec qui j’ai travaillé.', 'testimonials', false, true, 1
where not exists (select 1 from public.custom_sections);
