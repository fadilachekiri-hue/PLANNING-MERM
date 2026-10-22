import { NextResponse } from "next/server";
import { requireAdminOrOwner } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { mondayOf } from "@/lib/week";
import { computeWorkedHours } from "@/lib/hours";
import { proposePairs, computePairContinuity, type Candidate } from "@/lib/pairing";
import { isExcludedFromPlanning, isHardUnavailable, conflictingWeekMachine } from "@/lib/team-rules";

function dayOfWeekIndex(iso: string): number {
  const jsDay = new Date(iso + "T00:00:00").getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}
function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart < bEnd && bStart < aEnd;
}

export async function POST(request: Request) {
  const actor = await requireAdminOrOwner();
  if (!actor) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

  const { day, startTime, endTime, machineId } = await request.json();
  if (!day || !startTime || !endTime || !machineId) {
    return NextResponse.json({ error: "Jour, horaires et poste sont requis." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: machine } = await admin.from("machines").select("id, name").eq("id", machineId).maybeSingle();
  const machineName = machine?.name || "";

  const { data: rule } = await admin.from("pairing_rules").select("*").eq("machine_id", machineId).maybeSingle();
  const teamSize = rule?.team_size ?? 2;
  const minAutonomous = rule?.min_autonomous ?? 1;
  const allowTraining = rule?.allow_training_with_supervisor ?? false;

  const { data: competencies } = await admin
    .from("competencies")
    .select("profile_id, level, profiles!inner(id, first_name, last_name, status, role, shift_preference, overtime_ok, contracted_hours)")
    .eq("machine_id", machineId)
    .in("level", ["training", "autonomous"]);

  // Seuls les MERM (role "member") sont proposables en binôme — jamais la
  // propriétaire ou les admins, même si une compétence leur a été attribuée par erreur.
  const eligible = (competencies || []).filter(
    (c: any) => c.profiles.status === "active" && c.profiles.role === "member" && !isExcludedFromPlanning(c.profiles.last_name, c.profiles.first_name)
  );

  const dow = dayOfWeekIndex(day);
  const monday = mondayOf(new Date(day + "T00:00:00"));
  const [sh, eh] = [startTime, endTime].map((t: string) => Number(t.split(":")[0]) + Number(t.split(":")[1]) / 60);
  const slotHours = Math.max(0, eh - sh);
  const slotIsMorning = sh < 13;
  const period: "matin" | "soir" = slotIsMorning ? "matin" : "soir";

  const { data: week } = await admin.from("weeks").select("id").eq("start_date", monday).maybeSingle();

  const { data: approvedLeaves } = await admin
    .from("leave_requests")
    .select("profile_id")
    .eq("status", "approved")
    .lte("date_start", day)
    .gte("date_end", day);
  const onLeave = new Set((approvedLeaves || []).map((l) => l.profile_id));

  // Poste à éviter la même semaine (ex. Versa HD / Clinac) : on a besoin de son id.
  const otherMachineName = conflictingWeekMachine(machineName);
  let otherMachineId: string | null = null;
  const unityMachine = await admin.from("machines").select("id, name").ilike("name", "Unity").maybeSingle();
  const unityMachineId = unityMachine.data?.id || null;
  if (otherMachineName) {
    const { data: om } = await admin.from("machines").select("id").ilike("name", otherMachineName).maybeSingle();
    otherMachineId = om?.id || null;
  }

  // Continuité : favoriser les binômes déjà formés la/les semaine(s)
  // précédente(s) sur ce poste (consigne de la cadre), plutôt que de les
  // dissoudre — dans la limite de ce que permettent les disponibilités.
  const pairContinuity = await computePairContinuity(admin, machineId, monday);

  const candidates: Candidate[] = [];
  for (const c of eligible) {
    const profile: any = c.profiles;
    if (onLeave.has(profile.id)) continue;
    if (isHardUnavailable(profile.last_name, dow, period)) continue;

    let alreadyWorkedHours = 0;
    let conflictingMachineThisWeek = false;
    let unityNotDoneThisWeek = true;
    if (week) {
      const { data: shifts } = await admin.from("shifts").select("*").eq("week_id", week.id).eq("profile_id", profile.id);
      const dayShifts = (shifts || []).filter((s) => s.day_of_week === dow);
      const hasBlocking = dayShifts.some((s) => ["conge", "rtt", "absence", "repos", "tp", "rr", "fo"].includes(s.shift_type));
      const hasConflict = dayShifts.some((s) => s.shift_type === "work" && s.start_time && s.end_time && overlaps(startTime, endTime, s.start_time, s.end_time));
      if (hasBlocking || hasConflict) continue;
      alreadyWorkedHours = computeWorkedHours(shifts || []);
      if (otherMachineId) {
        conflictingMachineThisWeek = (shifts || []).some((s) => s.machine_id === otherMachineId);
      }
      if (unityMachineId) {
        unityNotDoneThisWeek = !(shifts || []).some((s) => s.machine_id === unityMachineId && s.shift_type === "work");
      }
    }

    candidates.push({
      id: profile.id,
      name: `${profile.first_name} ${profile.last_name}`,
      lastName: profile.last_name,
      level: c.level,
      shiftPreference: profile.shift_preference,
      overtimeOk: profile.overtime_ok,
      contractedHours: profile.contracted_hours,
      alreadyWorkedHours,
      conflictingMachineThisWeek,
      unityNotDoneThisWeek,
    });
  }

  const result = proposePairs({
    candidates,
    teamSize,
    minAutonomous,
    allowTrainingWithSupervisor: allowTraining,
    slotHours,
    slotIsMorning,
    machineName,
    pairContinuity,
  });

  return NextResponse.json({ ok: true, ...result, rule: { teamSize, minAutonomous, allowTraining } });
}
