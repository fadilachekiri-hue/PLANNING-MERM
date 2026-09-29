import { NextResponse } from "next/server";
import { requireAdminOrOwner } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAction } from "@/lib/audit";

export async function POST(request: Request) {
  const actor = await requireAdminOrOwner();
  if (!actor) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

  const { machineId, dayOfWeek, startTime, endTime, minCount } = await request.json();
  if (!machineId || dayOfWeek === undefined || !startTime || !endTime || !minCount) {
    return NextResponse.json({ error: "Champs manquants." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("min_staffing")
    .insert({ machine_id: machineId, day_of_week: dayOfWeek, start_time: startTime, end_time: endTime, min_count: minCount })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAction(actor.id, "creation_regle_effectif", "min_staffing", data.id);
  return NextResponse.json({ ok: true, rule: data });
}
