import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authEmailFor } from "@/lib/identifiant";

export async function POST(request: Request) {
  const { identifiant, password } = await request.json();

  if (!identifiant || !password) {
    return NextResponse.json({ error: "Identifiant et mot de passe requis." }, { status: 400 });
  }

  const admin = createAdminClient();
  const normalizedId = String(identifiant).trim().toLowerCase();

  const { data: profile } = await admin
    .from("profiles")
    .select("id, status, auth_email")
    .eq("identifiant", normalizedId)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: "Identifiant ou mot de passe incorrect." }, { status: 401 });
  }
  if (profile.status === "disabled") {
    return NextResponse.json({ error: "Ce compte a été désactivé. Contactez une administratrice." }, { status: 403 });
  }
  if (profile.status === "pending") {
    return NextResponse.json(
      { error: "Ce compte n'est pas encore activé. Utilisez le lien d'invitation reçu par e-mail." },
      { status: 403 }
    );
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: profile.auth_email || authEmailFor(normalizedId),
    password,
  });

  if (error) {
    return NextResponse.json({ error: "Identifiant ou mot de passe incorrect." }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
