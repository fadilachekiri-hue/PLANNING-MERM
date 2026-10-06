import { NextResponse } from "next/server";
import { requireAdminOrOwner } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAction } from "@/lib/audit";
import { SEPT_OCT_MACHINES } from "@/lib/machines-septembre-octobre-2026";
import { IMPORT_SHIFTS } from "@/lib/import-planning-2026";

// Repli nom de famille attendu par clé d'import, identique à
// /api/setup/assigner-postes (mêmes données source, pour matcher les profils).
const FALLBACK_LAST_NAME: Record<string, string> = {
  "CAREMENTRANT": "Carementrant",
  "CHARBONNEL": "Charbonnel",
  "CHAULIAC": "Chauliac",
  "DUMONT": "Dumont",
  "EL ZAYAT": "El Zayat",
  "FONTENEAU": "Fonteneau",
  "GAUTIER": "Gautier",
  "GENET": "Genet",
  "HICQUEL": "Hicquel",
  "LEDIEU": "Ledieu",
  "RENOU": "Renou",
  "VINCENOT": "Vincenot",
  "CHANEZ R": "Rahmani",
  "FANTA C": "Coulibaly",
  "JALALL B": "Jallal",
  "FAUCHEUX": "Faucheux",
  "TEIXEIRA": "Teixeira",
};

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

async function mapWithConcurrency<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const item = items[i++];
      await fn(item);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

// Répare TOUTES les semaines de septembre-octobre 2026 (pas seulement celle
// affichée) : recrée tout créneau de travail manquant et réaffecte le bon
// poste (machine_id), d'après les données déduites du fichier Excel.
// Accessible depuis l'appli (session admin), sans code d'installation —
// contrairement à /api/setup/assigner-postes qui retraite aussi novembre-
// décembre. Le paramètre [id] n'est conservé que pour le contexte du log.
// Toutes les lectures/écritures sont groupées (quelques requêtes au total,
// pas une par créneau) pour rester largement sous la limite de temps d'une
// fonction serverless même avec ~400 entrées à traiter.
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    const actor = await requireAdminOrOwner();
    if (!actor) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

    const admin = createAdminClient();
    const report = { postesAssignes: 0, semainesTraitees: 0, introuvables: [] as string[] };

    const [{ data: machines }, { data: profiles }, { data: weeks }] = await Promise.all([
      admin.from("machines").select("id, name").eq("active", true),
      admin.from("profiles").select("id, first_name, last_name"),
      admin.from("weeks").select("id, start_date"),
    ]);

    const machineIdByName = new Map((machines || []).map((m) => [m.name, m.id]));
    // .slice(0, 10) : certaines colonnes "date" renvoient parfois un horodatage
    // complet (ex. "2026-10-05T00:00:00") au lieu de "2026-10-05" — sans cette
    // normalisation, la comparaison stricte avec les chaînes "YYYY-MM-DD" de
    // SEPT_OCT_MACHINES échouait silencieusement et aucune semaine ne matchait.
    const weekIdByStart = new Map((weeks || []).map((w) => [String(w.start_date).slice(0, 10), w.id]));

    const unmatchedImportKeys: string[] = [];
    const profileIdByImportKey = new Map<string, string | null>();
    for (const importKey of new Set(SEPT_OCT_MACHINES.map((a) => a.lastName))) {
      const expected = norm(FALLBACK_LAST_NAME[importKey] || importKey);
      // Compare au nom ET au prénom (pas seulement au nom de famille) : certains
      // profils ont prénom/nom inversés par rapport à la correction attendue
      // (ex. "Jallal" stocké comme prénom et "Benhmidal" comme nom de famille),
      // ce qui faisait échouer silencieusement le matching strict sur last_name.
      const match = (profiles || []).find(
        (p: any) => norm(p.last_name || "") === expected || norm(p.first_name || "") === expected
      );
      profileIdByImportKey.set(importKey, match?.id || null);
      if (!match) unmatchedImportKeys.push(importKey);
    }

    const relevantWeekIds = [...new Set(SEPT_OCT_MACHINES.map((a) => weekIdByStart.get(a.weekStart)).filter(Boolean))] as string[];
    report.semainesTraitees = relevantWeekIds.length;

    const { data: existingShifts } =
      relevantWeekIds.length > 0
        ? await admin.from("shifts").select("id, week_id, profile_id, day_of_week, notes").eq("shift_type", "work").in("week_id", relevantWeekIds)
        : { data: [] as any[] };
    const existingByKey = new Map((existingShifts || []).map((s: any) => [`${s.week_id}_${s.profile_id}_${s.day_of_week}`, s]));

    const toInsert: any[] = [];
    const toUpdate: { id: string; machine_id: string; notes: string | null }[] = [];
    const weekMemberPairs = new Map<string, { week_id: string; profile_id: string }>();

    for (const a of SEPT_OCT_MACHINES) {
      const pid = profileIdByImportKey.get(a.lastName) || null;
      const wid = weekIdByStart.get(a.weekStart) || null;
      const machineId = machineIdByName.get(a.machine);
      if (!pid) {
        report.introuvables.push(`${a.lastName} ${a.weekStart} j${a.dayOfWeek} : profil introuvable`);
        continue;
      }
      if (!wid) {
        report.introuvables.push(`${a.lastName} ${a.weekStart} j${a.dayOfWeek} : semaine introuvable`);
        continue;
      }
      if (!machineId) {
        report.introuvables.push(`${a.lastName} ${a.weekStart} j${a.dayOfWeek} : poste "${a.machine}" introuvable`);
        continue;
      }

      const notesOverride = a.machine === "Scanner" ? "Couvre aussi X-STRAHL 13h-14h" : null;
      const existing = existingByKey.get(`${wid}_${pid}_${a.dayOfWeek}`);

      if (existing) {
        toUpdate.push({ id: existing.id, machine_id: machineId, notes: notesOverride ?? existing.notes });
        report.postesAssignes++;
        continue;
      }

      const source = IMPORT_SHIFTS.find(
        (s) => s.lastName === a.lastName && s.weekStart === a.weekStart && s.dayOfWeek === a.dayOfWeek && s.shiftType === "work"
      );
      if (!source) {
        report.introuvables.push(`${a.lastName} ${a.weekStart} j${a.dayOfWeek} : créneau de travail introuvable dans les données d'import`);
        continue;
      }

      weekMemberPairs.set(`${wid}_${pid}`, { week_id: wid, profile_id: pid });
      toInsert.push({
        week_id: wid,
        profile_id: pid,
        day_of_week: a.dayOfWeek,
        start_time: source.startTime,
        end_time: source.endTime,
        shift_type: "work",
        machine_id: machineId,
        notes: notesOverride ?? source.notes,
      });
      report.postesAssignes++;
    }

    if (unmatchedImportKeys.length > 0) {
      report.introuvables.unshift(`Profils non reconnus (nom et prénom) : ${unmatchedImportKeys.join(", ")}`);
    }

    if (weekMemberPairs.size > 0) {
      const { error } = await admin.from("week_members").upsert([...weekMemberPairs.values()], { onConflict: "week_id,profile_id" });
      if (error) report.introuvables.push(`Membres de semaine : ${error.message} (${error.details || error.hint || ""})`);
    }

    if (toInsert.length > 0) {
      const { error } = await admin.from("shifts").insert(toInsert);
      if (error) report.introuvables.push(`Création groupée des créneaux (${toInsert.length}) : ${error.message} (${error.details || error.hint || ""})`);
    }

    if (toUpdate.length > 0) {
      const updateErrors: string[] = [];
      await mapWithConcurrency(toUpdate, 15, async (u) => {
        const { error } = await admin.from("shifts").update({ machine_id: u.machine_id, notes: u.notes }).eq("id", u.id);
        if (error) updateErrors.push(error.message);
      });
      if (updateErrors.length > 0) {
        report.introuvables.push(`${updateErrors.length} mise(s) à jour en échec : ${updateErrors[0]}`);
      }
    }

    await logAction(actor.id, "reparation_postes_toutes_semaines", "week", null, report);

    // Vérification : relit en base les créneaux de la semaine demandée juste
    // après l'écriture, pour voir si les machine_id sont réellement persistés.
    const { data: verif } = await admin
      .from("shifts")
      .select("id, day_of_week, machine_id, shift_type")
      .eq("week_id", params.id)
      .eq("shift_type", "work");
    const toUpdateForThisWeek = toUpdate.filter((u) => (existingShifts || []).some((s: any) => s.id === u.id && s.week_id === params.id));

    console.log("[reparer-postes] diagnostic", JSON.stringify({
      weekIdRequested: params.id,
      machinesCount: (machines || []).length,
      machineNames: (machines || []).map((m: any) => m.name),
      weeksCount: (weeks || []).length,
      relevantWeekIds: relevantWeekIds.length,
      unmatchedImportKeys,
      existingShiftsCount: (existingShifts || []).length,
      toInsertCount: toInsert.length,
      toUpdateCount: toUpdate.length,
      toUpdateForThisWeekCount: toUpdateForThisWeek.length,
      verifShiftsForThisWeek: (verif || []).map((s: any) => ({ day: s.day_of_week, machine_id: s.machine_id })),
      postesAssignes: report.postesAssignes,
      introuvablesCount: report.introuvables.length,
      introuvablesSample: report.introuvables.slice(0, 10),
    }));
    return NextResponse.json({ ok: true, report });
  } catch (err: any) {
    console.log("[reparer-postes] erreur", err?.message, err?.stack);
    return NextResponse.json({ error: err?.message || "Erreur inattendue lors de la réparation." }, { status: 500 });
  }
}
