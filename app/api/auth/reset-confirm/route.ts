import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { lookupAccessToken, consumeAccessToken } from "@/lib/tokens";
import { logAction } from "@/lib/audit";

export async function POST(request: Request) {
  const { token, password } = await request.json();

  if (!token || !password || String(password).length < 8) {
    return NextResponse.json(
      { error: "Un mot de passe d'au moins 8 caractères est requis." },
      { status: 400 }
    );
  }

  const lookup = await lookupAccessToken(token, "reset");
  if (lookup.status === "not_found") {
    return NextResponse.json({ error: "Ce lien est introuvable." }, { status: 404 });
  }
  if (lookup.status === "used") {
    return NextResponse.json({ error: "Ce lien a déjà été utilisé. Refaites une demande." }, { status: 410 });
  }
  if (lookup.status === "expired") {
    return NextResponse.json({ error: "Ce lien a expiré. Refaites une demande." }, { status: 410 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, identifiant, auth_email")
    .eq("id", lookup.profileId)
    .single();

  if (!profile) return NextResponse.json({ error: "Compte introuvable." }, { status: 404 });

  const { error: updateError } = await admin.auth.admin.updateUserById(profile.id, { password });
  if (updateError) {
    return NextResponse.json({ error: "Erreur : " + updateError.message }, { status: 500 });
  }

  await consumeAccessToken(lookup.tokenId);
  await logAction(profile.id, "reinitialisation_mot_de_passe", "profile", profile.id);

  const supabase = createClient();
  await supabase.auth.signInWithPassword({ email: profile.auth_email, password });

  return NextResponse.json({ ok: true, identifiant: profile.identifiant });
}
