import { getCurrentProfile, isAdminOrOwner } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import RemplacementsClient from "./RemplacementsClient";

export default async function RemplacementsPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const admin = isAdminOrOwner(profile);
  const supabase = createClient();

  const { data: machines } = await supabase.from("machines").select("*").eq("active", true).order("position");

  let requests: any[] = [];
  if (admin) {
    const { data } = await supabase
      .from("replacement_requests")
      .select("*, machines(name), replacement_candidates(profile_id, response, profiles(first_name, last_name))")
      .order("created_at", { ascending: false })
      .limit(50);
    requests = data || [];
  } else {
    const { data: mine } = await supabase.from("replacement_candidates").select("request_id, response").eq("profile_id", profile.id);
    const ids = (mine || []).map((m) => m.request_id);
    if (ids.length > 0) {
      const { data } = await supabase.from("replacement_requests").select("*, machines(name)").in("id", ids).order("created_at", { ascending: false });
      requests = (data || []).map((r) => ({ ...r, myResponse: mine!.find((m) => m.request_id === r.id)?.response || null }));
    }
  }

  let activeProfiles: any[] = [];
  if (admin) {
    const { data } = await supabase.from("profiles").select("id, first_name, last_name").eq("status", "active").order("last_name");
    activeProfiles = data || [];
  }

  return <RemplacementsClient isAdmin={admin} requests={requests} machines={machines || []} activeProfiles={activeProfiles} />;
}
