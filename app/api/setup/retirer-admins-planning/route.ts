import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAction } from "@/lib/audit";

// Outil de secours protégé par SETUP_SECRET : retire la propriétaire et les
// admins (role "owner"/"admin") de tous les plannings — membres de semaine et
// créneaux déjà créés — où ils auraient été ajoutés par erreur (l'ancienne
// création de semaine pré-incluait tous les profils actifs sans distinction
// de rôle). Rejouable sans risque.
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
  const { data: nonMerm, error } = await admin.from("profiles").select("id, first_name, last_name, role").in("role", ["owner", "admin"]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const report = {
    profils: (nonMerm || []).map((p) => `${p.first_name} ${p.last_name} (${p.role})`),
    membresSupprimes: 0,
    creneauxSupprimes: 0,
    errors: [] as string[],
  };

  const ids = (nonMerm || []).map((p) => p.id);
  if (ids.length > 0) {
    const { error: shiftsError, count: shiftsCount } = await admin
      .from("shifts")
      .delete({ count: "exact" })
      .in("profile_id", ids);
    if (shiftsError) report.errors.push(`Créneaux : ${shiftsError.message}`);
    else report.creneauxSupprimes = shiftsCount || 0;

    const { error: membersError, count: membersCount } = await admin
      .from("week_members")
      .delete({ count: "exact" })
      .in("profile_id", ids);
    if (membersError) report.errors.push(`Membres de semaine : ${membersError.message}`);
    else report.membresSupprimes = membersCount || 0;
  }

  await logAction(null, "retrait_admins_planning", "profile", null, {
    profils: report.profils,
    membresSupprimes: report.membresSupprimes,
    creneauxSupprimes: report.creneauxSupprimes,
  });

  return NextResponse.json({ ok: true, report });
}
