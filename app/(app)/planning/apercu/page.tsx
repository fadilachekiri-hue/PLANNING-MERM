import { getCurrentProfile, isAdminOrOwner } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { mondayOf, addDaysToIso } from "@/lib/week";
import { isExcludedFromPlanning } from "@/lib/team-rules";
import ApercuClient from "./ApercuClient";

export default async function ApercuPage({ searchParams }: { searchParams: { semaine?: string } }) {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const admin = isAdminOrOwner(profile);

  const startDate = mondayOf(searchParams.semaine ? new Date(searchParams.semaine + "T00:00:00") : new Date());
  const supabase = createClient();
  const endDate = addDaysToIso(startDate, 4);

  const { data: week } = await supabase.from("weeks").select("*").eq("start_date", startDate).maybeSingle();
  const { data: machines } = await supabase.from("machines").select("*").eq("active", true).order("position");
  const { data: closures } = await supabase
    .from("machine_closures")
    .select("*")
    .gte("date", startDate)
    .lte("date", endDate);

  let workShifts: any[] = [];
  let leaveShifts: any[] = [];
  let merms: any[] = [];
  if (week) {
    const [{ data: ws }, { data: ls }, { data: wm }] = await Promise.all([
      supabase
        .from("shifts")
        .select("*, profiles!shifts_profile_id_fkey(first_name, last_name, phone)")
        .eq("week_id", week.id)
        .eq("shift_type", "work"),
      supabase
        .from("shifts")
        .select("*, profiles!shifts_profile_id_fkey(first_name, last_name)")
        .eq("week_id", week.id)
        .neq("shift_type", "work"),
      supabase.from("week_members").select("profiles(id, first_name, last_name, job_title)").eq("week_id", week.id),
    ]);
    workShifts = (ws || []).filter((s: any) => !isExcludedFromPlanning(s.profiles?.last_name || "", s.profiles?.first_name || ""));
    leaveShifts = (ls || []).filter((s: any) => !isExcludedFromPlanning(s.profiles?.last_name || "", s.profiles?.first_name || ""));
    merms = (wm || [])
      .map((w: any) => w.profiles)
      .filter((m: any) => m && (!m.job_title || m.job_title.trim().toUpperCase() === "MERM"))
      .filter((m: any) => !isExcludedFromPlanning(m.last_name || "", m.first_name || ""))
      .sort((a: any, b: any) => a.last_name.localeCompare(b.last_name));
  }

  return (
    <ApercuClient
      isAdmin={admin}
      startDate={startDate}
      week={week}
      machines={machines || []}
      workShifts={workShifts}
      leaveShifts={leaveShifts}
      closures={closures || []}
      merms={merms}
    />
  );
}
