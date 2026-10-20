import "server-only";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";

type SendArgs = {
  to: string;
  subject: string;
  html: string;
  category: string; // "invitation" | "reset" | "planning_publie" | ...
  profileId?: string;
};

export type SendResult = { ok: true } | { ok: false; error: string };

/**
 * Envoie un e-mail via Resend et consigne HONNÊTEMENT le résultat dans
 * email_log (jamais "envoyé" si le service d'envoi n'a pas confirmé).
 * Si RESEND_API_KEY n'est pas configurée, l'échec est journalisé clairement
 * au lieu de faire semblant d'avoir envoyé le message.
 */
export async function sendEmail({ to, subject, html, category, profileId }: SendArgs): Promise<SendResult> {
  const admin = createAdminClient();
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    await admin.from("email_log").insert({
      to_email: to,
      subject,
      category,
      status: "failed",
      error: "RESEND_API_KEY absente : le service d'envoi d'e-mails n'est pas configuré.",
      profile_id: profileId,
    });
    return { ok: false, error: "Service d'envoi d'e-mails non configuré (RESEND_API_KEY manquante)." };
  }

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || "Planning MERM <onboarding@resend.dev>",
      to,
      subject,
      html,
    });

    if (error) {
      await admin.from("email_log").insert({
        to_email: to,
        subject,
        category,
        status: "failed",
        error: error.message,
        profile_id: profileId,
      });
      return { ok: false, error: error.message };
    }

    await admin.from("email_log").insert({
      to_email: to,
      subject,
      category,
      status: "sent",
      profile_id: profileId,
    });
    return { ok: true };
  } catch (err: any) {
    const message = err?.message || "Erreur inconnue lors de l'envoi.";
    await admin.from("email_log").insert({
      to_email: to,
      subject,
      category,
      status: "failed",
      error: message,
      profile_id: profileId,
    });
    return { ok: false, error: message };
  }
}

export function baseEmailLayout(title: string, bodyHtml: string): string {
  return `
  <div style="font-family: Arial, Helvetica, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color:#0f172a;">
    <h1 style="font-size: 20px; color:#1d4ed8; margin-bottom: 4px;">Planning MERM</h1>
    <p style="font-size: 13px; color:#64748b; margin-top:0;">Service de radiothérapie — Hôpital Henri-Mondor</p>
    <h2 style="font-size: 17px; margin-top: 24px;">${title}</h2>
    ${bodyHtml}
    <p style="font-size: 12px; color:#94a3b8; margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 12px;">
      Cet e-mail est envoyé automatiquement par l'application Planning MERM.
    </p>
  </div>`;
}
