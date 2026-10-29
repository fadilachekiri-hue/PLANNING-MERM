import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { computeWorkedHours } from "@/lib/hours";
import { proposePairs, computePairContinuity, type Candidate, type Combo } from "@/lib/pairing";
import { isExcludedFromPlanning, isHardUnavailable } from "@/lib/team-rules";

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart < bEnd && bStart < aEnd;
}

export type ReplacementResult = {
  machineName: string;
  period: "matin" | "soir";
  remainingTeammates: { id: string; name: string }[];
  combos: Combo[];
  diagnostic: string | null;
};

/**
 * Calcule des propositions de remplacement pour UN créneau déjà occupé
 * (machine/jour/semaine) dont une personne vient d'être retirée (absence
 * approuvée). Réutilise exactement les mêmes règles que /api/binomes/proposer
 * (compétences, dispo, heures, consignes de la cadre, rotation des binômes),
 * mais conserve les personnes déjà présentes sur ce créneau au lieu de
 * reconstruire toute l'équipe depuis zéro.
 */
export async function findReplacementProposals(
  admin: SupabaseClient,
  params: {
    weekId: string;
    monday: string;
    dayOfWeek: number;
    machineId: string;
    startTime: string;
    endTime: string;
    excludeProfileId: string;
    dateIso: string;
  }
): Promise<ReplacementResult> {
  const { weekId, monday, dayOfWeek, machineId, startTime, endTime, excludeProfileId, dateIso } = params;

  const { data: machine } = await admin.from("machines").select("id, name").eq("id", machineId).maybeSingle();
  const machineName = machine?.name || "";

  const { data: rule } = await admin.from("pairing_rules").select("*").eq("machine_id", machineId).maybeSingle();
  const teamSize = rule?.team_size ?? 2;
  const minAutonomous = rule?.min_autonomous ?? 1;
  const allowTraining = rule?.allow_training_with_supervisor ?? false;

  const [sh] = [startTime].map((t: string) => Number(t.split(":")[0]) + Number(t.split(":")[1]) / 60);
  const [eh] = [endTime].map((t: string) => Number(t.split(":")[0]) + Number(t.split(":")[1]) / 60);
  const slotHours = Math.max(0, eh - sh);
  const slotIsMorning = sh < 13;
  const period: "matin" | "soir" = slotIsMorning ? "matin" : "soir";

  // Le reste de l'équipe déjà présente sur ce créneau (hors la personne absente).
  const { data: sameSlot } = await admin
    .from("shifts")
    .select("profile_id, profiles!shifts_profile_id_fkey(id, first_name, last_name)")
    .eq("week_id", weekId)
    .eq("day_of_week", dayOfWeek)
    .eq("machine_id", machineId)
    .eq("shift_type", "work")
    .neq("profile_id", excludeProfileId);

  const remainingIds = new Set((sameSlot || []).map((s: any) => s.profile_id));
  const remainingTeammates = (sameSlot || []).map((s: any) => ({
    id: s.profile_id,
    name: `${s.profiles?.first_name || ""} ${s.profiles?.last_name || ""}`.trim(),
  }));

  const { data: competencies } = await admin
    .from("competencies")
    .select("profile_id, level, profiles!inner(id, first_name, last_name, status, role, shift_preference, overtime_ok, contracted_hours)")
    .eq("machine_id", machineId)
    .in("level", ["training", "autonomous"]);

  const { data: approvedLeaves } = await admin
    .from("leave_requests")
    .select("profile_id")
    .eq("status", "approved")
    .lte("date_start", dateIso)
    .gte("date_end", dateIso);
  const onLeave = new Set((approvedLeaves || []).map((l) => l.profile_id));

  const pairContinuity = await computePairContinuity(admin, machineId, monday);

  const candidates: Candidate[] = [];
  const mustInclude: Candidate[] = [];
  for (const c of competencies || []) {
    const profile: any = c.profiles;
    if (profile.id === excludeProfileId) continue;
    if (profile.status !== "active" || profile.role !== "member") continue;
    if (isExcludedFromPlanning(profile.last_name, profile.first_name)) continue;

    const { data: dayShifts } = await admin.from("shifts").select("*").eq("week_id", weekId).eq("profile_id", profile.id).eq("day_of_week", dayOfWeek);
    const hasBlocking = (dayShifts || []).some((s) => ["conge", "rtt", "absence", "repos", "tp", "rr", "fo"].includes(s.shift_type));
    const isThisSlot = remainingIds.has(profile.id);

    const candidate: Candidate = {
      id: profile.id,
      name: `${profile.first_name} ${profile.last_name}`,
      lastName: profile.last_name,
      level: c.level,
      shiftPreference: profile.shift_preference,
      overtimeOk: profile.overtime_ok,
      contractedHours: profile.contracted_hours,
      alreadyWorkedHours: computeWorkedHours(dayShifts || []),
    };

    if (isThisSlot) {
      mustInclude.push(candidate);
      continue;
    }

    if (onLeave.has(profile.id)) continue;
    if (isHardUnavailable(profile.last_name, dayOfWeek, period)) continue;
    const hasConflict = (dayShifts || []).some(
      (s) => s.shift_type === "work" && s.start_time && s.end_time && overlaps(startTime, endTime, s.start_time, s.end_time)
    );
    if (hasBlocking || hasConflict) continue;

    candidates.push(candidate);
  }

  const openSeats = Math.max(teamSize - mustInclude.length, 1);
  const { combos, diagnostic } = proposePairs({
    candidates,
    teamSize,
    minAutonomous,
    allowTrainingWithSupervisor: allowTraining,
    slotHours,
    slotIsMorning,
    machineName,
    pairContinuity,
    mustInclude,
    openSeats,
  });

  return { machineName, period, remainingTeammates, combos, diagnostic };
}
