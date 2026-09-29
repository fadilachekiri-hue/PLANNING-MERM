import { getCurrentProfile } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import NotificationsClient from "./NotificationsClient";

export default async function NotificationsPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const supabase = createClient();
  const { data } = await supabase.from("notifications").select("*").eq("profile_id", profile.id).order("created_at", { ascending: false }).limit(100);

  return <NotificationsClient notifications={data || []} />;
}
