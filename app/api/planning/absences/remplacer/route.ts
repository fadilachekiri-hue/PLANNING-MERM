import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireAdminOrOwner } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAction } from "@/lib/audit";

// Applique une proposition de remplacement calculée automatiquement
// (findReplacementProposals) après une absence : ajoute les nouveaux
// créneaux pour les personnes choisies, sans toucher à celles déjà en
// place sur ce créneau. Rien n'est jamais appliqué sans ce clic explicite.
export async function POST(request: Request) {
  const actor = await requireAdminOrOwner();
  if (!actor) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

  const { weekId, dayOfWeek, startTime, endTime, machineId, profileIds } = await request.json();
  if (!weekId || dayOfWeek === undefined || !startTime || !endTime || !machineId || !Array.isArray(profileIds) || profileIds.length === 0) {
    return NextResponse.json({ error: "Données manquantes." }, { status: 400 });
  }

  const admin = createAdminClient();

  // Ne crée des créneaux que pour les personnes pas déjà présentes sur ce
  // créneau (le reste de l'équipe, lui, ne doit pas être dupliqué).
  const { data: already } = await admin
    .from("shifts")
    .select("id, profile_id, pair_id")
    .eq("week_id", weekId)
    .eq("day_of_week", dayOfWeek)
    .eq("machine_id", machineId)
    .eq("shift_type", "work")
    .in("profile_id", profileIds);
  const alreadyIds = new Set((already || []).map((s) => s.profile_id));
  const newProfileIds = profileIds.filter((id: string) => !alreadyIds.has(id));

  if (newProfileIds.length === 0) {
    return NextResponse.json({ error: "Les personnes choisies sont déjà programmées sur ce créneau." }, { status: 400 });
  }

  // Réutilise le pair_id existant du reste de l'équipe si possible, pour que
  // le binôme reste groupé dans la vue Binômes ; sinon en crée un nouveau.
  let pairId: string | null = already?.find((s) => s.pair_id)?.pair_id || null;
  if (!pairId) {
    pairId = randomUUID();
    if (already && already.length > 0) {
      await admin.from("shifts").update({ pair_id: pairId }).in(
        "id",
        already.map((s) => s.id)
      );
    }
  }

  await admin.from("week_members").upsert(newProfileIds.map((profileId: string) => ({ week_id: weekId, profile_id: profileId })));

  const { data: shifts, error } = await admin
    .from("shifts")
    .insert(
      newProfileIds.map((profileId: string) => ({
        week_id: weekId,
        profile_id: profileId,
        day_of_week: dayOfWeek,
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

  await logAction(actor.id, "remplacement_absence", "week", weekId, { profileIds: newProfileIds, machineId, dayOfWeek });
  return NextResponse.json({ ok: true, shifts });
}
