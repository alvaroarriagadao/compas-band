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

-- ===================== Finanzas =====================
-- Integrantes "financieros" de la banda (pueden o no tener cuenta en la app)
create table if not exists finance_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  user_id text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists finance_members_project_idx on finance_members(project_id);

-- Sistema 1: gastos compartidos (alguien paga, el resto le devuelve en cuotas)
create table if not exists shared_expenses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  paid_by uuid not null references finance_members(id) on delete restrict,
  description text not null,
  amount integer not null check (amount > 0),
  expense_date date not null default current_date,
  installments integer not null default 1 check (installments between 1 and 36),
  notes text,
  created_by text,
  created_by_name text,
  created_at timestamptz not null default now()
);
create index if not exists shared_expenses_project_idx on shared_expenses(project_id);

-- Una fila por integrante (distinto del pagador) y cuota: cuánto debe y si ya pagó
create table if not exists shared_expense_shares (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references shared_expenses(id) on delete cascade,
  member_id uuid not null references finance_members(id) on delete cascade,
  installment_no integer not null,
  due_date date not null,
  amount integer not null,
  paid_at timestamptz,
  paid_marked_by text,
  unique (expense_id, member_id, installment_no)
);
create index if not exists shared_expense_shares_member_idx on shared_expense_shares(member_id);

-- Sistema 2: caja (cuotas mensuales + gastos de la caja)
create table if not exists treasury_settings (
  project_id uuid primary key references projects(id) on delete cascade,
  monthly_fee integer not null default 5000,
  start_month date not null default date_trunc('month', current_date)::date,
  opening_balance integer not null default 0,
  opening_note text,
  updated_at timestamptz not null default now()
);

-- Un check = una cuota pagada por un integrante en un mes
create table if not exists treasury_fee_checks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  member_id uuid not null references finance_members(id) on delete cascade,
  month date not null,
  amount integer not null,
  checked_by text,
  checked_by_name text,
  checked_at timestamptz not null default now(),
  unique (member_id, month)
);
create index if not exists treasury_fee_checks_project_idx on treasury_fee_checks(project_id);

create table if not exists treasury_expenses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  expense_date date not null default current_date,
  description text not null,
  amount integer not null check (amount > 0),
  paid_to text,
  created_by text,
  created_by_name text,
  created_at timestamptz not null default now()
);
create index if not exists treasury_expenses_project_idx on treasury_expenses(project_id);

-- Historial de cambios de ambos módulos
create table if not exists finance_log (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  module text not null,
  action text not null,
  detail text not null,
  user_id text,
  user_name text,
  created_at timestamptz not null default now()
);
create index if not exists finance_log_project_idx on finance_log(project_id, created_at desc);

-- v2 caja: pagos históricos (ya incluidos en el saldo inicial) y pagos parciales/múltiples por mes
alter table treasury_fee_checks add column if not exists historical boolean not null default false;
alter table treasury_fee_checks drop constraint if exists treasury_fee_checks_member_id_month_key;
create index if not exists treasury_fee_checks_member_month_idx on treasury_fee_checks(member_id, month);

-- v3 gastos: el pagador puede no compartir el gasto (le devuelven el total)
alter table shared_expenses add column if not exists payer_shares boolean not null default true;
