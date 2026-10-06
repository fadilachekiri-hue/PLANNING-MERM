import { getCurrentProfile, isAdminOrOwner } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { mondayOf, addDaysToIso } from "@/lib/week";
import PostesClient from "./PostesClient";

export default async function PostesPage({ searchParams }: { searchParams: { semaine?: string } }) {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  // On force toujours le lundi de la semaine, même si le paramètre d'URL
  // (lien, favori...) pointe sur un autre jour — évite les semaines décalées.
  const startDate = mondayOf(searchParams.semaine ? new Date(searchParams.semaine + "T00:00:00") : new Date());
  const supabase = createClient();
  const admin = isAdminOrOwner(profile);

  const { data: week } = await supabase.from("weeks").select("*").eq("start_date", startDate).maybeSingle();
  const { data: machines } = await supabase.from("machines").select("*").eq("active", true).order("position");
  const { data: minStaffing } = await supabase.from("min_staffing").select("*");
  const { data: closures } = await supabase
    .from("machine_closures")
    .select("*")
    .gte("date", startDate)
    .lte("date", addDaysToIso(startDate, 6));

  let shifts: any[] = [];
  let members: any[] = [];
  let allShifts: any[] = [];
  if (week) {
    const [{ data: sh }, { data: wm }, { data: allSh }] = await Promise.all([
      supabase.from("shifts").select("*, profiles!shifts_profile_id_fkey(first_name, last_name)").eq("week_id", week.id).eq("shift_type", "work"),
      supabase.from("week_members").select("profile_id, profiles(id, first_name, last_name)").eq("week_id", week.id),
      supabase.from("shifts").select("profile_id, day_of_week").eq("week_id", week.id),
    ]);
    shifts = sh || [];
    members = (wm || []).map((w: any) => w.profiles).filter(Boolean).sort((a: any, b: any) => a.last_name.localeCompare(b.last_name));
    allShifts = allSh || [];
  }

  return (
    <PostesClient
      isAdmin={admin}
      startDate={startDate}
      week={week}
      machines={machines || []}
      shifts={shifts}
      members={members}
      allShifts={allShifts}
      minStaffing={minStaffing || []}
      closures={closures || []}
    />
  );
}
