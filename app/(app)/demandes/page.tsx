import { getCurrentProfile, isAdminOrOwner } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import DemandesClient from "./DemandesClient";

export default async function DemandesPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const admin = isAdminOrOwner(profile);
  const supabase = createClient();

  const query = admin
    ? supabase.from("leave_requests").select("*, profiles(first_name, last_name)").order("created_at", { ascending: false })
    : supabase.from("leave_requests").select("*").eq("profile_id", profile.id).order("created_at", { ascending: false });

  const { data: requests } = await query;

  return <DemandesClient isAdmin={admin} requests={requests || []} />;
}
