import { NextResponse } from "next/server";
import { requireAdminOrOwner } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAction, notify } from "@/lib/audit";
import { sendEmail, baseEmailLayout } from "@/lib/email";
import { mondayOf } from "@/lib/week";

const LEAVE_SHIFT_TYPE: Record<string, string | null> = {
  conge: "conge",
  rtt: "rtt",
  absence: "absence",
  indisponibilite: null, // préférence, ne bloque pas automatiquement le planning
};

function eachDate(start: string, end: string): string[] {
  const dates: string[] = [];
  const d = new Date(start + "T00:00:00");
  const last = new Date(end + "T00:00:00");
  while (d <= last) {
    dates.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

function dayOfWeekIndex(iso: string): number {
  const jsDay = new Date(iso + "T00:00:00").getDay(); // 0 = dimanche
  return jsDay === 0 ? 6 : jsDay - 1; // 0 = lundi
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const actor = await requireAdminOrOwner();
  if (!actor) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

  const { status, comment } = await request.json();
  if (!["approved", "rejected"].includes(status)) {
    return NextResponse.json({ error: "Statut invalide." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: leave } = await admin.from("leave_requests").select("*, profiles(first_name, contact_email)").eq("id", params.id).single();
  if (!leave) return NextResponse.json({ error: "Demande introuvable." }, { status: 404 });
  if (leave.status !== "pending") return NextResponse.json({ error: "Cette demande a déjà été traitée." }, { status: 400 });

  await admin
    .from("leave_requests")
    .update({ status, decided_by: actor.id, decided_at: new Date().toISOString(), decision_comment: comment || null })
    .eq("id", params.id);

  const daysNeedingReview: string[] = [];

  if (status === "approved") {
    const shiftType = LEAVE_SHIFT_TYPE[leave.type];
    if (shiftType) {
      for (const dateIso of eachDate(leave.date_start, leave.date_end)) {
        const monday = mondayOf(new Date(dateIso + "T00:00:00"));
        const { data: week } = await admin.from("weeks").select("id").eq("start_date", monday).maybeSingle();
        if (!week) continue; // aucune semaine créée pour cette période, rien à ajuster

        const dow = dayOfWeekIndex(dateIso);
        const { data: existingWork } = await admin
          .from("shifts")
          .select("id")
          .eq("week_id", week.id)
          .eq("profile_id", leave.profile_id)
          .eq("day_of_week", dow)
          .eq("shift_type", "work");

        if (existingWork && existingWork.length > 0) {
          daysNeedingReview.push(dateIso);
          continue;
        }

        await admin.from("shifts").insert({
          week_id: week.id,
          profile_id: leave.profile_id,
          day_of_week: dow,
          shift_type: shiftType,
          created_by: actor.id,
          updated_by: actor.id,
        });
      }
    }
  }

  await notify(
    leave.profile_id,
    "demande_decision",
    status === "approved" ? "Votre demande a été acceptée" : "Votre demande a été refusée",
    comment || undefined,
    "/demandes"
  );
  if (leave.profiles?.contact_email) {
    await sendEmail({
      to: leave.profiles.contact_email,
      subject: `Votre demande a été ${status === "approved" ? "acceptée" : "refusée"} — Planning MERM`,
      category: "demande_decision",
      profileId: leave.profile_id,
      html: baseEmailLayout(
        status === "approved" ? "Demande acceptée" : "Demande refusée",
        `<p>Bonjour ${leave.profiles.first_name},</p><p>Votre demande du ${leave.date_start} au ${leave.date_end} a été ${status === "approved" ? "acceptée" : "refusée"}.</p>${comment ? `<p>Commentaire : ${comment}</p>` : ""}`
      ),
    });
  }

  await logAction(actor.id, "decision_demande", "leave_request", params.id, { status });

  return NextResponse.json({ ok: true, daysNeedingReview });
}
