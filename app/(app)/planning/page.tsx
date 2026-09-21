import { getCurrentProfile, isAdminOrOwner } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { mondayOf } from "@/lib/week";
import PlanningClient from "./PlanningClient";

export default async function PlanningPage({ searchParams }: { searchParams: { semaine?: string } }) {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const startDate = searchParams.semaine || mondayOf(new Date());
  const supabase = createClient();
  const admin = isAdminOrOwner(profile);

  const { data: week } = await supabase.from("weeks").select("*").eq("start_date", startDate).maybeSingle();
  const { data: machines } = await supabase.from("machines").select("*").eq("active", true).order("position");

  let members: any[] = [];
  let shifts: any[] = [];

  if (week) {
    const [{ data: wm }, { data: sh }] = await Promise.all([
      supabase.from("week_members").select("profile_id, profiles(*)").eq("week_id", week.id),
      supabase.from("shifts").select("*").eq("week_id", week.id),
    ]);
    members = (wm || []).map((w: any) => w.profiles).filter(Boolean).sort((a: any, b: any) => a.last_name.localeCompare(b.last_name));
    shifts = sh || [];
  }

  let allActiveProfiles: any[] = [];
  if (admin) {
    const { data } = await supabase.from("profiles").select("*").eq("status", "active").order("last_name");
    allActiveProfiles = data || [];
  }

  return (
    <PlanningClient
      isAdmin={admin}
      startDate={startDate}
      week={week}
      machines={machines || []}
      members={members}
      shifts={shifts}
      allActiveProfiles={allActiveProfiles}
    />
  );
}
