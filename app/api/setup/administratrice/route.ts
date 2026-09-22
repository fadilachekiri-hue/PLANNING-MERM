import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { generateIdentifiant, authEmailFor } from "@/lib/identifiant";
import { logAction } from "@/lib/audit";

// Crée directement un compte administratrice active, protégé par le même
// code d'installation (SETUP_SECRET) que la première configuration.
// Sert de secours pour obtenir un accès admin sans dépendre de
// l'interface "Équipe" si celle-ci est temporairement indisponible.
export async function POST(request: Request) {
  const setupSecret = process.env.SETUP_SECRET;
  if (!setupSecret) {
    return NextResponse.json({ error: "Configuration manquante : SETUP_SECRET n'est pas définie sur le serveur." }, { status: 500 });
  }

  const { secret, firstName, lastName, password } = await request.json();
  if (secret !== setupSecret) {
    return NextResponse.json({ error: "Code d'installation incorrect." }, { status: 403 });
  }
  if (!firstName || !lastName || !password || String(password).length < 8) {
    return NextResponse.json({ error: "Prénom, nom et mot de passe (8 caractères minimum) sont requis." }, { status: 400 });
  }

  const admin = createAdminClient();

  const identifiant = await generateIdentifiant(firstName, lastName);
  const authEmail = authEmailFor(identifiant);

  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email: authEmail,
    password,
    email_confirm: true,
    user_metadata: { identifiant, first_name: firstName, last_name: lastName },
  });
  if (authError || !authUser?.user) {
    return NextResponse.json({ error: "Erreur : " + authError?.message }, { status: 500 });
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: authUser.user.id,
    identifiant,
    auth_email: authEmail,
    first_name: firstName,
    last_name: lastName,
    role: "admin",
    status: "active",
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(authUser.user.id);
    return NextResponse.json({ error: "Erreur : " + profileError.message }, { status: 500 });
  }

  const { data: machines } = await admin.from("machines").select("id").eq("active", true);
  if (machines && machines.length > 0) {
    await admin.from("competencies").insert(machines.map((m) => ({ profile_id: authUser.user.id, machine_id: m.id, level: "none" })));
  }

  await logAction(authUser.user.id, "creation_administratrice_secours", "profile", authUser.user.id, { identifiant });

  const supabase = createClient();
  await supabase.auth.signInWithPassword({ email: authEmail, password });

  return NextResponse.json({ ok: true, identifiant });
}
