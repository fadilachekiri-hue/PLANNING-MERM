import { NextResponse } from "next/server";
import { requireAdminOrOwner } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAction } from "@/lib/audit";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const actor = await requireAdminOrOwner();
  if (!actor) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

  const admin = createAdminClient();
  await admin.from("replacement_requests").update({ status: "cancelled" }).eq("id", params.id);
  await logAction(actor.id, "annulation_remplacement", "replacement_request", params.id);
  return NextResponse.json({ ok: true });
}
