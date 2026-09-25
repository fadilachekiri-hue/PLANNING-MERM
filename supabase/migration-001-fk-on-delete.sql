-- ============================================================================
-- Correctif : "Database error deleting user"
-- Plusieurs colonnes qui enregistrent "qui a fait quoi" (created_by,
-- updated_by, published_by, decided_by, filled_by, actor_id) empêchaient de
-- supprimer un profil dès lors qu'il apparaissait dans l'historique — même
-- un profil jamais activé. On les fait pointer vers NULL au lieu de bloquer
-- la suppression : l'historique reste (l'action a bien eu lieu), seul
-- l'auteur devient "inconnu" si son compte est supprimé.
-- À exécuter une seule fois dans Supabase > SQL Editor.
-- ============================================================================

alter table public.shifts drop constraint if exists shifts_created_by_fkey;
alter table public.shifts add constraint shifts_created_by_fkey
  foreign key (created_by) references public.profiles(id) on delete set null;

alter table public.shifts drop constraint if exists shifts_updated_by_fkey;
alter table public.shifts add constraint shifts_updated_by_fkey
  foreign key (updated_by) references public.profiles(id) on delete set null;

alter table public.weeks drop constraint if exists weeks_published_by_fkey;
alter table public.weeks add constraint weeks_published_by_fkey
  foreign key (published_by) references public.profiles(id) on delete set null;

alter table public.leave_requests drop constraint if exists leave_requests_decided_by_fkey;
alter table public.leave_requests add constraint leave_requests_decided_by_fkey
  foreign key (decided_by) references public.profiles(id) on delete set null;

alter table public.replacement_requests drop constraint if exists replacement_requests_filled_by_fkey;
alter table public.replacement_requests add constraint replacement_requests_filled_by_fkey
  foreign key (filled_by) references public.profiles(id) on delete set null;

alter table public.access_tokens drop constraint if exists access_tokens_created_by_fkey;
alter table public.access_tokens add constraint access_tokens_created_by_fkey
  foreign key (created_by) references public.profiles(id) on delete set null;

alter table public.audit_log drop constraint if exists audit_log_actor_id_fkey;
alter table public.audit_log add constraint audit_log_actor_id_fkey
  foreign key (actor_id) references public.profiles(id) on delete set null;
