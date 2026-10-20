import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

/** Profil complet de la personne connectée, ou null si non connectée. */
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  return (data as Profile) ?? null;
}

export function isAdminOrOwner(profile: Profile | null): boolean {
  return profile?.role === "admin" || profile?.role === "owner";
}

/** À utiliser en tout début de route API : renvoie le profil si
 * admin/propriétaire, sinon null (l'appelant doit alors répondre 403). */
export async function requireAdminOrOwner(): Promise<Profile | null> {
  const profile = await getCurrentProfile();
  return isAdminOrOwner(profile) ? profile : null;
}

/** Seule la propriétaire peut créer/promouvoir une administratrice. */
export async function requireOwner(): Promise<Profile | null> {
  const profile = await getCurrentProfile();
  return profile?.role === "owner" ? profile : null;
}
