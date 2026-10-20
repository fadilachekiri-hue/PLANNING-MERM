import { NextResponse } from "next/server";
import { requireAdminOrOwner } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAction } from "@/lib/audit";
import { maybeNotifyChange } from "@/lib/notify-change";

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart < bEnd && bStart < aEnd;
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const actor = await requireAdminOrOwner();
  if (!actor) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

  const body = await request.json();
  const admin = createAdminClient();

  const { data: current } = await admin.from("shifts").select("*").eq("id", params.id).single();
  if (!current) return NextResponse.json({ error: "Créneau introuvable." }, { status: 404 });

  const startTime = body.startTime ?? current.start_time;
  const endTime = body.endTime ?? current.end_time;

  if (startTime && endTime && !body.force) {
    const { data: existing } = await admin
      .from("shifts")
      .select("id, start_time, end_time")
      .eq("week_id", current.week_id)
      .eq("profile_id", current.profile_id)
      .eq("day_of_week", current.day_of_week)
      .neq("id", params.id);

    const conflicts = (existing || []).filter((s) => s.start_time && s.end_time && overlaps(startTime, endTime, s.start_time, s.end_time));
    if (conflicts.length > 0) {
      return NextResponse.json({ error: "conflict", conflicts }, { status: 409 });
    }
  }

  const machineChanged = "machineId" in body && body.machineId !== current.machine_id;
  const timeChanged = startTime !== current.start_time || endTime !== current.end_time;

  const { data: shift, error } = await admin
    .from("shifts")
    .update({
      start_time: startTime,
      end_time: endTime,
      shift_type: body.shiftType ?? current.shift_type,
      machine_id: "machineId" in body ? body.machineId : current.machine_id,
      pair_id: "pairId" in body ? body.pairId : current.pair_id,
      notes: "notes" in body ? body.notes : current.notes,
      updated_by: actor.id,
    })
    .eq("id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (machineChanged || timeChanged) {
    await maybeNotifyChange(
      admin,
      current.week_id,
      current.profile_id,
      "creneau_modifie",
      machineChanged ? "Votre poste d'affectation a changé sur un créneau." : "Un horaire de votre planning a été modifié."
    );
  }
  await logAction(actor.id, "modification_creneau", "shift", params.id, body);

  return NextResponse.json({ ok: true, shift });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const actor = await requireAdminOrOwner();
  if (!actor) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

  const admin = createAdminClient();
  const { data: current } = await admin.from("shifts").select("*").eq("id", params.id).single();
  if (!current) return NextResponse.json({ error: "Créneau introuvable." }, { status: 404 });

  const { error } = await admin.from("shifts").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await maybeNotifyChange(admin, current.week_id, current.profile_id, "creneau_supprime", "Un créneau a été retiré de votre planning.");
  await logAction(actor.id, "suppression_creneau", "shift", params.id);

  return NextResponse.json({ ok: true });
}
