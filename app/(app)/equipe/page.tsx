import { redirect } from "next/navigation";
import { getCurrentProfile, isAdminOrOwner } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import EquipeClient from "./EquipeClient";

export default async function EquipePage() {
  const profile = await getCurrentProfile();
  if (!profile || !isAdminOrOwner(profile)) redirect("/tableau-de-bord");

  const supabase = createClient();
  const [{ data: membres }, { data: machines }, { data: competences }] = await Promise.all([
    supabase.from("profiles").select("*").order("last_name"),
    supabase.from("machines").select("*").eq("active", true).order("position"),
    supabase.from("competencies").select("*"),
  ]);

  return (
    <EquipeClient
      currentProfileId={profile.id}
      currentRole={profile.role}
      membres={membres || []}
      machines={machines || []}
      competences={competences || []}
    />
  );
}
