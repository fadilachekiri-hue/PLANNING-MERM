import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAction } from "@/lib/audit";

// Outil de secours protégé par SETUP_SECRET : place Chauliac en formation
// ("training") sur le Scanner, sans toucher au reste de ses habilitations.
// Ne rétrograde jamais un niveau déjà "autonomous". Rejouable sans risque.
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
  const report = { chauliacTrouvee: false, scannerTrouve: false, niveauApplique: false, niveauDejaSuffisant: false, errors: [] as string[] };

  const { data: chauliac } = await admin.from("profiles").select("id").ilike("last_name", "Chauliac").maybeSingle();
  if (!chauliac) {
    report.errors.push("Profil de Chauliac introuvable (recherche par nom de famille).");
    return NextResponse.json({ ok: true, report });
  }
  report.chauliacTrouvee = true;

  const { data: scanner } = await admin.from("machines").select("id").eq("name", "Scanner").maybeSingle();
  if (!scanner) {
    report.errors.push("Poste Scanner introuvable.");
    return NextResponse.json({ ok: true, report });
  }
  report.scannerTrouve = true;

  const { data: existing } = await admin
    .from("competencies")
    .select("level")
    .eq("profile_id", chauliac.id)
    .eq("machine_id", scanner.id)
    .maybeSingle();

  if (existing?.level === "training" || existing?.level === "autonomous") {
    report.niveauDejaSuffisant = true;
  } else {
    const { error } = await admin
      .from("competencies")
      .upsert({ profile_id: chauliac.id, machine_id: scanner.id, level: "training" }, { onConflict: "profile_id,machine_id" });
    if (error) report.errors.push(`Habilitation : ${error.message}`);
    else report.niveauApplique = true;
  }

  await logAction(null, "formation_chauliac_scanner", "profile", chauliac.id, report);
  return NextResponse.json({ ok: true, report });
}
