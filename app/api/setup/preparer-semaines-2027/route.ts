import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAction } from "@/lib/audit";

// Toutes les semaines (lundis) de janvier à décembre 2027.
const WEEKS_2027: string[] = [
  "2027-01-04", "2027-01-11", "2027-01-18", "2027-01-25",
  "2027-02-01", "2027-02-08", "2027-02-15", "2027-02-22",
  "2027-03-01", "2027-03-08", "2027-03-15", "2027-03-22", "2027-03-29",
  "2027-04-05", "2027-04-12", "2027-04-19", "2027-04-26",
  "2027-05-03", "2027-05-10", "2027-05-17", "2027-05-24", "2027-05-31",
  "2027-06-07", "2027-06-14", "2027-06-21", "2027-06-28",
  "2027-07-05", "2027-07-12", "2027-07-19", "2027-07-26",
  "2027-08-02", "2027-08-09", "2027-08-16", "2027-08-23", "2027-08-30",
  "2027-09-06", "2027-09-13", "2027-09-20", "2027-09-27",
  "2027-10-04", "2027-10-11", "2027-10-18", "2027-10-25",
  "2027-11-01", "2027-11-08", "2027-11-15", "2027-11-22", "2027-11-29",
  "2027-12-06", "2027-12-13", "2027-12-20", "2027-12-27",
];

// Outil de secours protégé par SETUP_SECRET : pré-crée les 52 semaines de
// 2027 (en brouillon) avec tous les MERM comme membres, sans aucun créneau —
// pour que la cadre puisse les programmer elle-même au fur et à mesure, sans
// avoir à cliquer "Créer cette semaine" une par une. Rejouable sans doublon.
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
  const report = { semainesCreees: 0, semainesDejaExistantes: 0, membresAjoutes: 0, errors: [] as string[] };

  // Tous les MERM (role "member"), y compris les comptes pas encore activés
  // — jamais la propriétaire ou les admins.
  const { data: merm, error: mermError } = await admin.from("profiles").select("id").neq("status", "disabled").eq("role", "member");
  if (mermError) return NextResponse.json({ error: mermError.message }, { status: 500 });
  const mermIds = (merm || []).map((p) => p.id);

  for (const startDate of WEEKS_2027) {
    let weekId: string;
    const { data: existing } = await admin.from("weeks").select("id").eq("start_date", startDate).maybeSingle();
    if (existing) {
      weekId = existing.id;
      report.semainesDejaExistantes++;
    } else {
      const { data: created, error } = await admin.from("weeks").insert({ start_date: startDate, status: "draft" }).select("id").single();
      if (error || !created) {
        report.errors.push(`Semaine ${startDate} : ${error?.message}`);
        continue;
      }
      weekId = created.id;
      report.semainesCreees++;
    }

    const { data: existingMembers } = await admin.from("week_members").select("profile_id").eq("week_id", weekId);
    const existingIds = new Set((existingMembers || []).map((m) => m.profile_id));
    const toAdd = mermIds.filter((id) => !existingIds.has(id));
    if (toAdd.length > 0) {
      const { error } = await admin.from("week_members").insert(toAdd.map((profile_id) => ({ week_id: weekId, profile_id })));
      if (error) report.errors.push(`Membres ${startDate} : ${error.message}`);
      else report.membresAjoutes += toAdd.length;
    }
  }

  await logAction(null, "preparation_semaines_2027", "week", null, {
    semainesCreees: report.semainesCreees,
    membresAjoutes: report.membresAjoutes,
  });

  return NextResponse.json({ ok: true, report });
}
