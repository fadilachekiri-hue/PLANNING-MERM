import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireAdminOrOwner } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAction } from "@/lib/audit";
import { mondayOf } from "@/lib/week";

function dayOfWeekIndex(iso: string): number {
  const jsDay = new Date(iso + "T00:00:00").getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

// La cadre valide explicitement la proposition : rien n'est publié
// automatiquement avant cette action.
export async function POST(request: Request) {
  const actor = await requireAdminOrOwner();
  if (!actor) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

  const { day, startTime, endTime, machineId, profileIds } = await request.json();
  if (!day || !startTime || !endTime || !machineId || !Array.isArray(profileIds) || profileIds.length === 0) {
    return NextResponse.json({ error: "Données manquantes." }, { status: 400 });
  }

  const admin = createAdminClient();
  const monday = mondayOf(new Date(day + "T00:00:00"));
  let { data: week } = await admin.from("weeks").select("id").eq("start_date", monday).maybeSingle();
  if (!week) {
    const { data: created, error } = await admin.from("weeks").insert({ start_date: monday, status: "draft" }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    week = created;
    const { data: activeProfiles } = await admin.from("profiles").select("id").eq("status", "active");
    if (activeProfiles) await admin.from("week_members").insert(activeProfiles.map((p) => ({ week_id: week!.id, profile_id: p.id })));
  } else {
    await admin.from("week_members").upsert(profileIds.map((profileId: string) => ({ week_id: week!.id, profile_id: profileId })));
  }

  const pairId = profileIds.length > 1 ? randomUUID() : null;
  const dow = dayOfWeekIndex(day);

  const { data: shifts, error } = await admin
    .from("shifts")
    .insert(
      profileIds.map((profileId: string) => ({
        week_id: week!.id,
        profile_id: profileId,
        day_of_week: dow,
        start_time: startTime,
        end_time: endTime,
        shift_type: "work",
        machine_id: machineId,
        pair_id: pairId,
        created_by: actor.id,
        updated_by: actor.id,
      }))
    )
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAction(actor.id, "validation_binome", "week", week!.id, { profileIds, machineId, day });
  return NextResponse.json({ ok: true, shifts });
}
