import { NextResponse } from "next/server";
import { requireAdminOrOwner } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createAccessToken, activationUrl } from "@/lib/tokens";
import { sendEmail, baseEmailLayout } from "@/lib/email";
import { logAction } from "@/lib/audit";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const actor = await requireAdminOrOwner();
  if (!actor) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, first_name, last_name, identifiant, contact_email, status")
    .eq("id", params.id)
    .single();

  if (!profile) return NextResponse.json({ error: "Membre introuvable." }, { status: 404 });
  if (!profile.contact_email) {
    return NextResponse.json(
      { error: "Aucune adresse e-mail enregistrée pour ce membre. Ajoutez-en une avant d'envoyer une invitation." },
      { status: 400 }
    );
  }
  if (profile.status === "active") {
    return NextResponse.json({ error: "Ce compte est déjà activé." }, { status: 400 });
  }

  const token = await createAccessToken(profile.id, "invite", actor.id);
  const result = await sendEmail({
    to: profile.contact_email,
    subject: "Votre accès à Planning MERM — service de radiothérapie",
    category: "invitation",
    profileId: profile.id,
    html: baseEmailLayout(
      "Bienvenue sur Planning MERM",
      `<p>Bonjour ${profile.first_name},</p>
       <p>${actor.first_name} ${actor.last_name} vous donne accès à l'application de planning du service de radiothérapie.</p>
       <p><a href="${activationUrl(token)}" style="background:#1d4ed8;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block;">Activer mon compte</a></p>
       <p>Sur cette page, vous choisirez votre mot de passe. Votre identifiant de connexion (<strong>${profile.identifiant}</strong>) vous sera rappelé — conservez-le, il vous servira à chaque connexion.</p>
       <p style="font-size:13px;color:#64748b;">Ce lien est personnel et valable 7 jours.</p>`
    ),
  });

  await logAction(actor.id, "envoi_invitation", "profile", profile.id, { ok: result.ok });

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: "L'e-mail n'a pas pu être envoyé : " + result.error,
        // Le lien reste utilisable même si l'e-mail échoue : la personne
        // qui invite peut le copier et le transmettre par un autre moyen.
        link: activationUrl(token),
      },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, sentTo: profile.contact_email });
}
