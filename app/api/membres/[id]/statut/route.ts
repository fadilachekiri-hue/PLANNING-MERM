import { NextResponse } from "next/server";
import { requireAdminOrOwner } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAction } from "@/lib/audit";

// Active ou désactive réellement l'accès (pas seulement visuel) :
// - status en base bloque une nouvelle connexion (vérifié dans /api/auth/login)
// - ban_duration côté Supabase Auth coupe aussi une session déjà ouverte
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const actor = await requireAdminOrOwner();
  if (!actor) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  if (params.id === actor.id) {
    return NextResponse.json({ error: "Vous ne pouvez pas désactiver votre propre compte." }, { status: 400 });
  }

  const { disabled } = await request.json();
  const admin = createAdminClient();

  const { data: target } = await admin.from("profiles").select("role, status").eq("id", params.id).single();
  if (target?.role === "owner") {
    return NextResponse.json({ error: "Le compte propriétaire ne peut pas être désactivé." }, { status: 400 });
  }

  const newStatus = disabled ? "disabled" : target?.status === "pending" ? "pending" : "active";

  await admin.from("profiles").update({ status: newStatus }).eq("id", params.id);
  await admin.auth.admin.updateUserById(params.id, { ban_duration: disabled ? "876000h" : "none" });

  await logAction(actor.id, disabled ? "desactivation_membre" : "reactivation_membre", "profile", params.id);
  return NextResponse.json({ ok: true, status: newStatus });
}
