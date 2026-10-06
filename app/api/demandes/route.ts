import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAction } from "@/lib/audit";

export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

  const { type, dateStart, dateEnd, comment } = await request.json();
  if (!["conge", "rtt", "absence", "indisponibilite"].includes(type) || !dateStart || !dateEnd) {
    return NextResponse.json({ error: "Champs invalides." }, { status: 400 });
  }
  if (dateEnd < dateStart) {
    return NextResponse.json({ error: "La date de fin doit être après la date de début." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("leave_requests")
    .insert({ profile_id: profile.id, type, date_start: dateStart, date_end: dateEnd, comment: comment || null })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAction(profile.id, "creation_demande", "leave_request", data.id, { type, dateStart, dateEnd });

  return NextResponse.json({ ok: true, request: data });
}
