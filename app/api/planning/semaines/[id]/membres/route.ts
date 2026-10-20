import { NextResponse } from "next/server";
import { requireAdminOrOwner } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAction } from "@/lib/audit";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const actor = await requireAdminOrOwner();
  if (!actor) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

  const { profileId } = await request.json();
  const admin = createAdminClient();
  const { error } = await admin.from("week_members").upsert({ week_id: params.id, profile_id: profileId });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAction(actor.id, "ajout_membre_semaine", "week", params.id, { profileId });
  return NextResponse.json({ ok: true });
}
