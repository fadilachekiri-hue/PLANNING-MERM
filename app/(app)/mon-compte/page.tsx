import { getCurrentProfile } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import MonCompteClient from "./MonCompteClient";

export default async function MonComptePage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const supabase = createClient();
  const { data: availabilities } = await supabase.from("availabilities").select("*").eq("profile_id", profile.id).order("day_of_week");

  return <MonCompteClient profile={profile} availabilities={availabilities || []} />;
}
