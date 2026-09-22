-- ============================================================================
-- Correctif complémentaire : "Database error deleting user" persistait car
-- deux colonnes avaient été oubliées dans le premier correctif :
-- replacement_requests.created_by et email_log.profile_id.
-- À exécuter une seule fois dans Supabase > SQL Editor.
-- ============================================================================

alter table public.replacement_requests alter column created_by drop not null;
alter table public.replacement_requests drop constraint if exists replacement_requests_created_by_fkey;
alter table public.replacement_requests add constraint replacement_requests_created_by_fkey
  foreign key (created_by) references public.profiles(id) on delete set null;

alter table public.email_log drop constraint if exists email_log_profile_id_fkey;
alter table public.email_log add constraint email_log_profile_id_fkey
  foreign key (profile_id) references public.profiles(id) on delete set null;
