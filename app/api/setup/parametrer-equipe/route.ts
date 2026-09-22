import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAction } from "@/lib/audit";
import { MACHINE_CONFIG, PERSON_CONFIG } from "@/lib/parametrage-equipe";

// Applique le paramétrage transmis par la cadre : règles de binôme et
// effectif minimum par poste, puis habilitations (compétences) et
// contraintes individuelles par manipulateur. Protégé par SETUP_SECRET,
// à usage unique mais rejouable sans risque (remplace la configuration
// précédente plutôt que de l'empiler).
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
    machinesConfigurees: [] as string[],
    personnesConfigurees: [] as string[],
    personnesIntrouvables: [] as string[],
    errors: [] as string[],
  };

  const { data: machines, error: machinesError } = await admin.from("machines").select("id, name").eq("active", true);
  if (machinesError || !machines) {
    return NextResponse.json({ error: "Impossible de lire les postes : " + machinesError?.message }, { status: 500 });
  }
  const machineIdByName = new Map(machines.map((m) => [m.name, m.id]));

  // 1) Règles de binôme + effectif minimum par poste
  for (const [name, config] of Object.entries(MACHINE_CONFIG)) {
    const machineId = machineIdByName.get(name);
    if (!machineId) {
      report.errors.push(`Poste "${name}" introuvable.`);
      continue;
    }

    const { error: pairingError } = await admin.from("pairing_rules").upsert(
      {
        machine_id: machineId,
        team_size: config.teamSize,
        min_autonomous: config.minAutonomous,
        notes: config.notes,
      },
      { onConflict: "machine_id" }
    );
    if (pairingError) {
      report.errors.push(`Règles ${name} : ${pairingError.message}`);
      continue;
    }

    // On repart d'un effectif minimum propre pour ce poste (évite d'empiler
    // les lignes si ce paramétrage est relancé).
    await admin.from("min_staffing").delete().eq("machine_id", machineId);
    for (let day = 0; day < 5; day++) {
      const { error: staffingError } = await admin.from("min_staffing").insert({
        machine_id: machineId,
        day_of_week: day,
        start_time: config.minStaffing.start,
        end_time: config.minStaffing.end,
        min_count: config.minStaffing.count,
      });
      if (staffingError) report.errors.push(`Effectif minimum ${name} (jour ${day}) : ${staffingError.message}`);
    }

    report.machinesConfigurees.push(name);
  }

  // 2) Habilitations + contraintes par personne
  for (const person of PERSON_CONFIG) {
    const { data: byKey } = await admin.from("profiles").select("id").eq("import_key", person.importKey).maybeSingle();
    const { data: byName } = byKey
      ? { data: null }
      : await admin.from("profiles").select("id").ilike("last_name", person.lastName).maybeSingle();
    const profileId = byKey?.id || byName?.id;

    if (!profileId) {
      report.personnesIntrouvables.push(`${person.lastName} (${person.importKey})`);
      continue;
    }

    for (const [name, machineId] of machineIdByName) {
      const level = person.machines.includes(name) ? "autonomous" : "none";
      const { error: compError } = await admin
        .from("competencies")
        .upsert({ profile_id: profileId, machine_id: machineId, level }, { onConflict: "profile_id,machine_id" });
      if (compError) report.errors.push(`Compétence ${person.lastName}/${name} : ${compError.message}`);
    }

    const { error: notesError } = await admin.from("profiles").update({ notes: person.notes }).eq("id", profileId);
    if (notesError) report.errors.push(`Notes ${person.lastName} : ${notesError.message}`);

    report.personnesConfigurees.push(person.lastName);
  }

  await logAction(null, "parametrage_equipe", "profile", null, {
    machines: report.machinesConfigurees.length,
    personnes: report.personnesConfigurees.length,
  });

  return NextResponse.json({ ok: true, report });
}
