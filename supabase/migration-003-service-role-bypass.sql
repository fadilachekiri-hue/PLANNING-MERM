-- ============================================================================
-- Correctif : "je n'ai pas la main" pour modifier un membre (prénom, etc.)
-- Le trigger qui protège les profils vérifiait uniquement is_admin_or_owner(),
-- qui se base sur auth.uid() — or les modifications faites par l'application
-- (bouton "Modifier" dans Équipe) passent par le serveur avec la clé
-- service_role, qui n'a pas de auth.uid(). Le trigger les traitait donc comme
-- une tentative non autorisée. On autorise désormais aussi le service_role
-- (déjà filtré par les vérifications d'accès du serveur lui-même).
-- À exécuter une seule fois dans Supabase > SQL Editor.
-- ============================================================================

create or replace function public.protect_profile_columns()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin_or_owner() or auth.role() = 'service_role' then
    return new;
  end if;

  if new.role is distinct from old.role
     or new.status is distinct from old.status
     or new.identifiant is distinct from old.identifiant
     or new.auth_email is distinct from old.auth_email
     or new.contracted_hours is distinct from old.contracted_hours
     or new.contact_email is distinct from old.contact_email
     or new.phone is distinct from old.phone
     or new.job_title is distinct from old.job_title
     or new.usual_days is distinct from old.usual_days
     or new.usual_hours is distinct from old.usual_hours
     or new.notes is distinct from old.notes
     or new.first_name is distinct from old.first_name
     or new.last_name is distinct from old.last_name
  then
    raise exception 'Modification non autorisée : seules vos préférences (matin/soir, heures supplémentaires) peuvent être modifiées par vous-même.';
  end if;

  return new;
end;
$$;
