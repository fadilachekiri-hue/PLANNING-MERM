import { NextResponse } from "next/server";
import { requireAdminOrOwner } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAction, notify } from "@/lib/audit";
import { sendEmail, baseEmailLayout } from "@/lib/email";

export async function POST(request: Request) {
  const actor = await requireAdminOrOwner();
  if (!actor) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

  const { day, startTime, endTime, machineId, reason, candidateIds, shiftId } = await request.json();
  if (!day || !startTime || !endTime || !Array.isArray(candidateIds) || candidateIds.length === 0) {
    return NextResponse.json({ error: "Jour, horaires et au moins un candidat sont requis." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: reqRow, error } = await admin
    .from("replacement_requests")
    .insert({ day, start_time: startTime, end_time: endTime, machine_id: machineId || null, reason: reason || null, created_by: actor.id, shift_id: shiftId || null })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("replacement_candidates").insert(candidateIds.map((profileId: string) => ({ request_id: reqRow.id, profile_id: profileId })));

  const { data: candidates } = await admin.from("profiles").select("id, first_name, contact_email").in("id", candidateIds);
  for (const c of candidates || []) {
    await notify(c.id, "recherche_remplacant", "Recherche de remplaçant", `${day} de ${startTime} à ${endTime}`, "/remplacements");
    if (c.contact_email) {
      await sendEmail({
        to: c.contact_email,
        subject: "Recherche de remplaçant — Planning MERM",
        category: "recherche_remplacant",
        profileId: c.id,
        html: baseEmailLayout(
          "Recherche de remplaçant",
          `<p>Bonjour ${c.first_name},</p><p>Un besoin de remplacement a été identifié le ${day} de ${startTime} à ${endTime}${reason ? ` (${reason})` : ""}. Merci d'indiquer votre disponibilité dans l'application.</p>`
        ),
      });
    }
  }

  await logAction(actor.id, "creation_recherche_remplacant", "replacement_request", reqRow.id, { candidateIds });
  return NextResponse.json({ ok: true, request: reqRow });
}
