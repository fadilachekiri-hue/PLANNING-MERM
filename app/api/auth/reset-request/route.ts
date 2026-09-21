import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createAccessToken, resetUrl } from "@/lib/tokens";
import { sendEmail, baseEmailLayout } from "@/lib/email";

export async function POST(request: Request) {
  const { identifiant } = await request.json();
  const normalizedId = String(identifiant || "").trim().toLowerCase();

  // Réponse volontairement identique dans tous les cas, pour ne pas révéler
  // si un identifiant existe ou non.
  const genericResponse = NextResponse.json({
    ok: true,
    message:
      "Si ce compte existe et possède une adresse e-mail enregistrée, un lien de réinitialisation vient de lui être envoyé.",
  });

  if (!normalizedId) return genericResponse;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, contact_email, first_name, status")
    .eq("identifiant", normalizedId)
    .maybeSingle();

  if (!profile || profile.status === "disabled" || !profile.contact_email) {
    return genericResponse;
  }

  const token = await createAccessToken(profile.id, "reset", null);
  await sendEmail({
    to: profile.contact_email,
    subject: "Réinitialisation de votre mot de passe — Planning MERM",
    category: "reset",
    profileId: profile.id,
    html: baseEmailLayout(
      "Réinitialisation de votre mot de passe",
      `<p>Bonjour ${profile.first_name},</p>
       <p>Une demande de réinitialisation de mot de passe a été effectuée pour votre compte Planning MERM.</p>
       <p><a href="${resetUrl(token)}" style="background:#1d4ed8;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block;">Choisir un nouveau mot de passe</a></p>
       <p style="font-size:13px;color:#64748b;">Ce lien est valable 2 heures. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.</p>`
    ),
  });

  return genericResponse;
}
