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
  if (week) {
    const { data } = await supabase.from("shifts").select("*, profiles(first_name, last_name)").eq("week_id", week.id).eq("shift_type", "work");
    shifts = data || [];
  }

  return (
    <PostesClient
      isAdmin={admin}
      startDate={startDate}
      week={week}
      machines={machines || []}
      shifts={shifts}
      minStaffing={minStaffing || []}
      closures={closures || []}
    />
  );
}
