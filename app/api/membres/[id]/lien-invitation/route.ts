import { NextResponse } from "next/server";
import { requireAdminOrOwner } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createAccessToken, activationUrl } from "@/lib/tokens";
import { logAction } from "@/lib/audit";

// Solution de secours : génère un lien d'activation personnel à copier et
// transmettre soi-même (SMS, messagerie interne...), sans passer par l'envoi
// automatique d'e-mail.
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const actor = await requireAdminOrOwner();
  if (!actor) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("id, status").eq("id", params.id).single();
  if (!profile) return NextResponse.json({ error: "Membre introuvable." }, { status: 404 });
  if (profile.status === "active") {
    return NextResponse.json({ error: "Ce compte est déjà activé." }, { status: 400 });
  }

  const token = await createAccessToken(profile.id, "invite", actor.id);
  await logAction(actor.id, "generation_lien_invitation", "profile", profile.id);

  return NextResponse.json({ ok: true, link: activationUrl(token) });
}
