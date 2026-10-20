-- Ajoute le poste "GQ" (travail qualité, uniquement Gloria Fonteneau) et les
-- types de créneau "TP" (temps partiel) et "RR" (repos récupérateur).
-- À exécuter une fois dans Supabase SQL Editor.

insert into public.machines (name, color_hex, position, active)
select 'GQ', '#7c3aed', (select coalesce(max(position), 0) + 1 from public.machines), true
where not exists (select 1 from public.machines where name = 'GQ');

-- Gloria Fonteneau est la seule habilitée sur GQ.
insert into public.competencies (profile_id, machine_id, level)
select p.id, m.id, 'autonomous'
from public.profiles p, public.machines m
where m.name = 'GQ' and p.last_name ilike 'Fonteneau'
on conflict (profile_id, machine_id) do update set level = 'autonomous';

-- La contrainte sur shift_type n'a pas de nom fixe (déclarée inline dans le
-- create table d'origine) : on la retrouve dynamiquement plutôt que de
-- deviner son nom généré par Postgres.
do $$
declare
  con_name text;
begin
  select conname into con_name
  from pg_constraint
  where conrelid = 'public.shifts'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%shift_type%';
  if con_name is not null then
    execute format('alter table public.shifts drop constraint %I', con_name);
  end if;
end $$;

alter table public.shifts add constraint shifts_shift_type_check
  check (shift_type in ('work', 'conge', 'rtt', 'repos', 'absence', 'tp', 'rr'));
