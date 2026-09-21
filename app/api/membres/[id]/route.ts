import { NextResponse } from "next/server";
import { requireAdminOrOwner } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
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
