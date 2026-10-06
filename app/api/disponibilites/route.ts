import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

  const { dayOfWeek, startTime, endTime, kind, note } = await request.json();
  if (dayOfWeek === undefined || !kind) return NextResponse.json({ error: "Champs manquants." }, { status: 400 });

  const supabase = createClient();
  const { data, error } = await supabase
    .from("availabilities")
    .insert({ profile_id: profile.id, day_of_week: dayOfWeek, start_time: startTime || null, end_time: endTime || null, kind, note: note || null })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, availability: data });
}
