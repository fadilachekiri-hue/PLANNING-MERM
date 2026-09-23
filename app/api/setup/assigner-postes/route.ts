import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAction } from "@/lib/audit";
import { SEPT_OCT_MACHINES } from "@/lib/machines-septembre-octobre-2026";
import { NOV_DEC_PROPOSAL } from "@/lib/proposition-novembre-decembre-2026";

const MORNING = { start: "08:00", end: "15:36" };
const EVENING = { start: "13:24", end: "21:00" };

// Applique (1) les postes de septembre-octobre 2026, déduits des couleurs du
// fichier Excel, sur les créneaux déjà importés ; (2) une proposition de
// planning brouillon pour novembre-décembre 2026 (habilitations + contraintes
// individuelles), dans des semaines restant en statut "draft" tant qu'elles
// ne sont pas publiées. Protégé par SETUP_SECRET, rejouable sans doublon.
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
    postesAssignesSeptOct: 0,
    creneauxIntrouvablesSeptOct: [] as string[],
    postesAssignesNovDec: 0,
    creneauxCreesNovDec: 0,
    erreursNovDec: [] as string[],
    avertissement: null as string | null,
  };

  const { data: machines } = await admin.from("machines").select("id, name").eq("active", true);
  const machineIdByName = new Map((machines || []).map((m) => [m.name, m.id]));

  const importKeyProbe = await admin.from("profiles").select("import_key").limit(1);
  const importKeyMissing = !!importKeyProbe.error;
  if (importKeyMissing) {
    report.avertissement =
      "La colonne import_key n'existe pas encore en base (rapprochement fait par nom de famille à la place, moins fiable). Exécutez dans Supabase SQL Editor : alter table public.profiles add column if not exists import_key text;";
  }

  // Nom de famille attendu (avant correction éventuelle) pour chaque clé
  // d'import — sert de repli si la colonne import_key est absente/vide.
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

  async function findProfileId(importKey: string): Promise<string | null> {
    if (!importKeyMissing) {
      const byKey = await admin.from("profiles").select("id").eq("import_key", importKey).maybeSingle();
      if (byKey.data) return byKey.data.id;
    }

    const fallbackName = FALLBACK_LAST_NAME[importKey] || importKey;
    const byName = await admin.from("profiles").select("id").ilike("last_name", fallbackName).maybeSingle();
    return byName.data?.id || null;
  }

  const profileCache = new Map<string, string | null>();
  async function profileId(importKey: string): Promise<string | null> {
    if (!profileCache.has(importKey)) profileCache.set(importKey, await findProfileId(importKey));
    return profileCache.get(importKey)!;
  }

  const weekCache = new Map<string, string | null>();
  async function weekId(weekStart: string): Promise<string | null> {
    if (!weekCache.has(weekStart)) {
      const { data } = await admin.from("weeks").select("id").eq("start_date", weekStart).maybeSingle();
      weekCache.set(weekStart, data?.id || null);
    }
    return weekCache.get(weekStart)!;
  }

  // 1) Septembre-octobre : assigner le poste sur les créneaux déjà importés
  for (const a of SEPT_OCT_MACHINES) {
    const pid = await profileId(a.lastName);
    const wid = await weekId(a.weekStart);
    const machineId = machineIdByName.get(a.machine);
    if (!pid || !wid || !machineId) {
      report.creneauxIntrouvablesSeptOct.push(`${a.lastName} ${a.weekStart} j${a.dayOfWeek}`);
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
      report.creneauxIntrouvablesSeptOct.push(`${a.lastName} ${a.weekStart} j${a.dayOfWeek}`);
      continue;
    }

    const notes = a.machine === "Scanner" ? "Couvre aussi X-STRAHL 13h-14h" : shift.notes;
    await admin.from("shifts").update({ machine_id: machineId, notes }).eq("id", shift.id);
    report.postesAssignesSeptOct++;
  }

  // 2) Novembre-décembre : proposition (semaines en brouillon)
  for (const p of NOV_DEC_PROPOSAL) {
    const pid = await profileId(p.importKey);
    const wid = await weekId(p.weekStart);
    const machineId = p.machine ? machineIdByName.get(p.machine) : null;
    if (!pid || !wid) {
      report.erreursNovDec.push(`${p.importKey} ${p.weekStart} j${p.dayOfWeek} : profil ou semaine introuvable.`);
      continue;
    }

    const times = p.period === "matin" ? MORNING : EVENING;
    const noteText = p.notes ? `Proposition : ${p.notes}` : "Proposition";

    if (p.existing) {
      const { data: shift } = await admin
        .from("shifts")
        .select("id")
        .eq("week_id", wid)
        .eq("profile_id", pid)
        .eq("day_of_week", p.dayOfWeek)
        .eq("shift_type", "work")
        .maybeSingle();
      if (!shift) {
        report.erreursNovDec.push(`${p.importKey} ${p.weekStart} j${p.dayOfWeek} : créneau existant introuvable.`);
        continue;
      }
      await admin.from("shifts").update({ machine_id: machineId || null, notes: noteText }).eq("id", shift.id);
      report.postesAssignesNovDec++;
      continue;
    }

    // Ne pas créer de doublon si ce créneau a déjà été proposé lors d'un essai précédent.
    const { data: already } = await admin
      .from("shifts")
      .select("id")
      .eq("week_id", wid)
      .eq("profile_id", pid)
      .eq("day_of_week", p.dayOfWeek)
      .maybeSingle();
    if (already) continue;

    await admin.from("week_members").upsert({ week_id: wid, profile_id: pid }, { onConflict: "week_id,profile_id" });

    const { error } = await admin.from("shifts").insert({
      week_id: wid,
      profile_id: pid,
      day_of_week: p.dayOfWeek,
      start_time: times.start,
      end_time: times.end,
      shift_type: "work",
      machine_id: machineId || null,
      notes: noteText,
    });
    if (error) {
      report.erreursNovDec.push(`${p.importKey} ${p.weekStart} j${p.dayOfWeek} : ${error.message}`);
      continue;
    }
    report.creneauxCreesNovDec++;
  }

  await logAction(null, "assignation_postes", "week", null, {
    postesSeptOct: report.postesAssignesSeptOct,
    creneauxNovDec: report.creneauxCreesNovDec + report.postesAssignesNovDec,
  });

  return NextResponse.json({ ok: true, report });
}
