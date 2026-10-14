-- Compás (utils-band) — esquema para Neon Postgres
-- Los ids de usuario son text porque Neon Auth (Better Auth) usa ids no-uuid.

create extension if not exists pgcrypto;

create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table if not exists profiles (
  id text primary key,
  email text,
  display_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  slug text,
  logo_url text,
  access_code text,
  owner_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists projects_owner_idx on projects(owner_id);
create index if not exists projects_access_code_idx on projects(access_code);

create table if not exists project_members (
  project_id uuid not null references projects(id) on delete cascade,
  user_id text not null,
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (project_id, user_id)
);
create index if not exists project_members_user_idx on project_members(user_id);

create table if not exists songs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  bpm integer not null default 120,
  song_order integer not null default 0,
  lyrics text not null default '',
  notes text not null default '',
  metro_sound text not null default 'classic',
  metro_subdivision integer not null default 1,
  metro_volume real not null default 1.0,
  metro_beats integer not null default 4,
  metro_accent boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists songs_project_idx on songs(project_id);

create table if not exists setlists (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  event_date date,
  venue text,
  notes text,
  setlist_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists setlists_project_idx on setlists(project_id);

create table if not exists setlist_songs (
  id uuid primary key default gen_random_uuid(),
  setlist_id uuid not null references setlists(id) on delete cascade,
  song_id uuid references songs(id) on delete cascade,
  custom_title text,
  song_order integer not null default 0,
  notes text
);
create index if not exists setlist_songs_setlist_idx on setlist_songs(setlist_id);

create table if not exists rehearsals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  rehearsal_date date,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists rehearsals_project_idx on rehearsals(project_id);

create table if not exists recordings (
  id uuid primary key default gen_random_uuid(),
  rehearsal_id uuid not null references rehearsals(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  title text not null default 'Grabación',
  audio_url text not null,
  duration_seconds integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists recordings_project_idx on recordings(project_id);
create index if not exists recordings_rehearsal_idx on recordings(rehearsal_id);

create table if not exists gig_dates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete set null,
  title text not null,
  date date not null,
  end_date date,
  start_time time,
  end_time time,
  status text not null default 'tentative',
  venue text,
  notes text,
  setlist_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists gig_dates_project_idx on gig_dates(project_id);

create table if not exists gig_attendance (
  id uuid primary key default gen_random_uuid(),
  gig_id uuid not null references gig_dates(id) on delete cascade,
  user_id text not null,
  user_email text,
  display_name text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  unique (gig_id, user_id)
);

do $$
declare t text;
begin
  foreach t in array array['profiles','projects','songs','setlists','rehearsals'] loop
    execute format('drop trigger if exists %I_set_updated_at on %I', t, t);
    execute format('create trigger %I_set_updated_at before update on %I for each row execute function set_updated_at()', t, t);
  end loop;
end $$;
