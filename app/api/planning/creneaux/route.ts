import { NextResponse } from "next/server";
import { requireAdminOrOwner } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAction } from "@/lib/audit";
import { maybeNotifyChange } from "@/lib/notify-change";

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart < bEnd && bStart < aEnd;
}

export async function POST(request: Request) {
  const actor = await requireAdminOrOwner();
  if (!actor) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

  const body = await request.json();
  const { weekId, profileId, dayOfWeek, startTime, endTime, shiftType, machineId, pairId, notes, force } = body;

  if (!weekId || !profileId || dayOfWeek === undefined || !shiftType) {
    return NextResponse.json({ error: "Champs obligatoires manquants." }, { status: 400 });
  }
  if (shiftType === "work" && (!startTime || !endTime)) {
    return NextResponse.json({ error: "Horaires obligatoires pour un créneau de travail." }, { status: 400 });
  }

  const admin = createAdminClient();

  if (startTime && endTime) {
    const { data: existing } = await admin
      .from("shifts")
      .select("id, start_time, end_time, machine_id")
      .eq("week_id", weekId)
      .eq("profile_id", profileId)
      .eq("day_of_week", dayOfWeek);

    const conflicts = (existing || []).filter((s) => s.start_time && s.end_time && overlaps(startTime, endTime, s.start_time, s.end_time));
    if (conflicts.length > 0 && !force) {
      return NextResponse.json({ error: "conflict", conflicts }, { status: 409 });
    }
  }

  const { data: shift, error } = await admin
    .from("shifts")
    .insert({
      week_id: weekId,
      profile_id: profileId,
      day_of_week: dayOfWeek,
      start_time: startTime || null,
      end_time: endTime || null,
      shift_type: shiftType,
      machine_id: shiftType === "work" ? machineId || null : null,
      pair_id: pairId || null,
      notes: notes || null,
      created_by: actor.id,
      updated_by: actor.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await maybeNotifyChange(admin, weekId, profileId, "creneau_ajoute", "Un créneau a été ajouté à votre planning.");
  await logAction(actor.id, "creation_creneau", "shift", shift.id, { profileId, dayOfWeek, shiftType });

  return NextResponse.json({ ok: true, shift });
}
