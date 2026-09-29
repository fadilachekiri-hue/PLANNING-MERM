import { redirect } from "next/navigation";
import { getCurrentProfile, isAdminOrOwner } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { mondayOf } from "@/lib/week";
import BinomesClient from "./BinomesClient";

export default async function BinomesPage({ searchParams }: { searchParams: { semaine?: string } }) {
  const profile = await getCurrentProfile();
  if (!profile || !isAdminOrOwner(profile)) redirect("/tableau-de-bord");

  const supabase = createClient();
  const startDate = searchParams.semaine || mondayOf(new Date());

  const { data: machines } = await supabase.from("machines").select("*").eq("active", true).order("position");
  const { data: week } = await supabase.from("weeks").select("id").eq("start_date", startDate).maybeSingle();

  let paired: any[] = [];
  if (week) {
    const { data } = await supabase
      .from("shifts")
      .select("*, profiles(first_name, last_name), machines(name, color_hex)")
      .eq("week_id", week.id)
      .not("pair_id", "is", null)
      .order("pair_id");
    paired = data || [];
  }

  return <BinomesClient machines={machines || []} startDate={startDate} paired={paired} />;
}
