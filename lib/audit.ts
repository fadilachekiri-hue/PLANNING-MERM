import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export async function logAction(
  actorId: string | null,
  action: string,
  entity: string,
  entityId: string | null,
  details?: Record<string, unknown>
) {
  const admin = createAdminClient();
  await admin.from("audit_log").insert({
    actor_id: actorId,
    action,
    entity,
    entity_id: entityId,
    details: details || null,
  });
}

export async function notify(
  profileId: string,
  type: string,
  title: string,
  body?: string,
  link?: string
) {
  const admin = createAdminClient();
  await admin.from("notifications").insert({ profile_id: profileId, type, title, body, link });
}
