import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

// Chaque membre ne peut modifier que ses propres préférences (pas ses
// données contractuelles, réservées aux administratrices).
export async function PATCH(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

  const { shiftPreference, overtimeOk } = await request.json();
  const supabase = createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ shift_preference: shiftPreference, overtime_ok: overtimeOk })
    .eq("id", profile.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
