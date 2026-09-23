import { NextResponse } from "next/server";
import { requireAdminOrOwner } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAction } from "@/lib/audit";

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const actor = await requireAdminOrOwner();
  if (!actor) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

  const admin = createAdminClient();
  await admin.from("machine_closures").delete().eq("id", params.id);
  await logAction(actor.id, "suppression_fermeture_poste", "machine_closure", params.id);
  return NextResponse.json({ ok: true });
}
