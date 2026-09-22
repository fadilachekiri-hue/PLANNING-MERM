import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAction } from "@/lib/audit";

// Outil de secours protégé par SETUP_SECRET : supprime un profil précis par
// nom, UNIQUEMENT s'il n'a pas encore été activé (status = 'pending') et
// n'est pas propriétaire. Sert à nettoyer un doublon créé par erreur sans
// dépendre de l'interface Équipe. Ne touche jamais un compte actif ou le
// compte propriétaire, par sécurité.
export async function POST(request: Request) {
  const setupSecret = process.env.SETUP_SECRET;
  if (!setupSecret) {
    return NextResponse.json({ error: "Configuration manquante : SETUP_SECRET n'est pas définie sur le serveur." }, { status: 500 });
  }

  const { secret, firstName, lastName } = await request.json();
  if (secret !== setupSecret) {
    return NextResponse.json({ error: "Code d'installation incorrect." }, { status: 403 });
  }
  if (!firstName || !lastName) {
    return NextResponse.json({ error: "Prénom et nom requis." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: matches, error } = await admin
    .from("profiles")
    .select("id, identifiant, first_name, last_name, role, status, job_title")
    .ilike("first_name", firstName.trim())
    .ilike("last_name", lastName.trim());

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const candidates = (matches || []).filter((p) => p.status === "pending" && p.role !== "owner");

  if (candidates.length === 0) {
    return NextResponse.json(
      { error: "Aucun profil correspondant (en attente d'activation, non propriétaire) trouvé pour ce nom." },
      { status: 404 }
    );
  }
  if (candidates.length > 1) {
    return NextResponse.json(
      {
        error: "Plusieurs profils correspondent, suppression annulée par sécurité.",
        candidates: candidates.map((c) => ({ identifiant: c.identifiant, job_title: c.job_title })),
      },
      { status: 409 }
    );
  }

  const target = candidates[0];
  const { error: deleteError } = await admin.auth.admin.deleteUser(target.id);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

  await logAction(null, "suppression_doublon_secours", "profile", target.id, { identifiant: target.identifiant });

  return NextResponse.json({ ok: true, deleted: { identifiant: target.identifiant, job_title: target.job_title } });
}
