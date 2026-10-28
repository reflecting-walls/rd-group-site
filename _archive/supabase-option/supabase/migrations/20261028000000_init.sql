-- RD Group, Inc. site data: projects, media, reviews, leads, settings.
-- Public (anon) can read published content and insert leads. Admins can do everything.

create extension if not exists pgcrypto;

-- Admins: emails allowed to use /admin
create table if not exists public.admins (
  email text primary key,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- Projects
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  summary text default '',
  description text default '',
  room text default 'kitchen',
  style text default '',
  tags text[] not null default '{}',
  town text default '',
  neighborhood text default '',
  state text default 'IL',
  completed_on date,
  duration_weeks numeric,
  budget_range text default '',
  scope text default '',
  materials text default '',
  cover_media_id uuid,
  featured boolean not null default false,
  published boolean not null default false,
  sample boolean not null default false,
  seo_title text default '',
  seo_description text default '',
  sort int default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Media library (photos can belong to a project or sit in the library)
create table if not exists public.media (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete set null,
  url text not null,
  path text,
  width int,
  height int,
  alt text default '',
  caption text default '',
  kind text not null default 'after' check (kind in ('after', 'before', 'progress')),
  tags text[] not null default '{}',
  town text default '',
  sort int default 0,
  sample boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists media_project_idx on public.media(project_id, sort);

alter table public.projects drop constraint if exists projects_cover_fk;
alter table public.projects add constraint projects_cover_fk foreign key (cover_media_id) references public.media(id) on delete set null;

-- Review platforms (Google, Yelp, Angi, Houzz, ...)
create table if not exists public.review_sources (
  id text primary key,
  name text not null,
  kind text not null default 'manual' check (kind in ('google_places', 'yelp_fusion', 'manual')),
  external_id text default '',
  profile_url text default '',
  rating numeric(2,1),
  review_count int,
  color text default '#A88553',
  enabled boolean not null default true,
  sort int default 0,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  source_id text not null references public.review_sources(id) on delete cascade,
  external_id text,
  author_name text not null,
  author_photo_url text,
  rating int not null check (rating between 1 and 5),
  text text not null default '',
  review_url text default '',
  published_at timestamptz,
  featured boolean not null default false,
  hidden boolean not null default false,
  sample boolean not null default false,
  project_id uuid references public.projects(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_id, external_id)
);

-- Estimate requests from the website form
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 200),
  phone text not null check (char_length(phone) between 3 and 40),
  email text check (email is null or char_length(email) <= 200),
  zip text check (zip is null or char_length(zip) <= 20),
  project text check (project is null or char_length(project) <= 100),
  message text check (message is null or char_length(message) <= 4000),
  page text,
  status text not null default 'new' check (status in ('new', 'contacted', 'quoted', 'won', 'lost')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Key/value settings: 'business' (contact info, hours) and 'card' (digital business card)
create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

do $$ declare t text; begin
  foreach t in array array['projects','media','review_sources','reviews','leads','site_settings'] loop
    execute format('drop trigger if exists touch_%1$s on public.%1$s', t);
    execute format('create trigger touch_%1$s before update on public.%1$s for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- Row level security
alter table public.admins enable row level security;
alter table public.projects enable row level security;
alter table public.media enable row level security;
alter table public.review_sources enable row level security;
alter table public.reviews enable row level security;
alter table public.leads enable row level security;
alter table public.site_settings enable row level security;

create policy "admins read admins" on public.admins for select to authenticated using (public.is_admin());

create policy "public reads published projects" on public.projects for select using (published or public.is_admin());
create policy "admins write projects" on public.projects for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "public reads media" on public.media for select using (true);
create policy "admins write media" on public.media for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "public reads sources" on public.review_sources for select using (enabled or public.is_admin());
create policy "admins write sources" on public.review_sources for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "public reads visible reviews" on public.reviews for select using (not hidden or public.is_admin());
create policy "admins write reviews" on public.reviews for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "anyone submits a lead" on public.leads for insert to anon, authenticated with check (status = 'new');
create policy "admins manage leads" on public.leads for select to authenticated using (public.is_admin());
create policy "admins update leads" on public.leads for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins delete leads" on public.leads for delete to authenticated using (public.is_admin());

create policy "public reads settings" on public.site_settings for select using (true);
create policy "admins write settings" on public.site_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Storage bucket for photos (public read, admin write)
insert into storage.buckets (id, name, public) values ('media', 'media', true) on conflict (id) do nothing;
create policy "public reads media files" on storage.objects for select using (bucket_id = 'media');
create policy "admins upload media files" on storage.objects for insert to authenticated with check (bucket_id = 'media' and public.is_admin());
create policy "admins update media files" on storage.objects for update to authenticated using (bucket_id = 'media' and public.is_admin());
create policy "admins delete media files" on storage.objects for delete to authenticated using (bucket_id = 'media' and public.is_admin());

-- Starting review platforms
insert into public.review_sources (id, name, kind, color, sort) values
  ('google', 'Google', 'google_places', '#4285F4', 1),
  ('yelp', 'Yelp', 'yelp_fusion', '#D32323', 2),
  ('angi', 'Angi', 'manual', '#FF6153', 3),
  ('houzz', 'Houzz', 'manual', '#4DBC15', 4)
on conflict (id) do nothing;
