-- Ensayos (Rehearsals) feature — run this in the Supabase SQL Editor.
-- Safe to re-run: every statement is idempotent.

create table if not exists rehearsals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  rehearsal_date date,
  notes text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists recordings (
  id uuid primary key default gen_random_uuid(),
  rehearsal_id uuid not null references rehearsals(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  title text not null default 'Grabación',
  audio_url text not null,
  duration_seconds integer default 0,
  created_at timestamptz default now()
);

alter table rehearsals enable row level security;
alter table recordings enable row level security;

drop policy if exists "rehearsals_all" on rehearsals;
create policy "rehearsals_all" on rehearsals for all using (true) with check (true);

drop policy if exists "recordings_all" on recordings;
create policy "recordings_all" on recordings for all using (true) with check (true);

-- Storage bucket for audio recordings
insert into storage.buckets (id, name, public)
values ('rehearsal-recordings', 'rehearsal-recordings', true)
on conflict (id) do update set public = true;

drop policy if exists "rehearsal_recordings_read" on storage.objects;
create policy "rehearsal_recordings_read" on storage.objects
  for select using (bucket_id = 'rehearsal-recordings');

drop policy if exists "rehearsal_recordings_write" on storage.objects;
create policy "rehearsal_recordings_write" on storage.objects
  for insert with check (bucket_id = 'rehearsal-recordings');

drop policy if exists "rehearsal_recordings_delete" on storage.objects;
create policy "rehearsal_recordings_delete" on storage.objects
  for delete using (bucket_id = 'rehearsal-recordings');
