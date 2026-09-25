import { NextResponse } from "next/server";
import { requireAdminOrOwner } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAction } from "@/lib/audit";

export async function POST(request: Request) {
  const actor = await requireAdminOrOwner();
  if (!actor) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

  const { machineId, date, startTime, endTime, reason } = await request.json();
  if (!machineId || !date) {
    return NextResponse.json({ error: "Poste et date sont requis." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("machine_closures")
    .insert({
      machine_id: machineId,
      date,
      start_time: startTime || null,
      end_time: endTime || null,
      reason: reason || null,
      created_by: actor.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAction(actor.id, "creation_fermeture_poste", "machine_closure", data.id, { machineId, date });
  return NextResponse.json({ ok: true, closure: data });
}
