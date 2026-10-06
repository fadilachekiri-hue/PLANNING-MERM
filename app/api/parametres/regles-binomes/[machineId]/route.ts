import { NextResponse } from "next/server";
import { requireAdminOrOwner } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAction } from "@/lib/audit";

export async function PUT(request: Request, { params }: { params: { machineId: string } }) {
  const actor = await requireAdminOrOwner();
  if (!actor) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

  const { minAutonomous, teamSize, allowTrainingWithSupervisor, notes } = await request.json();
  const admin = createAdminClient();

  const { error } = await admin.from("pairing_rules").upsert({
    machine_id: params.machineId,
    min_autonomous: minAutonomous,
    team_size: teamSize,
    allow_training_with_supervisor: allowTrainingWithSupervisor,
    notes: notes || null,
    updated_at: new Date().toISOString(),
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAction(actor.id, "modification_regle_binome", "machine", params.machineId, { minAutonomous, teamSize, allowTrainingWithSupervisor });
  return NextResponse.json({ ok: true });
}
