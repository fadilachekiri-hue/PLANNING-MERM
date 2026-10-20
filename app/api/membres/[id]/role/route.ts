import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAction } from "@/lib/audit";

// Seule la propriétaire peut créer/retirer une administratrice.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const owner = await requireOwner();
  if (!owner) return NextResponse.json({ error: "Seule la propriétaire peut modifier les droits d'administration." }, { status: 403 });

  const { role } = await request.json();
  if (!["admin", "member"].includes(role)) {
    return NextResponse.json({ error: "Rôle invalide." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: target } = await admin.from("profiles").select("role").eq("id", params.id).single();
  if (target?.role === "owner") {
    return NextResponse.json({ error: "Le rôle propriétaire ne peut pas être modifié." }, { status: 400 });
  }

  const { error } = await admin.from("profiles").update({ role }).eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAction(owner.id, role === "admin" ? "promotion_administratrice" : "retrait_administratrice", "profile", params.id);
  return NextResponse.json({ ok: true });
}
