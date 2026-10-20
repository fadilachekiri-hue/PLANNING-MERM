import { NextResponse } from "next/server";
import { requireAdminOrOwner } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAction } from "@/lib/audit";
import { mondayOf, addDaysToIso } from "@/lib/week";
import { DECEMBRE_2026 } from "@/lib/planning-decembre-2026";
import { NOV_DEC_PROPOSAL } from "@/lib/proposition-novembre-decembre-2026";

const MORNING = { start: "08:00", end: "15:36" };
const EVENING = { start: "13:24", end: "21:00" };

// Repli nom/prenom attendu par cle d'import, identique a reparer-postes.
const FALLBACK_NAME: Record<string, string> = {
  "EL ZAYAT": "El Zayat",
};

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

function dayOfWeekOf(dateIso: string): number {
  const d = new Date(dateIso + "T00:00:00Z");
  const jsDay = d.getUTCDay(); // 0 = dimanche
  return jsDay === 0 ? 6 : jsDay - 1; // 0 = lundi
}

// Rotation habituelle de Renou et Carementrant (NOV_DEC_PROPOSAL), conservee telle
// quelle en decembre - sauf sur leurs jours de conge/repos demandes ce mois-ci, qui
// remplacent leur poste habituel par un repos.
const ROTATION_LEAVE: Record<string, string[]> = {
  RENOU: ["2026-12-28", "2026-12-29", "2026-12-30", "2026-12-31"],
  CAREMENTRANT: ["2026-12-04", "2026-12-07", "2026-12-23", "2026-12-24"],
};

// Construit le planning de decembre 2026 : memes binomes/postes fixes tout le mois
// (continuite des patients), sauf Renou et Carementrant qui gardent leur rotation
// habituelle. Accessible depuis l'appli (session admin), rejouable sans doublon -
// toutes les lectures/ecritures sont groupees comme /reparer-postes.
export async function POST(_request: Request) {
  try {
    const actor = await requireAdminOrOwner();
    if (!actor) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

    const admin = createAdminClient();
    const report = { postesAssignes: 0, semainesCreees: 0, introuvables: [] as string[] };

    const [{ data: machines }, { data: profiles }, { data: weeks }] = await Promise.all([
      admin.from("machines").select("id, name").eq("active", true),
      admin.from("profiles").select("id, first_name, last_name"),
      admin.from("weeks").select("id, start_date"),
    ]);

    const machineIdByName = new Map((machines || []).map((m) => [m.name, m.id]));
    const weekIdByStart = new Map((weeks || []).map((w) => [String(w.start_date).slice(0, 10), w.id]));

    function findProfileId(lastName: string): string | null {
      const expected = norm(FALLBACK_NAME[lastName.toUpperCase()] || lastName);
      const match = (profiles || []).find(
        (p: any) => norm(p.last_name || "") === expected || norm(p.first_name || "") === expected
      );
      return match?.id || null;
    }

    // Rassemble toutes les entrées à écrire sous une forme commune.
    type Entry = { profileKey: string; date: string; shiftType: string; machine: string | null; notes: string | null };
    const entries: Entry[] = [];

    for (const s of DECEMBRE_2026) {
      entries.push({ profileKey: s.lastName, date: s.date, shiftType: s.shiftType, machine: s.machine, notes: null });
    }

    // Renou + Carementrant : leur rotation habituelle (NOV_DEC_PROPOSAL), remplacée
    // par un repos sur leurs jours de congé demandés ce mois-ci.
    for (const a of NOV_DEC_PROPOSAL) {
      if (a.importKey !== "RENOU" && a.importKey !== "CAREMENTRANT") continue;
      if (!a.weekStart.startsWith("2026-11-30") && !a.weekStart.startsWith("2026-12")) continue;
      const date = addDaysToIso(a.weekStart, a.dayOfWeek);
      if (!date.startsWith("2026-12")) continue; // ignore le débordement sur novembre
      const leaveDates = ROTATION_LEAVE[a.importKey] || [];
      if (leaveDates.includes(date)) {
        entries.push({ profileKey: a.importKey, date, shiftType: "repos", machine: null, notes: null });
      } else {
        entries.push({ profileKey: a.importKey, date, shiftType: "work", machine: a.machine, notes: a.notes });
      }
    }

    // Semaines nécessaires (lundi de chaque date rencontrée).
    const neededWeekStarts = [...new Set(entries.map((e) => mondayOf(new Date(e.date + "T00:00:00"))))];
    const missingWeekStarts = neededWeekStarts.filter((ws) => !weekIdByStart.has(ws));
    if (missingWeekStarts.length > 0) {
      const { data: created, error } = await admin
        .from("weeks")
        .insert(missingWeekStarts.map((start_date) => ({ start_date, status: "draft" })))
        .select("id, start_date");
      if (error) {
        report.introuvables.push(`Création des semaines : ${error.message}`);
      } else {
        for (const w of created || []) weekIdByStart.set(String(w.start_date).slice(0, 10), w.id);
        report.semainesCreees = (created || []).length;
      }
    }

    const relevantWeekIds = neededWeekStarts.map((ws) => weekIdByStart.get(ws)).filter(Boolean) as string[];

    const { data: existingShifts } =
      relevantWeekIds.length > 0
        ? await admin.from("shifts").select("id, week_id, profile_id, day_of_week").in("week_id", relevantWeekIds)
        : { data: [] as any[] };
    const existingByKey = new Map((existingShifts || []).map((s: any) => [`${s.week_id}_${s.profile_id}_${s.day_of_week}`, s]));

    const toInsert: any[] = [];
    const toUpdate: { id: string; shift_type: string; start_time: string | null; end_time: string | null; machine_id: string | null; notes: string | null }[] = [];
    const weekMemberPairs = new Map<string, { week_id: string; profile_id: string }>();

    for (const e of entries) {
      const pid = findProfileId(e.profileKey);
      const wid = weekIdByStart.get(mondayOf(new Date(e.date + "T00:00:00"))) || null;
      const dayOfWeek = dayOfWeekOf(e.date);
      if (!pid) {
        report.introuvables.push(`${e.profileKey} ${e.date} : profil introuvable`);
        continue;
      }
      if (!wid) {
        report.introuvables.push(`${e.profileKey} ${e.date} : semaine introuvable`);
        continue;
      }
      let machineId: string | null = null;
      if (e.shiftType === "work") {
        machineId = e.machine ? machineIdByName.get(e.machine) || null : null;
        if (e.machine && !machineId) {
          report.introuvables.push(`${e.profileKey} ${e.date} : poste "${e.machine}" introuvable`);
          continue;
        }
      }
      const times = e.shiftType === "work" ? MORNING : { start: null, end: null };
      // Le roulement de Renou/Carementrant précise déjà matin/soir dans leurs notes ;
      // on ne connaît que "matin" par défaut pour les entrées du reste de l'équipe.
      const existing = existingByKey.get(`${wid}_${pid}_${dayOfWeek}`);

      weekMemberPairs.set(`${wid}_${pid}`, { week_id: wid, profile_id: pid });

      if (existing) {
        toUpdate.push({
          id: existing.id,
          shift_type: e.shiftType,
          start_time: times.start,
          end_time: times.end,
          machine_id: machineId,
          notes: e.notes,
        });
      } else {
        toInsert.push({
          week_id: wid,
          profile_id: pid,
          day_of_week: dayOfWeek,
          start_time: times.start,
          end_time: times.end,
          shift_type: e.shiftType,
          machine_id: machineId,
          notes: e.notes,
        });
      }
      report.postesAssignes++;
    }

    if (weekMemberPairs.size > 0) {
      const { error } = await admin.from("week_members").upsert([...weekMemberPairs.values()], { onConflict: "week_id,profile_id" });
      if (error) report.introuvables.push(`Membres de semaine : ${error.message}`);
    }

    if (toInsert.length > 0) {
      const { error } = await admin.from("shifts").insert(toInsert);
      if (error) report.introuvables.push(`Création groupée des créneaux (${toInsert.length}) : ${error.message}`);
    }

    if (toUpdate.length > 0) {
      let i = 0;
      const limit = 15;
      const updateErrors: string[] = [];
      async function worker() {
        while (i < toUpdate.length) {
          const u = toUpdate[i++];
          const { error } = await admin
            .from("shifts")
            .update({ shift_type: u.shift_type, start_time: u.start_time, end_time: u.end_time, machine_id: u.machine_id, notes: u.notes })
            .eq("id", u.id);
          if (error) updateErrors.push(error.message);
        }
      }
      await Promise.all(Array.from({ length: Math.min(limit, toUpdate.length) }, worker));
      if (updateErrors.length > 0) report.introuvables.push(`${updateErrors.length} mise(s) à jour en échec : ${updateErrors[0]}`);
    }

    await logAction(actor.id, "construction_planning_decembre_2026", "week", null, report);
    return NextResponse.json({ ok: true, report });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Erreur inattendue lors de la construction du planning." }, { status: 500 });
  }
}
