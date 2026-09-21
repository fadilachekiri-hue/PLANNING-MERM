import { NextResponse } from "next/server";
import { requireAdminOrOwner } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateIdentifiant, authEmailFor } from "@/lib/identifiant";
import { logAction } from "@/lib/audit";
import { randomBytes } from "crypto";

export async function POST(request: Request) {
  const actor = await requireAdminOrOwner();
  if (!actor) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

  const body = await request.json();
  const firstName = String(body.firstName || "").trim();
  const lastName = String(body.lastName || "").trim();
  if (!firstName || !lastName) {
    return NextResponse.json({ error: "Prénom et nom sont obligatoires." }, { status: 400 });
  }

  const admin = createAdminClient();
  const identifiant = await generateIdentifiant(firstName, lastName);
  const authEmail = authEmailFor(identifiant);
  const placeholderPassword = randomBytes(24).toString("base64url");

  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email: authEmail,
    password: placeholderPassword,
    email_confirm: true,
    user_metadata: { identifiant, first_name: firstName, last_name: lastName },
  });

  if (authError || !authUser?.user) {
    return NextResponse.json({ error: "Erreur de création du compte : " + authError?.message }, { status: 500 });
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .insert({
      id: authUser.user.id,
      identifiant,
      auth_email: authEmail,
      contact_email: body.contactEmail || null,
      phone: body.phone || null,
      first_name: firstName,
      last_name: lastName,
      role: "member",
      status: "pending",
      job_title: body.jobTitle || null,
      contracted_hours: body.contractedHours ?? 35,
      usual_days: body.usualDays || null,
      usual_hours: body.usualHours || null,
      shift_preference: body.shiftPreference || "none",
      overtime_ok: !!body.overtimeOk,
      notes: body.notes || null,
    })
    .select()
    .single();

  if (profileError) {
    // Rollback : le compte technique ne doit pas rester orphelin.
    await admin.auth.admin.deleteUser(authUser.user.id);
    return NextResponse.json({ error: "Erreur d'enregistrement : " + profileError.message }, { status: 500 });
  }

  const { data: machines } = await admin.from("machines").select("id").eq("active", true);
  if (machines && machines.length > 0) {
    await admin.from("competencies").insert(machines.map((m) => ({ profile_id: profile.id, machine_id: m.id, level: "none" })));
  }

  await logAction(actor.id, "creation_membre", "profile", profile.id, { identifiant });

  return NextResponse.json({ ok: true, profile });
}
