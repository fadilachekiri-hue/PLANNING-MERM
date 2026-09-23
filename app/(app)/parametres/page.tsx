import { redirect } from "next/navigation";
import { getCurrentProfile, isAdminOrOwner } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import ParametresClient from "./ParametresClient";

export default async function ParametresPage() {
  const profile = await getCurrentProfile();
  if (!profile || !isAdminOrOwner(profile)) redirect("/tableau-de-bord");

  const supabase = createClient();
  const [{ data: machines }, { data: rules }, { data: minStaffing }, { data: closures }] = await Promise.all([
    supabase.from("machines").select("*").eq("active", true).order("position"),
    supabase.from("pairing_rules").select("*"),
    supabase.from("min_staffing").select("*, machines(name)"),
    supabase.from("machine_closures").select("*, machines(name)").gte("date", new Date().toISOString().slice(0, 10)).order("date"),
  ]);

  return <ParametresClient machines={machines || []} rules={rules || []} minStaffing={minStaffing || []} closures={closures || []} />;
}
