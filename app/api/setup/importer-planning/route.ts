import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateIdentifiant, authEmailFor } from "@/lib/identifiant";
import { logAction } from "@/lib/audit";
import { randomBytes } from "crypto";
import { IMPORT_EMPLOYEES, IMPORT_WEEKS, IMPORT_SHIFTS } from "@/lib/import-planning-2026";

// Import initial (septembre à décembre 2026) depuis le fichier Excel fourni par la cadre.
// Protégé par SETUP_SECRET, à usage unique — mais rejouable sans risque de
// doublon : les profils et semaines déjà présents sont réutilisés, les
// créneaux déjà importés (même profil/semaine/jour) sont ignorés.
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
  const report = { profilesCreated: [] as string[], profilesReused: [] as string[], weeksCreated: 0, shiftsCreated: 0, shiftsSkipped: 0, errors: [] as string[] };

  // 1) Profils (un par nom de famille, "MERM" comme prénom provisoire à compléter)
  const profileIdByLastName = new Map<string, string>();
  for (const lastName of IMPORT_EMPLOYEES) {
    const { data: existing } = await admin.from("profiles").select("id").ilike("last_name", lastName).maybeSingle();
    if (existing) {
      profileIdByLastName.set(lastName, existing.id);
      report.profilesReused.push(lastName);
      continue;
    }

    const firstName = "MERM";
    const identifiant = await generateIdentifiant(firstName, lastName);
    const authEmail = authEmailFor(identifiant);
    const placeholderPassword = randomBytes(24).toString("base64url");

    const { data: authUser, error: authError } = await admin.auth.admin.createUser({
      email: authEmail,
      password: placeholderPassword,
      email_confirm: true,
      user_metadata: { identifiant, first_name: firstName, last_name: lastName },
    });
    if (authError || !authUser?.user) {
      report.errors.push(`Profil ${lastName} : ${authError?.message}`);
      continue;
    }

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .insert({
        id: authUser.user.id,
        identifiant,
        auth_email: authEmail,
        first_name: firstName,
        last_name: lastName,
        role: "member",
        status: "pending",
        job_title: "MERM",
        contracted_hours: 35,
      })
      .select()
      .single();

    if (profileError || !profile) {
      await admin.auth.admin.deleteUser(authUser.user.id);
      report.errors.push(`Profil ${lastName} : ${profileError?.message}`);
      continue;
    }

    const { data: machines } = await admin.from("machines").select("id").eq("active", true);
    if (machines && machines.length > 0) {
      await admin.from("competencies").insert(machines.map((m) => ({ profile_id: profile.id, machine_id: m.id, level: "none" })));
    }

    profileIdByLastName.set(lastName, profile.id);
    report.profilesCreated.push(lastName);
  }

  // 2) Semaines
  const weekIdByStart = new Map<string, string>();
  for (const startDate of IMPORT_WEEKS) {
    const { data: existingWeek } = await admin.from("weeks").select("id").eq("start_date", startDate).maybeSingle();
    if (existingWeek) {
      weekIdByStart.set(startDate, existingWeek.id);
      continue;
    }
    const { data: week, error } = await admin.from("weeks").insert({ start_date: startDate, status: "draft" }).select().single();
    if (error || !week) {
      report.errors.push(`Semaine ${startDate} : ${error?.message}`);
      continue;
    }
    weekIdByStart.set(startDate, week.id);
    report.weeksCreated++;
  }

  // 3) Appartenance à la semaine (pour apparaître dans le planning de cette semaine)
  const memberships = new Set<string>(); // `${weekId}:${profileId}`
  for (const shift of IMPORT_SHIFTS) {
    const profileId = profileIdByLastName.get(shift.lastName);
    const weekId = weekIdByStart.get(shift.weekStart);
    if (!profileId || !weekId) continue;
    const key = `${weekId}:${profileId}`;
    if (memberships.has(key)) continue;
    memberships.add(key);
    await admin.from("week_members").upsert({ week_id: weekId, profile_id: profileId }, { onConflict: "week_id,profile_id" });
  }

  // 4) Créneaux
  for (const shift of IMPORT_SHIFTS) {
    const profileId = profileIdByLastName.get(shift.lastName);
    const weekId = weekIdByStart.get(shift.weekStart);
    if (!profileId || !weekId) {
      report.errors.push(`Créneau ignoré (${shift.lastName}, ${shift.weekStart}, jour ${shift.dayOfWeek}) : profil ou semaine introuvable.`);
      continue;
    }

    const { data: already } = await admin
      .from("shifts")
      .select("id")
      .eq("week_id", weekId)
      .eq("profile_id", profileId)
      .eq("day_of_week", shift.dayOfWeek)
      .maybeSingle();
    if (already) {
      report.shiftsSkipped++;
      continue;
    }

    const { error } = await admin.from("shifts").insert({
      week_id: weekId,
      profile_id: profileId,
      day_of_week: shift.dayOfWeek,
      start_time: shift.startTime,
      end_time: shift.endTime,
      shift_type: shift.shiftType,
      machine_id: null,
      notes: shift.notes,
    });
    if (error) {
      report.errors.push(`Créneau ${shift.lastName} ${shift.weekStart}/${shift.dayOfWeek} : ${error.message}`);
      continue;
    }
    report.shiftsCreated++;
  }

  await logAction(null, "import_planning_initial", "week", null, {
    profilesCreated: report.profilesCreated.length,
    shiftsCreated: report.shiftsCreated,
  });

  return NextResponse.json({ ok: true, report });
}
