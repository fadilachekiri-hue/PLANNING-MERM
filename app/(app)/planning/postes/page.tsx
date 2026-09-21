import { getCurrentProfile } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { mondayOf } from "@/lib/week";
import PostesClient from "./PostesClient";

export default async function PostesPage({ searchParams }: { searchParams: { semaine?: string } }) {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const startDate = searchParams.semaine || mondayOf(new Date());
  const supabase = createClient();

  const { data: week } = await supabase.from("weeks").select("*").eq("start_date", startDate).maybeSingle();
  const { data: machines } = await supabase.from("machines").select("*").eq("active", true).order("position");
  const { data: minStaffing } = await supabase.from("min_staffing").select("*");

  let shifts: any[] = [];
  if (week) {
    const { data } = await supabase.from("shifts").select("*, profiles(first_name, last_name)").eq("week_id", week.id).eq("shift_type", "work");
    shifts = data || [];
  }

  return <PostesClient startDate={startDate} week={week} machines={machines || []} shifts={shifts} minStaffing={minStaffing || []} />;
}
