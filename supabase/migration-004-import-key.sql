-- ============================================================================
-- Correctif : l'import de planning créait un doublon (prénom "MERM") quand
-- on relançait l'import après avoir déjà corrigé le NOM de famille d'un
-- profil, car l'import retrouvait les profils par nom de famille — qui
-- avait changé. Ajoute une clé stable (le nom tel qu'il apparaît dans le
-- fichier Excel d'origine) qui ne bouge jamais, même si vous corrigez
-- ensuite le prénom ou le nom dans Équipe.
-- À exécuter une seule fois dans Supabase > SQL Editor.
-- ============================================================================

alter table public.profiles add column if not exists import_key text;
