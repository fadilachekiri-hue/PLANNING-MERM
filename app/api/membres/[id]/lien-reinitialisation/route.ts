import { NextResponse } from "next/server";
import { requireAdminOrOwner } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createAccessToken, resetUrl } from "@/lib/tokens";
import { logAction } from "@/lib/audit";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const actor = await requireAdminOrOwner();
  if (!actor) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("id, status").eq("id", params.id).single();
  if (!profile) return NextResponse.json({ error: "Membre introuvable." }, { status: 404 });
  if (profile.status !== "active") {
    return NextResponse.json({ error: "Ce compte n'est pas encore activé, utilisez plutôt l'invitation." }, { status: 400 });
  }

  const token = await createAccessToken(profile.id, "reset", actor.id);
  await logAction(actor.id, "generation_lien_reinitialisation", "profile", profile.id);

  return NextResponse.json({ ok: true, link: resetUrl(token) });
}
