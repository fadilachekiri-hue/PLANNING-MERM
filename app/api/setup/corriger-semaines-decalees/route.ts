import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mondayOf } from "@/lib/week";
import { logAction } from "@/lib/audit";

// Outil de secours protégé par SETUP_SECRET : corrige les semaines dont la
// date de début n'est pas un lundi (créées avant le correctif forçant le
// lundi). Sans créneau de travail : la date est simplement recalée sur le
// bon lundi (ou fusionnée si une semaine correcte existe déjà). Avec des
// créneaux : laissée de côté et signalée, car décaler la date sans décaler
// les day_of_week des créneaux fausserait le planning — à traiter à la main.
export async function POST(request: Request) {
  const setupSecret = process.env.SETUP_SECRET;
  if (!setupSecret) {
    return NextResponse.json({ error: "Configuration manquante : SETUP_SECRET n'est pas définie sur le serveur." }, { status: 500 });
  }

  const { secret } = await request.json();
  if (secret !== setupSecret) {
    return NextResponse.json({ error: "Code d'installation incorrect." }, { status: 403 });
  }

  const admin = createAdminClient();
  const report = {
    corrigees: [] as string[],
    fusionnees: [] as string[],
    aTraiterManuellement: [] as string[],
    errors: [] as string[],
  };

  const { data: weeks, error } = await admin.from("weeks").select("id, start_date");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  for (const week of weeks || []) {
    const correctMonday = mondayOf(new Date(week.start_date + "T00:00:00"));
    if (correctMonday === week.start_date) continue; // déjà correcte

    const { count: shiftsCount } = await admin.from("shifts").select("id", { count: "exact", head: true }).eq("week_id", week.id);
    if ((shiftsCount || 0) > 0) {
      report.aTraiterManuellement.push(`${week.start_date} → devrait être ${correctMonday} (${shiftsCount} créneau(x), non touchée)`);
      continue;
    }

    const { data: correctWeek } = await admin.from("weeks").select("id").eq("start_date", correctMonday).maybeSingle();

    if (correctWeek) {
      // Une semaine correcte existe déjà : on y transfère les membres, puis on supprime la semaine décalée.
      const { data: members } = await admin.from("week_members").select("profile_id").eq("week_id", week.id);
      for (const m of members || []) {
        await admin.from("week_members").upsert({ week_id: correctWeek.id, profile_id: m.profile_id }, { onConflict: "week_id,profile_id" });
      }
      await admin.from("week_members").delete().eq("week_id", week.id);
      const { error: delError } = await admin.from("weeks").delete().eq("id", week.id);
      if (delError) report.errors.push(`${week.start_date} : ${delError.message}`);
      else report.fusionnees.push(`${week.start_date} → fusionnée dans ${correctMonday}`);
    } else {
      const { error: updateError } = await admin.from("weeks").update({ start_date: correctMonday }).eq("id", week.id);
      if (updateError) report.errors.push(`${week.start_date} : ${updateError.message}`);
      else report.corrigees.push(`${week.start_date} → ${correctMonday}`);
    }
  }

  await logAction(null, "correction_semaines_decalees", "week", null, {
    corrigees: report.corrigees.length,
    fusionnees: report.fusionnees.length,
    aTraiterManuellement: report.aTraiterManuellement.length,
  });

  return NextResponse.json({ ok: true, report });
}
