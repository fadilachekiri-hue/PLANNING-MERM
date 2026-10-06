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

  const lookup = await lookupAccessToken(token, "invite");
  if (lookup.status === "not_found") {
    return NextResponse.json({ error: "Ce lien d'invitation est introuvable." }, { status: 404 });
  }
  if (lookup.status === "used") {
    return NextResponse.json(
      { error: "Ce lien d'invitation a déjà été utilisé. Demandez un nouveau lien à votre administratrice." },
      { status: 410 }
    );
  }
  if (lookup.status === "expired") {
    return NextResponse.json(
      { error: "Ce lien d'invitation a expiré. Demandez un nouveau lien à votre administratrice." },
      { status: 410 }
    );
  }

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, identifiant, auth_email, status")
    .eq("id", lookup.profileId)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: "Compte introuvable." }, { status: 404 });
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(profile.id, { password });
  if (updateError) {
    return NextResponse.json({ error: "Impossible d'enregistrer le mot de passe : " + updateError.message }, { status: 500 });
  }

  await admin.from("profiles").update({ status: "active" }).eq("id", profile.id);
  await consumeAccessToken(lookup.tokenId);
  await logAction(profile.id, "activation_compte", "profile", profile.id);

  const supabase = createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: profile.auth_email,
    password,
  });

  if (signInError) {
    // Le compte est activé mais la connexion automatique a échoué : la
    // personne peut se connecter normalement avec son identifiant.
    return NextResponse.json({ ok: true, identifiant: profile.identifiant, autoLogin: false });
  }

  return NextResponse.json({ ok: true, identifiant: profile.identifiant, autoLogin: true });
}
