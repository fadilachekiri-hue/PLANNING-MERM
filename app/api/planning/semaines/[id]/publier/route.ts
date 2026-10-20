import { NextResponse } from "next/server";
import { requireAdminOrOwner } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, baseEmailLayout } from "@/lib/email";
import { notify, logAction } from "@/lib/audit";
import { formatWeekLabel } from "@/lib/week";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const actor = await requireAdminOrOwner();
  if (!actor) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

  const admin = createAdminClient();
  const { data: week } = await admin.from("weeks").select("*").eq("id", params.id).single();
  if (!week) return NextResponse.json({ error: "Semaine introuvable." }, { status: 404 });
  if (week.status === "published") return NextResponse.json({ error: "Cette semaine est déjà publiée." }, { status: 400 });

  await admin.from("weeks").update({ status: "published", published_at: new Date().toISOString(), published_by: actor.id }).eq("id", week.id);

  // Notification ciblée : seules les personnes concernées par cette semaine.
  const { data: members } = await admin.from("week_members").select("profile_id").eq("week_id", week.id);
  const profileIds = [...new Set((members || []).map((m) => m.profile_id))];

  const { data: profiles } = await admin.from("profiles").select("id, first_name, contact_email, status").in("id", profileIds);

  const label = formatWeekLabel(week.start_date);
  const link = `${process.env.NEXT_PUBLIC_APP_URL}/planning?semaine=${week.start_date}`;

  for (const p of profiles || []) {
    if (p.status !== "active") continue;
    await notify(p.id, "planning_publie", "Planning publié", label, `/planning?semaine=${week.start_date}`);
    if (p.contact_email) {
      await sendEmail({
        to: p.contact_email,
        subject: `Planning publié — ${label}`,
        category: "planning_publie",
        profileId: p.id,
        html: baseEmailLayout("Nouveau planning publié", `<p>Bonjour ${p.first_name},</p><p>Le planning de la ${label.toLowerCase()} vient d'être publié.</p><p><a href="${link}">Consulter le planning</a></p>`),
      });
    }
  }

  await logAction(actor.id, "publication_planning", "week", week.id, { start_date: week.start_date, notified: profileIds.length });
  return NextResponse.json({ ok: true });
}
