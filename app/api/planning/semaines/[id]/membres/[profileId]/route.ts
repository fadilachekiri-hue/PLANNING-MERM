import { NextResponse } from "next/server";
import { requireAdminOrOwner } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAction } from "@/lib/audit";

// "Retirer du planning" : la personne disparaît de CETTE semaine (ses
// créneaux sur cette semaine sont supprimés) mais son compte et ses autres
// semaines restent intacts.
export async function DELETE(_request: Request, { params }: { params: { id: string; profileId: string } }) {
  const actor = await requireAdminOrOwner();
  if (!actor) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

  const admin = createAdminClient();
  await admin.from("shifts").delete().eq("week_id", params.id).eq("profile_id", params.profileId);
  await admin.from("week_members").delete().eq("week_id", params.id).eq("profile_id", params.profileId);

  await logAction(actor.id, "retrait_membre_semaine", "week", params.id, { profileId: params.profileId });
  return NextResponse.json({ ok: true });
}
