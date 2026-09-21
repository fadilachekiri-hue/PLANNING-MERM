import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAction } from "@/lib/audit";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

  const { response } = await request.json();
  if (!["available", "unavailable"].includes(response)) {
    return NextResponse.json({ error: "Réponse invalide." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("replacement_candidates")
    .update({ response, responded_at: new Date().toISOString() })
    .eq("request_id", params.id)
    .eq("profile_id", profile.id)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || data.length === 0) return NextResponse.json({ error: "Vous n'êtes pas concerné(e) par cette demande." }, { status: 403 });

  await logAction(profile.id, "reponse_remplacement", "replacement_request", params.id, { response });
  return NextResponse.json({ ok: true });
}
