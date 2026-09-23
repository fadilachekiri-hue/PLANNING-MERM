import { NextResponse } from "next/server";
import { requireAdminOrOwner } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { mondayOf } from "@/lib/week";
import { computeWorkedHours } from "@/lib/hours";
import { proposePairs, type Candidate } from "@/lib/pairing";

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
  const eligible = (competencies || []).filter((c: any) => c.profiles.status === "active" && c.profiles.role === "member");

  const monday = mondayOf(new Date(day + "T00:00:00"));
  const { data: week } = await admin.from("weeks").select("id").eq("start_date", monday).maybeSingle();

  const { data: approvedLeaves } = await admin
    .from("leave_requests")
    .select("profile_id")
    .eq("status", "approved")
    .lte("date_start", day)
    .gte("date_end", day);
  const onLeave = new Set((approvedLeaves || []).map((l) => l.profile_id));

  const candidates: Candidate[] = [];
  for (const c of eligible) {
    const profile: any = c.profiles;
    if (onLeave.has(profile.id)) continue;

    let alreadyWorkedHours = 0;
    if (week) {
      const { data: shifts } = await admin.from("shifts").select("*").eq("week_id", week.id).eq("profile_id", profile.id);
      const dow = dayOfWeekIndex(day);
      const dayShifts = (shifts || []).filter((s) => s.day_of_week === dow);
      const hasBlocking = dayShifts.some((s) => ["conge", "rtt", "absence", "repos"].includes(s.shift_type));
      const hasConflict = dayShifts.some((s) => s.shift_type === "work" && s.start_time && s.end_time && overlaps(startTime, endTime, s.start_time, s.end_time));
      if (hasBlocking || hasConflict) continue;
      alreadyWorkedHours = computeWorkedHours(shifts || []);
    }

    candidates.push({
      id: profile.id,
      name: `${profile.first_name} ${profile.last_name}`,
      level: c.level,
      shiftPreference: profile.shift_preference,
      overtimeOk: profile.overtime_ok,
      contractedHours: profile.contracted_hours,
      alreadyWorkedHours,
    });
  }

  const [sh, eh] = [startTime, endTime].map((t: string) => Number(t.split(":")[0]) + Number(t.split(":")[1]) / 60);
  const slotHours = Math.max(0, eh - sh);
  const slotIsMorning = sh < 13;

  const result = proposePairs({ candidates, teamSize, minAutonomous, allowTrainingWithSupervisor: allowTraining, slotHours, slotIsMorning });

  return NextResponse.json({ ok: true, ...result, rule: { teamSize, minAutonomous, allowTraining } });
}
