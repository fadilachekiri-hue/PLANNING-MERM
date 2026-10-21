import { NextResponse } from "next/server";
import { requireAdminOrOwner } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAction } from "@/lib/audit";
import { mondayOf } from "@/lib/week";
import { generateIdentifiant, authEmailFor } from "@/lib/identifiant";
import { MORNING_SHIFT, EVENING_SHIFT } from "@/lib/types";
import { PLANNING_DECEMBRE_SEMAINES_1_3 } from "@/lib/planning-decembre-semaines-1-3";
import { randomBytes } from "crypto";

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

function dayOfWeekOf(dateIso: string): number {
  const d = new Date(dateIso + "T00:00:00Z");
  const jsDay = d.getUTCDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

// Applique le planning valide des semaines 1 a 3 de decembre 2026 (1er au 21),
// tel que verifie dans le PDF de previsualisation accepte par la cadre le
// 21/10/2026 : nouveaux binomes stables, alternance d'Elodie Charbonnel
// (Unity exclusivement), encadrement de Manon Irles en formation (trinome
// Clinac avec un referent Renou/Rahmani/Fonteneau), toutes les absences de
// decembre appliquees. Cree le profil de Manon Irles si besoin. Rejouable
// sans doublon (upsert sur week_members, update si le creneau existe deja).
export async function POST(_request: Request) {
  try {
    const actor = await requireAdminOrOwner();
    if (!actor) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

    const admin = createAdminClient();
    const report = {
      postesAssignes: 0,
      semainesCreees: 0,
      profilManonCree: false,
      introuvables: [] as string[],
    };

    const [{ data: machines }, { data: profilesBefore }] = await Promise.all([
      admin.from("machines").select("id, name").eq("active", true),
      admin.from("profiles").select("id, first_name, last_name"),
    ]);
    const machineIdByName = new Map((machines || []).map((m) => [m.name, m.id]));

    let profiles = profilesBefore || [];

    // Cree le profil de Manon Irles si elle n'existe pas encore.
    const manonExists = profiles.some((p) => norm(p.last_name || "") === norm("Irles"));
    if (!manonExists) {
      const identifiant = await generateIdentifiant("Manon", "Irles");
      const authEmail = authEmailFor(identifiant);
      const placeholderPassword = randomBytes(24).toString("base64url");

      const { data: authUser, error: authError } = await admin.auth.admin.createUser({
        email: authEmail,
        password: placeholderPassword,
        email_confirm: true,
        user_metadata: { identifiant, first_name: "Manon", last_name: "Irles" },
      });
      if (authError || !authUser?.user) {
        return NextResponse.json({ error: "Création du profil de Manon Irles impossible : " + authError?.message }, { status: 500 });
      }

      const { data: newProfile, error: profileError } = await admin
        .from("profiles")
        .insert({
          id: authUser.user.id,
          identifiant,
          auth_email: authEmail,
          first_name: "Manon",
          last_name: "Irles",
          role: "member",
          status: "active",
          job_title: "MERM (en formation Clinac)",
          contracted_hours: 35,
          usual_days: null,
          usual_hours: null,
          shift_preference: "none",
          overtime_ok: false,
          notes: "En formation sur Clinac — toujours en trinôme avec un référent (Renou, Rahmani ou Fonteneau).",
        })
        .select()
        .single();
      if (profileError || !newProfile) {
        await admin.auth.admin.deleteUser(authUser.user.id);
        return NextResponse.json({ error: "Enregistrement du profil de Manon Irles impossible : " + profileError?.message }, { status: 500 });
      }

      if (machines && machines.length > 0) {
        await admin.from("competencies").insert(
          machines.map((m) => ({
            profile_id: newProfile.id,
            machine_id: m.id,
            level: m.name === "Clinac" ? "training" : "none",
          }))
        );
      }

      await logAction(actor.id, "creation_membre", "profile", newProfile.id, { identifiant, contexte: "formation Clinac, planning décembre" });
      report.profilManonCree = true;
      profiles = [...profiles, { id: newProfile.id, first_name: "Manon", last_name: "Irles" }];
    }

    function findProfileId(lastName: string): string | null {
      const expected = norm(lastName);
      const match = profiles.find((p: any) => norm(p.last_name || "") === expected);
      return match?.id || null;
    }

    // Semaines necessaires.
    const neededWeekStarts = [...new Set(PLANNING_DECEMBRE_SEMAINES_1_3.map((e) => mondayOf(new Date(e.date + "T00:00:00"))))];
    const { data: weeks } = await admin.from("weeks").select("id, start_date").in("start_date", neededWeekStarts);
    const weekIdByStart = new Map((weeks || []).map((w) => [String(w.start_date).slice(0, 10), w.id]));

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
    const toUpdate: { id: string; shift_type: string; start_time: string | null; end_time: string | null; machine_id: string | null }[] = [];
    const weekMemberPairs = new Map<string, { week_id: string; profile_id: string }>();

    for (const e of PLANNING_DECEMBRE_SEMAINES_1_3) {
      const pid = findProfileId(e.lastName);
      const wid = weekIdByStart.get(mondayOf(new Date(e.date + "T00:00:00"))) || null;
      const dayOfWeek = dayOfWeekOf(e.date);
      if (!pid) {
        report.introuvables.push(`${e.lastName} ${e.date} : profil introuvable`);
        continue;
      }
      if (!wid) {
        report.introuvables.push(`${e.lastName} ${e.date} : semaine introuvable`);
        continue;
      }
      let machineId: string | null = null;
      if (e.shiftType === "work") {
        machineId = e.machine ? machineIdByName.get(e.machine) || null : null;
        if (e.machine && !machineId) {
          report.introuvables.push(`${e.lastName} ${e.date} : poste "${e.machine}" introuvable`);
          continue;
        }
      }
      const times = e.shiftType === "work" ? (e.period === "soir" ? EVENING_SHIFT : MORNING_SHIFT) : { start: null, end: null };
      const existing = existingByKey.get(`${wid}_${pid}_${dayOfWeek}`);

      weekMemberPairs.set(`${wid}_${pid}`, { week_id: wid, profile_id: pid });

      if (existing) {
        toUpdate.push({ id: existing.id, shift_type: e.shiftType, start_time: times.start, end_time: times.end, machine_id: machineId });
      } else {
        toInsert.push({
          week_id: wid,
          profile_id: pid,
          day_of_week: dayOfWeek,
          start_time: times.start,
          end_time: times.end,
          shift_type: e.shiftType,
          machine_id: machineId,
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
            .update({ shift_type: u.shift_type, start_time: u.start_time, end_time: u.end_time, machine_id: u.machine_id })
            .eq("id", u.id);
          if (error) updateErrors.push(error.message);
        }
      }
      await Promise.all(Array.from({ length: Math.min(limit, toUpdate.length) }, worker));
      if (updateErrors.length > 0) report.introuvables.push(`${updateErrors.length} mise(s) à jour en échec : ${updateErrors[0]}`);
    }

    await logAction(actor.id, "construction_planning_decembre_valide_s1_3", "week", null, report);
    return NextResponse.json({ ok: true, report });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Erreur inattendue lors de l'application du planning validé." }, { status: 500 });
  }
}
