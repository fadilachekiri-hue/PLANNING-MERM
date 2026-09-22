import { NextResponse } from "next/server";
import { requireAdminOrOwner } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateIdentifiant, authEmailFor } from "@/lib/identifiant";
import { logAction } from "@/lib/audit";

const EDITABLE_FIELDS = [
  "contactEmail",
  "phone",
  "jobTitle",
  "contractedHours",
  "usualDays",
  "usualHours",
  "shiftPreference",
  "overtimeOk",
  "notes",
  "firstName",
  "lastName",
] as const;

const FIELD_MAP: Record<string, string> = {
  contactEmail: "contact_email",
  jobTitle: "job_title",
  contractedHours: "contracted_hours",
  usualDays: "usual_days",
  usualHours: "usual_hours",
  shiftPreference: "shift_preference",
  overtimeOk: "overtime_ok",
  firstName: "first_name",
  lastName: "last_name",
};

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const actor = await requireAdminOrOwner();
  if (!actor) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

  const body = await request.json();
  const update: Record<string, unknown> = {};
  for (const key of EDITABLE_FIELDS) {
    if (key in body) update[FIELD_MAP[key] || key] = body[key];
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Rien à mettre à jour." }, { status: 400 });
  }

  const admin = createAdminClient();

  // Le prénom et/ou le nom changent : on régénère l'identifiant de connexion
  // (et l'adresse technique liée) pour qu'il reste cohérent, au lieu de
  // rester bloqué sur sa valeur de création.
  if ("first_name" in update || "last_name" in update) {
    const { data: current, error: currentError } = await admin
      .from("profiles")
      .select("first_name, last_name, identifiant")
      .eq("id", params.id)
      .single();
    if (currentError || !current) {
      return NextResponse.json({ error: currentError?.message || "Profil introuvable." }, { status: 500 });
    }

    const newFirstName = (update.first_name as string | undefined) ?? current.first_name;
    const newLastName = (update.last_name as string | undefined) ?? current.last_name;

    if (newFirstName !== current.first_name || newLastName !== current.last_name) {
      const newIdentifiant = await generateIdentifiant(newFirstName, newLastName, params.id);
      const newAuthEmail = authEmailFor(newIdentifiant);

      const { error: authUpdateError } = await admin.auth.admin.updateUserById(params.id, { email: newAuthEmail, email_confirm: true });
      if (authUpdateError) {
        return NextResponse.json({ error: "Erreur de mise à jour du compte : " + authUpdateError.message }, { status: 500 });
      }

      update.identifiant = newIdentifiant;
      update.auth_email = newAuthEmail;
    }
  }

  const { data, error } = await admin.from("profiles").update(update).eq("id", params.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAction(actor.id, "modification_membre", "profile", params.id, update);
  return NextResponse.json({ ok: true, profile: data });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const actor = await requireAdminOrOwner();
  if (!actor) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  if (params.id === actor.id) {
    return NextResponse.json({ error: "Vous ne pouvez pas supprimer votre propre compte." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: target } = await admin.from("profiles").select("role, identifiant").eq("id", params.id).single();
  if (target?.role === "owner") {
    return NextResponse.json({ error: "Le compte propriétaire ne peut pas être supprimé." }, { status: 400 });
  }

  const { error } = await admin.auth.admin.deleteUser(params.id); // cascade supprime le profil
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAction(actor.id, "suppression_membre", "profile", params.id, { identifiant: target?.identifiant });
  return NextResponse.json({ ok: true });
}
