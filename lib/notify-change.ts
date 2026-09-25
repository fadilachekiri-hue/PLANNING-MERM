import "server-only";
import { notify } from "@/lib/audit";
import { sendEmail, baseEmailLayout } from "@/lib/email";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Prévient une seule personne d'un changement sur SON planning, uniquement
 * si la semaine est déjà publiée (on ne dérange personne sur un brouillon). */
export async function maybeNotifyChange(admin: SupabaseClient, weekId: string, profileId: string, type: string, message: string) {
  const { data: week } = await admin.from("weeks").select("status, start_date").eq("id", weekId).single();
  if (!week || week.status !== "published") return;

  const { data: profile } = await admin.from("profiles").select("first_name, contact_email").eq("id", profileId).single();
  if (!profile) return;

  await notify(profileId, type, "Modification de votre planning", message, `/planning?semaine=${week.start_date}`);
  if (profile.contact_email) {
    await sendEmail({
      to: profile.contact_email,
      subject: "Modification de votre planning — Planning MERM",
      category: type,
      profileId,
      html: baseEmailLayout("Votre planning a changé", `<p>Bonjour ${profile.first_name},</p><p>${message}</p>`),
    });
  }
}
