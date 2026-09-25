import { NextResponse } from "next/server";
import { requireAdminOrOwner } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { mondayOf } from "@/lib/week";

// Récupère la semaine (brouillon) correspondant à ce lundi, ou la crée si
// elle n'existe pas encore, avec tous les membres actifs pré-inclus.
export async function POST(request: Request) {
  const actor = await requireAdminOrOwner();
  if (!actor) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

  const { startDate: rawStartDate } = await request.json();
  if (!rawStartDate) return NextResponse.json({ error: "Date de semaine requise." }, { status: 400 });
  // On force toujours le lundi de la semaine, même si l'appelant envoie une
  // autre date — évite de créer des semaines décalées.
  const startDate = mondayOf(new Date(rawStartDate + "T00:00:00"));

  const admin = createAdminClient();
  let { data: week } = await admin.from("weeks").select("*").eq("start_date", startDate).maybeSingle();

  if (!week) {
    const { data: created, error } = await admin.from("weeks").insert({ start_date: startDate, status: "draft" }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    week = created;

    // Seuls les MERM (role "member") sont pré-inclus — jamais la propriétaire ou les admins.
    // On inclut aussi les comptes encore "pending" (pas encore activés) : sinon ils
    // n'apparaîtraient jamais sur les semaines créées avant leur activation.
    const { data: activeProfiles } = await admin.from("profiles").select("id").neq("status", "disabled").eq("role", "member");
    if (activeProfiles && activeProfiles.length > 0) {
      await admin.from("week_members").insert(activeProfiles.map((p) => ({ week_id: week!.id, profile_id: p.id })));
    }
  }

  return NextResponse.json({ ok: true, week });
}
