import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createAccessToken, resetUrl } from "@/lib/tokens";
import { logAction } from "@/lib/audit";

// Outil de secours protégé par SETUP_SECRET : génère un lien de
// réinitialisation de mot de passe par identifiant, sans avoir besoin
// d'être déjà connectée. Sert quand la propriétaire ou une administratrice
// oublie son mot de passe et ne peut donc pas passer par Équipe.
export async function POST(request: Request) {
  const setupSecret = process.env.SETUP_SECRET;
  if (!setupSecret) {
    return NextResponse.json({ error: "Configuration manquante : SETUP_SECRET n'est pas définie sur le serveur." }, { status: 500 });
  }

  const { secret, identifiant } = await request.json();
  if (secret !== setupSecret) {
    return NextResponse.json({ error: "Code d'installation incorrect." }, { status: 403 });
  }
  if (!identifiant) {
    return NextResponse.json({ error: "Identifiant requis." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, status")
    .eq("identifiant", String(identifiant).trim())
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: "Aucun compte avec cet identifiant." }, { status: 404 });
  }
  if (profile.status !== "active") {
    return NextResponse.json({ error: "Ce compte n'est pas encore activé, utilisez plutôt un lien d'invitation." }, { status: 400 });
  }

  const token = await createAccessToken(profile.id, "reset", null);
  await logAction(null, "generation_lien_reinitialisation_secours", "profile", profile.id);

  return NextResponse.json({ ok: true, link: resetUrl(token) });
}
