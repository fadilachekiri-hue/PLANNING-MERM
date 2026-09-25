import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAction } from "@/lib/audit";

// Outil de secours protégé par SETUP_SECRET : crée le poste "GQ" (travail
// qualité) s'il n'existe pas encore et habilite Gloria Fonteneau dessus.
// Ne touche pas à la contrainte shift_type (TP/RR) — ça reste en SQL, voir
// supabase/migration-006-gq-tp-rr.sql. Rejouable sans doublon.
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
    posteDejaExistant: false,
    posteCree: false,
    gloriaTrouvee: false,
    habiliteeSurGQ: false,
    errors: [] as string[],
  };

  let { data: machine } = await admin.from("machines").select("id").eq("name", "GQ").maybeSingle();
  if (machine) {
    report.posteDejaExistant = true;
  } else {
    const { data: existing } = await admin.from("machines").select("position").order("position", { ascending: false }).limit(1).maybeSingle();
    const nextPosition = (existing?.position || 0) + 1;
    const { data: created, error } = await admin
      .from("machines")
      .insert({ name: "GQ", color_hex: "#7c3aed", position: nextPosition, active: true })
      .select("id")
      .single();
    if (error || !created) {
      report.errors.push(`Création du poste GQ : ${error?.message}`);
      return NextResponse.json({ ok: true, report });
    }
    machine = created;
    report.posteCree = true;
  }

  const { data: gloria } = await admin.from("profiles").select("id").ilike("last_name", "Fonteneau").maybeSingle();
  if (!gloria) {
    report.errors.push("Profil de Gloria Fonteneau introuvable (recherche par nom de famille).");
    return NextResponse.json({ ok: true, report });
  }
  report.gloriaTrouvee = true;

  const { error: compError } = await admin
    .from("competencies")
    .upsert({ profile_id: gloria.id, machine_id: machine.id, level: "autonomous" }, { onConflict: "profile_id,machine_id" });
  if (compError) report.errors.push(`Habilitation : ${compError.message}`);
  else report.habiliteeSurGQ = true;

  await logAction(null, "ajout_poste_gq", "machine", machine.id, report);

  return NextResponse.json({ ok: true, report });
}
