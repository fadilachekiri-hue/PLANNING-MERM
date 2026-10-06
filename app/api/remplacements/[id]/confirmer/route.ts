import { NextResponse } from "next/server";
import { requireAdminOrOwner } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAction, notify } from "@/lib/audit";
import { sendEmail, baseEmailLayout } from "@/lib/email";
import { mondayOf } from "@/lib/week";

function dayOfWeekIndex(iso: string): number {
  const jsDay = new Date(iso + "T00:00:00").getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

// La cadre choisit elle-même la personne parmi celles ayant répondu
// "disponible" — aucune attribution automatique.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const actor = await requireAdminOrOwner();
  if (!actor) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

  const { profileId } = await request.json();
  const admin = createAdminClient();

  const { data: reqRow } = await admin.from("replacement_requests").select("*").eq("id", params.id).single();
  if (!reqRow) return NextResponse.json({ error: "Demande introuvable." }, { status: 404 });
  if (reqRow.status !== "open") return NextResponse.json({ error: "Cette demande n'est plus ouverte." }, { status: 400 });

  await admin.from("replacement_requests").update({ status: "filled", filled_by: profileId }).eq("id", params.id);

  const monday = mondayOf(new Date(reqRow.day + "T00:00:00"));
  const { data: week } = await admin.from("weeks").select("id").eq("start_date", monday).maybeSingle();
  let shiftCreated = false;
  if (week) {
    await admin.from("week_members").upsert({ week_id: week.id, profile_id: profileId });
    await admin.from("shifts").insert({
      week_id: week.id,
      profile_id: profileId,
      day_of_week: dayOfWeekIndex(reqRow.day),
      start_time: reqRow.start_time,
      end_time: reqRow.end_time,
      shift_type: "work",
      machine_id: reqRow.machine_id,
      created_by: actor.id,
      updated_by: actor.id,
      notes: "Remplacement",
    });
    shiftCreated = true;
  }

  const { data: profile } = await admin.from("profiles").select("first_name, contact_email").eq("id", profileId).single();
  await notify(profileId, "remplacement_confirme", "Remplacement confirmé", `${reqRow.day} de ${reqRow.start_time} à ${reqRow.end_time}`, "/planning");
  if (profile?.contact_email) {
    await sendEmail({
      to: profile.contact_email,
      subject: "Remplacement confirmé — Planning MERM",
      category: "remplacement_confirme",
      profileId,
      html: baseEmailLayout("Remplacement confirmé", `<p>Bonjour ${profile.first_name},</p><p>Vous avez été retenu(e) pour le remplacement du ${reqRow.day} de ${reqRow.start_time} à ${reqRow.end_time}.</p>`),
    });
  }

  await logAction(actor.id, "confirmation_remplacement", "replacement_request", params.id, { profileId, shiftCreated });
  return NextResponse.json({ ok: true, shiftCreated });
}
