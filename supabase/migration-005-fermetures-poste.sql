-- ============================================================================
-- Ajoute la fermeture temporaire d'un poste (maintenance, panne...).
-- À exécuter une seule fois dans Supabase > SQL Editor.
-- ============================================================================

create table if not exists public.machine_closures (
  id uuid primary key default gen_random_uuid(),
  machine_id uuid not null references public.machines(id) on delete cascade,
  date date not null,
  start_time time,
  end_time time,
  reason text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists machine_closures_date_idx on public.machine_closures(machine_id, date);

alter table public.machine_closures enable row level security;

drop policy if exists machine_closures_select_all on public.machine_closures;
create policy machine_closures_select_all on public.machine_closures for select using (auth.uid() is not null);

drop policy if exists machine_closures_write_admin on public.machine_closures;
create policy machine_closures_write_admin on public.machine_closures for all using (public.is_admin_or_owner()) with check (public.is_admin_or_owner());
