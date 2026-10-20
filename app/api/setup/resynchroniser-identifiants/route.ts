import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateIdentifiant, authEmailFor } from "@/lib/identifiant";
import { logAction } from "@/lib/audit";

// Outil de secours protégé par SETUP_SECRET : régénère l'identifiant de
// connexion (et l'e-mail technique lié) de tous les profils dont
// l'identifiant ne correspond plus au prénom/nom actuel — utile quand un nom
// a été corrigé directement en base (SQL) plutôt que via le bouton
// "Modifier", qui est le seul chemin qui régénère automatiquement.
export async function POST(request: Request) {
  const setupSecret = process.env.SETUP_SECRET;
  if (!setupSecret) {
    return NextResponse.json({ error: "Configuration manquante : SETUP_SECRET n'est pas définie sur le serveur." }, { status: 500 });
  }

  const { secret } = await request.json();
  if (secret !== setupSecret) {
    return NextResponse.json({ error: "Code d'installation incorrect." }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: profiles, error } = await admin.from("profiles").select("id, first_name, last_name, identifiant");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const report = { resynchronises: [] as string[], inchanges: 0, errors: [] as string[] };

  for (const profile of profiles || []) {
    try {
      const expected = await generateIdentifiant(profile.first_name, profile.last_name, profile.id);
      if (profile.identifiant === expected) {
        report.inchanges++;
        continue;
      }

      const newAuthEmail = authEmailFor(expected);
      const { error: authError } = await admin.auth.admin.updateUserById(profile.id, { email: newAuthEmail, email_confirm: true });
      if (authError) {
        report.errors.push(`${profile.first_name} ${profile.last_name} : ${authError.message}`);
        continue;
      }

      const { error: updateError } = await admin
        .from("profiles")
        .update({ identifiant: expected, auth_email: newAuthEmail })
        .eq("id", profile.id);
      if (updateError) {
        report.errors.push(`${profile.first_name} ${profile.last_name} : ${updateError.message}`);
        continue;
      }

      report.resynchronises.push(`${profile.first_name} ${profile.last_name} : ${profile.identifiant} → ${expected}`);
    } catch (e: any) {
      report.errors.push(`${profile.first_name} ${profile.last_name} : ${e.message}`);
    }
  }

  await logAction(null, "resynchronisation_identifiants", "profile", null, { count: report.resynchronises.length });

  return NextResponse.json({ ok: true, report });
}
