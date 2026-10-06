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

// Répare, pour UNE semaine précise, les postes septembre-octobre 2026 déduits
// du fichier Excel : recrée tout créneau de travail manquant et réaffecte le
// bon poste (machine_id). Accessible depuis l'appli (session admin), sans
// code d'installation — contrairement à /api/setup/assigner-postes qui
// retraite tout l'historique.
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const actor = await requireAdminOrOwner();
  if (!actor) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

  const admin = createAdminClient();
  const { data: week } = await admin.from("weeks").select("id, start_date").eq("id", params.id).maybeSingle();
  if (!week) return NextResponse.json({ error: "Semaine introuvable." }, { status: 404 });

  const entries = SEPT_OCT_MACHINES.filter((a) => a.weekStart === week.start_date);
  const report = { postesAssignes: 0, introuvables: [] as string[] };

  if (entries.length === 0) {
    return NextResponse.json({ ok: true, report, avertissement: "Aucune donnée de poste septembre-octobre pour cette semaine." });
  }

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

  for (const a of entries) {
    const pid = await profileId(a.lastName);
    const machineId = machineIdByName.get(a.machine);
    if (!pid) {
      report.introuvables.push(`${a.lastName} j${a.dayOfWeek} : profil introuvable`);
      continue;
    }
    if (!machineId) {
      report.introuvables.push(`${a.lastName} j${a.dayOfWeek} : poste "${a.machine}" introuvable`);
      continue;
    }

    const { data: shift } = await admin
      .from("shifts")
      .select("id, notes")
      .eq("week_id", week.id)
      .eq("profile_id", pid)
      .eq("day_of_week", a.dayOfWeek)
      .eq("shift_type", "work")
      .maybeSingle();

    if (!shift) {
      const source = IMPORT_SHIFTS.find(
        (s) => s.lastName === a.lastName && s.weekStart === a.weekStart && s.dayOfWeek === a.dayOfWeek && s.shiftType === "work"
      );
      if (!source) {
        report.introuvables.push(`${a.lastName} j${a.dayOfWeek} : créneau de travail introuvable dans les données d'import`);
        continue;
      }
      const notes = a.machine === "Scanner" ? "Couvre aussi X-STRAHL 13h-14h" : source.notes;
      await admin.from("week_members").upsert({ week_id: week.id, profile_id: pid }, { onConflict: "week_id,profile_id" });
      const { error } = await admin.from("shifts").insert({
        week_id: week.id,
        profile_id: pid,
        day_of_week: a.dayOfWeek,
        start_time: source.startTime,
        end_time: source.endTime,
        shift_type: "work",
        machine_id: machineId,
        notes,
      });
      if (error) {
        report.introuvables.push(`${a.lastName} j${a.dayOfWeek} : échec de recréation (${error.message})`);
        continue;
      }
      report.postesAssignes++;
      continue;
    }

    const notes = a.machine === "Scanner" ? "Couvre aussi X-STRAHL 13h-14h" : shift.notes;
    await admin.from("shifts").update({ machine_id: machineId, notes }).eq("id", shift.id);
    report.postesAssignes++;
  }

  await logAction(actor.id, "reparation_postes_semaine", "week", week.id, report);
  return NextResponse.json({ ok: true, report });
}
