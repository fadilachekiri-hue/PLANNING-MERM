import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

  const supabase = createClient();
  const { error } = await supabase.from("availabilities").delete().eq("id", params.id).eq("profile_id", profile.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
