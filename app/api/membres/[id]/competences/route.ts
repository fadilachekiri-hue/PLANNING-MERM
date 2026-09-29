import { NextResponse } from "next/server";
import { requireAdminOrOwner } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAction } from "@/lib/audit";

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const actor = await requireAdminOrOwner();
  if (!actor) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

  const { levels } = await request.json(); // [{ machineId, level }]
  if (!Array.isArray(levels)) return NextResponse.json({ error: "Format invalide." }, { status: 400 });

  const admin = createAdminClient();
  for (const { machineId, level } of levels) {
    if (!["none", "training", "autonomous"].includes(level)) continue;
    await admin.from("competencies").upsert({ profile_id: params.id, machine_id: machineId, level, updated_at: new Date().toISOString() });
  }

  await logAction(actor.id, "modification_competences", "profile", params.id, { levels });
  return NextResponse.json({ ok: true });
}
