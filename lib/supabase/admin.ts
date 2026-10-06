import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Client "administrateur" : utilise la clé service_role, qui contourne les
// politiques de sécurité (RLS). Ne doit JAMAIS être importé dans un fichier
// exécuté côté navigateur — le mot-clé "server-only" fait planter le build
// si c'était le cas par erreur.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
