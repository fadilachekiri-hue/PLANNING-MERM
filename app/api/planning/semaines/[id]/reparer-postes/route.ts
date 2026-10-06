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

// Répare TOUTES les semaines de septembre-octobre 2026 (pas seulement celle
// affichée) : recrée tout créneau de travail manquant et réaffecte le bon
// poste (machine_id), d'après les données déduites du fichier Excel.
// Accessible depuis l'appli (session admin), sans code d'installation —
// contrairement à /api/setup/assigner-postes qui retraite aussi novembre-
// décembre. Le paramètre [id] n'est conservé que pour le contexte du log.
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const actor = await requireAdminOrOwner();
  if (!actor) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

  const admin = createAdminClient();
  const report = { postesAssignes: 0, semainesTraitees: 0, introuvables: [] as string[] };

  const { data: machines } = await admin.from("machines").select("id, name").eq("active", true);
  const machineIdByName = new Map((machines || []).map((m) => [m.name, m.id]));

  const profileCache = new Map<string, string | null>();
  async function profileId(importKey: string): Promise<string | null> {
    if (profileCache.has(importKey)) return profileCache.get(importKey)!;
    const lastName = FALLBACK_LAST_NAME[importKey] || importKey;
    const { data } = await admin.from("profiles").select("id").ilike("last_name", lastName).maybeSingle();
    profileCache.set(importKey, data?.id || null);
    return data?.id || null;
  }

  const weekIdCache = new Map<string, string | null>();
  async function weekId(weekStart: string): Promise<string | null> {
    if (weekIdCache.has(weekStart)) return weekIdCache.get(weekStart)!;
    const { data } = await admin.from("weeks").select("id").eq("start_date", weekStart).maybeSingle();
    weekIdCache.set(weekStart, data?.id || null);
    return data?.id || null;
  }

  for (const a of SEPT_OCT_MACHINES) {
    const pid = await profileId(a.lastName);
    const wid = await weekId(a.weekStart);
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

    const { data: shift } = await admin
      .from("shifts")
      .select("id, notes")
      .eq("week_id", wid)
      .eq("profile_id", pid)
      .eq("day_of_week", a.dayOfWeek)
      .eq("shift_type", "work")
      .maybeSingle();

    if (!shift) {
      const source = IMPORT_SHIFTS.find(
        (s) => s.lastName === a.lastName && s.weekStart === a.weekStart && s.dayOfWeek === a.dayOfWeek && s.shiftType === "work"
      );
      if (!source) {
        report.introuvables.push(`${a.lastName} ${a.weekStart} j${a.dayOfWeek} : créneau de travail introuvable dans les données d'import`);
        continue;
      }
      const notes = a.machine === "Scanner" ? "Couvre aussi X-STRAHL 13h-14h" : source.notes;
      await admin.from("week_members").upsert({ week_id: wid, profile_id: pid }, { onConflict: "week_id,profile_id" });
      const { error } = await admin.from("shifts").insert({
        week_id: wid,
        profile_id: pid,
        day_of_week: a.dayOfWeek,
        start_time: source.startTime,
        end_time: source.endTime,
        shift_type: "work",
        machine_id: machineId,
        notes,
      });
      if (error) {
        report.introuvables.push(`${a.lastName} ${a.weekStart} j${a.dayOfWeek} : échec de recréation (${error.message})`);
        continue;
      }
      report.postesAssignes++;
      continue;
    }

    const notes = a.machine === "Scanner" ? "Couvre aussi X-STRAHL 13h-14h" : shift.notes;
    await admin.from("shifts").update({ machine_id: machineId, notes }).eq("id", shift.id);
    report.postesAssignes++;
  }

  report.semainesTraitees = weekIdCache.size;

  await logAction(actor.id, "reparation_postes_toutes_semaines", "week", null, report);
  return NextResponse.json({ ok: true, report });
}
