-- Ajoute le type de créneau "FO" (formation, compté comme une absence de
-- terrain). À exécuter une fois dans Supabase SQL Editor.

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
  check (shift_type in ('work', 'conge', 'rtt', 'repos', 'absence', 'tp', 'rr', 'fo'));
