import { createAdminClient } from "@/lib/supabase/admin";

// Domaine technique interne : jamais utilisé pour envoyer un vrai e-mail,
// sert uniquement à satisfaire le champ "email" exigé par Supabase Auth.
export const AUTH_EMAIL_DOMAIN = "merm.local";

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // enlève les accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

/**
 * Génère un identifiant de connexion unique de type "prenom.nom", en
 * ajoutant un chiffre en cas d'homonymie (jean.dupont, jean.dupont2, ...).
 * `excludeId` permet de régénérer l'identifiant d'un profil existant sans
 * que sa propre ligne ne soit comptée comme "déjà prise".
 */
export async function generateIdentifiant(firstName: string, lastName: string, excludeId?: string): Promise<string> {
  const base = `${normalize(firstName)}.${normalize(lastName)}`;
  const admin = createAdminClient();

  let candidate = base;
  let suffix = 1;
  // 50 tentatives est très largement suffisant pour une équipe de service.
  for (let i = 0; i < 50; i++) {
    let query = admin.from("profiles").select("id").eq("identifiant", candidate);
    if (excludeId) query = query.neq("id", excludeId);
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    if (!data) return candidate;
    suffix += 1;
    candidate = `${base}${suffix}`;
  }
  throw new Error("Impossible de générer un identifiant unique.");
}

export function authEmailFor(identifiant: string): string {
  return `${identifiant}@${AUTH_EMAIL_DOMAIN}`;
}
