-- #####################################################################
--  BRISIGN — CONTENU COMPLET DU PORTFOLIO (sans compte admin)
--
--  Remplit / met à jour : profil, services, catégories, projets,
--  compétences, expériences, réponse automatique, stockage des images.
--  Les tables doivent déjà exister (installation_complete.sql).
--
--  Ré-exécutable : met à jour ce qui existe, ajoute ce qui manque,
--  ne supprime rien. Tout passe ou rien ne passe (transaction).
--
--  Exécution :
--    - Supabase › SQL Editor › New query › coller › Run
--    - ou terminal :  psql "<connection string Supabase>" -f supabase/contenu_complet.sql
-- #####################################################################

begin;

-- ---------------------------------------------------------------------
-- 1. PROFIL
-- ---------------------------------------------------------------------
insert into public.profile (id, full_name, role) values (1, 'Brillant', 'Graphiste Designer')
on conflict (id) do nothing;

update public.profile set
  full_name         = 'Brillant',
  role              = 'Graphiste Designer',
  tagline           = 'Je crée des identités et des visuels qui donnent du caractère aux marques.',
  bio               = 'Graphiste designer basé à Madagascar, je crée des identités visuelles, des supports print, des visuels pour les réseaux sociaux et des maquettes d''interfaces. Passionné par la typographie, la couleur et les identités fortes, j''aime transformer une idée encore floue en un visuel clair, cohérent et mémorable. Chaque projet commence par l''écoute : comprendre votre activité, votre cible et vos envies, pour livrer un résultat qui vous ressemble et qui marque.',
  location          = 'Antananarivo, Madagascar',
  email             = 'brisign14@gmail.com',
  available         = true,
  years_experience  = 3,
  availability_note = 'Ouvert aux missions freelance & collaborations',
  github            = null,
  linkedin          = null,
  twitter           = null,
  resume_url        = null,
  -- Réseaux : remplace les valeurs puis retire les « -- » des lignes voulues.
  -- network possibles : whatsapp, behance, instagram, facebook, tiktok, dribbble, malt, youtube, telegram, website
  socials           = '[]'::jsonb
  --   || '[{"network":"behance","value":"ton-identifiant","label":null}]'::jsonb
  --   || '[{"network":"instagram","value":"@ton-identifiant","label":null}]'::jsonb
  --   || '[{"network":"whatsapp","value":"+261 34 00 000 00","label":null}]'::jsonb
where id = 1;

-- ---------------------------------------------------------------------
-- 2. SERVICES (pastilles du hero + section Services)
-- ---------------------------------------------------------------------
update public.services s set description = v.description, sort_order = v.sort_order
from (values
  ('Identité visuelle', 'Logos, chartes graphiques et univers de marque cohérents, pensés pour durer et se décliner partout.', 1),
  ('Print & affiches',  'Affiches, flyers, packaging et édition : des supports imprimés qui attirent l''œil.', 2),
  ('Réseaux sociaux',   'Posts, stories, bannières et campagnes avec une ligne graphique forte et reconnaissable.', 3),
  ('UI / Web design',   'Maquettes de sites et d''applications claires, agréables et prêtes à être développées.', 4)
) v(title, description, sort_order)
where s.title = v.title;

insert into public.services (title, description, sort_order)
select v.title, v.description, v.sort_order
from (values
  ('Identité visuelle', 'Logos, chartes graphiques et univers de marque cohérents, pensés pour durer et se décliner partout.', 1),
  ('Print & affiches',  'Affiches, flyers, packaging et édition : des supports imprimés qui attirent l''œil.', 2),
  ('Réseaux sociaux',   'Posts, stories, bannières et campagnes avec une ligne graphique forte et reconnaissable.', 3),
  ('UI / Web design',   'Maquettes de sites et d''applications claires, agréables et prêtes à être développées.', 4)
) v(title, description, sort_order)
where not exists (select 1 from public.services s where s.title = v.title);

-- ---------------------------------------------------------------------
-- 3. CATÉGORIES DE PROJETS
-- ---------------------------------------------------------------------
insert into public.categories (name, slug, sort_order) values
  ('Identité visuelle', 'identite-visuelle', 1),
  ('Print & affiches',  'print-affiches',    2),
  ('Réseaux sociaux',   'reseaux-sociaux',   3),
  ('UI / Web design',   'ui-web-design',     4),
  ('Packaging',         'packaging',         5),
  ('Illustration',      'illustration',      6),
  ('Motion design',     'motion-design',     7)
on conflict (name) do update set sort_order = excluded.sort_order;

-- ---------------------------------------------------------------------
-- 4. PROJETS
--    Créés en BROUILLON (status 'draft') : ce sont des exemples sans visuel.
--    Dans l'admin, ajoute les images de chaque projet puis publie-le.
--    (Pour tout publier d'un coup : update public.projects set status = 'published';)
-- ---------------------------------------------------------------------
insert into public.projects (title, slug, category, year, project_date, description, tags, color, featured, sort_order, status)
values
  ('Nova Café',        'nova',   'Identité visuelle', 2026, '2026-03-15',
   'Identité complète d''un coffee shop de quartier : logo, palette, typographies, papeterie, gobelets et enseigne. Une marque chaleureuse et lisible, pensée pour être reconnue d''un coup d''œil.',
   '{Illustrator,Photoshop,InDesign}', '#F4B000', true, 1, 'draft'),
  ('Pulse Festival',   'pulse',  'Print & affiches',  2025, '2025-11-02',
   'Campagne d''affichage d''un festival de musique : affiche principale, déclinaisons par artiste, flyers et billets. Une typographie XXL et un contraste fort pour être vu de loin.',
   '{Illustrator,Photoshop}', '#F4B000', true, 2, 'draft'),
  ('Orbit Sport',      'orbit',  'Réseaux sociaux',   2025, '2025-08-20',
   'Kit de templates Instagram pour une marque de sport : posts, stories, carrousels et miniatures Reels, avec un guide d''utilisation pour l''équipe.',
   '{Photoshop,Canva,After Effects}', '#F4B000', false, 3, 'draft'),
  ('Lumen Store',      'lumen',  'UI / Web design',   2024, '2024-12-10',
   'Maquettes d''une boutique en ligne de cosmétiques : parcours d''achat, fiches produits et version mobile, du wireframe au prototype cliquable.',
   '{Figma}', '#F4B000', false, 4, 'draft'),
  ('Terra Épices',     'terra',  'Packaging',         2025, '2025-05-12',
   'Gamme de boîtes et d''étiquettes pour des épices de Madagascar : un système graphique simple, une couleur par épice et un rendu artisanal.',
   '{Illustrator,Photoshop}', '#F4B000', false, 5, 'draft'),
  ('Brisign Motion',   'motion', 'Motion design',     2026, '2026-01-25',
   'Animation du logo Brisign et habillage pour les vidéos : intro, transitions et titres animés.',
   '{After Effects,Illustrator}', '#F4B000', false, 6, 'draft')
on conflict (slug) do update set
  title        = excluded.title,
  category     = excluded.category,
  year         = excluded.year,
  project_date = excluded.project_date,
  description  = excluded.description,
  tags         = excluded.tags,
  color        = excluded.color,
  featured     = excluded.featured,
  sort_order   = excluded.sort_order;
  -- le statut n'est pas écrasé : un projet que tu as publié reste publié

-- Relie chaque projet à sa catégorie
update public.projects p set category_id = c.id
from public.categories c
where c.name = p.category and p.category_id is distinct from c.id;

-- ---------------------------------------------------------------------
-- 5. COMPÉTENCES (niveau sur 100 : 85+ Expert · 70+ Avancé · 50+ Confirmé)
-- ---------------------------------------------------------------------
update public.skills s set category = v.category, level = v.level, sort_order = v.sort_order
from (values
  ('Photoshop',      'Adobe',        92,  1),
  ('Illustrator',    'Adobe',        90,  2),
  ('InDesign',       'Adobe',        80,  3),
  ('After Effects',  'Adobe',        65,  4),
  ('Premiere Pro',   'Adobe',        60,  5),
  ('Lightroom',      'Adobe',        75,  6),
  ('Figma',          'UI design',    85,  7),
  ('Canva',          'UI design',    88,  8),
  ('Typographie',    'Fondamentaux', 85,  9),
  ('Couleur',        'Fondamentaux', 85, 10),
  ('Mise en page',   'Fondamentaux', 82, 11),
  ('Branding',       'Fondamentaux', 85, 12),
  ('Retouche photo', 'Fondamentaux', 80, 13),
  ('Illustration',   'Fondamentaux', 70, 14)
) v(name, category, level, sort_order)
where lower(s.name) = lower(v.name);

insert into public.skills (name, category, level, sort_order)
select v.name, v.category, v.level, v.sort_order
from (values
  ('Photoshop',      'Adobe',        92,  1),
  ('Illustrator',    'Adobe',        90,  2),
  ('InDesign',       'Adobe',        80,  3),
  ('After Effects',  'Adobe',        65,  4),
  ('Premiere Pro',   'Adobe',        60,  5),
  ('Lightroom',      'Adobe',        75,  6),
  ('Figma',          'UI design',    85,  7),
  ('Canva',          'UI design',    88,  8),
  ('Typographie',    'Fondamentaux', 85,  9),
  ('Couleur',        'Fondamentaux', 85, 10),
  ('Mise en page',   'Fondamentaux', 82, 11),
  ('Branding',       'Fondamentaux', 85, 12),
  ('Retouche photo', 'Fondamentaux', 80, 13),
  ('Illustration',   'Fondamentaux', 70, 14)
) v(name, category, level, sort_order)
where not exists (select 1 from public.skills s where lower(s.name) = lower(v.name));

-- ---------------------------------------------------------------------
-- 6. EXPÉRIENCES & FORMATIONS
-- ---------------------------------------------------------------------
update public.experiences e set period = v.period, description = v.description, stack = v.stack,
       is_current = v.is_current, sort_order = v.sort_order
from (values
  ('Freelance',       'Graphiste Designer',            '2024 — Présent',
   'Identités visuelles, supports print et visuels pour les réseaux sociaux, pour des PME, des associations et des entrepreneurs.',
   '{Illustrator,Photoshop,Figma}'::text[], true, 1),
  ('Studio Créatif',  'Graphiste junior',              '2022 — 2024',
   'Création d''affiches, de packagings et de campagnes pour des marques locales, en lien direct avec les clients.',
   '{Photoshop,InDesign,Illustrator}'::text[], false, 2),
  ('École de design', 'Formation en design graphique', '2019 — 2022',
   'Typographie, identité visuelle, mise en page, communication visuelle et culture graphique.',
   '{Illustrator,InDesign}'::text[], false, 3)
) v(company, role, period, description, stack, is_current, sort_order)
where e.company = v.company and e.role = v.role;

insert into public.experiences (company, role, period, description, stack, is_current, sort_order)
select v.company, v.role, v.period, v.description, v.stack, v.is_current, v.sort_order
from (values
  ('Freelance',       'Graphiste Designer',            '2024 — Présent',
   'Identités visuelles, supports print et visuels pour les réseaux sociaux, pour des PME, des associations et des entrepreneurs.',
   '{Illustrator,Photoshop,Figma}'::text[], true, 1),
  ('Studio Créatif',  'Graphiste junior',              '2022 — 2024',
   'Création d''affiches, de packagings et de campagnes pour des marques locales, en lien direct avec les clients.',
   '{Photoshop,InDesign,Illustrator}'::text[], false, 2),
  ('École de design', 'Formation en design graphique', '2019 — 2022',
   'Typographie, identité visuelle, mise en page, communication visuelle et culture graphique.',
   '{Illustrator,InDesign}'::text[], false, 3)
) v(company, role, period, description, stack, is_current, sort_order)
where not exists (select 1 from public.experiences e where e.company = v.company and e.role = v.role);

-- ---------------------------------------------------------------------
-- 7. RÉPONSE AUTOMATIQUE (formulaire de contact)
--    Désactivée par défaut : elle a besoin de GMAIL_USER / GMAIL_APP_PASSWORD
--    sur le serveur. Active-la ensuite dans l'admin.
-- ---------------------------------------------------------------------
insert into public.auto_reply_settings (id) values (1) on conflict do nothing;

update public.auto_reply_settings set
  enabled               = false,
  mode                  = 'offline',
  offline_after_minutes = 10,
  subject               = 'Bien reçu ton message — Brisign',
  message               = 'Bonjour {prenom},

Merci pour ton message et pour l''intérêt que tu portes à mon travail ! Je l''ai bien reçu et je te réponds personnellement dès que possible, en général sous 24 h.

En attendant, n''hésite pas à préparer quelques infos sur ton projet : ton activité, le support souhaité (logo, affiche, visuels réseaux sociaux…) et tes délais.

À très vite,
Brillant — Brisign'
where id = 1;

-- ---------------------------------------------------------------------
-- 8. STOCKAGE DES IMAGES (bucket « portfolio » : public, 5 Mo max)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('portfolio', 'portfolio', true, 5242880,
        array['image/jpeg','image/png','image/webp','image/avif','image/gif'])
on conflict (id) do update set
  public             = true,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

commit;

-- ---------------------------------------------------------------------
-- Vérification : nombre de lignes par table
-- ---------------------------------------------------------------------
select 'profil' as table_, count(*) from public.profile
union all select 'services',     count(*) from public.services
union all select 'categories',   count(*) from public.categories
union all select 'projets',      count(*) from public.projects
union all select 'competences',  count(*) from public.skills
union all select 'experiences',  count(*) from public.experiences;
