import "server-only";
import { randomBytes } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

const INVITE_TTL_HOURS = 7 * 24; // 7 jours
const RESET_TTL_HOURS = 2;

export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function createAccessToken(
  profileId: string,
  type: "invite" | "reset",
  createdBy: string | null
): Promise<string> {
  const admin = createAdminClient();
  const token = generateToken();
  const ttlHours = type === "invite" ? INVITE_TTL_HOURS : RESET_TTL_HOURS;
  const expiresAt = new Date(Date.now() + ttlHours * 3600 * 1000).toISOString();

  // Les anciens jetons non utilisés du même type sont invalidés pour éviter
  // la confusion (plusieurs liens envoyés = seul le dernier fonctionne).
  await admin
    .from("access_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("profile_id", profileId)
    .eq("type", type)
    .is("used_at", null);

  const { error } = await admin.from("access_tokens").insert({
    profile_id: profileId,
    token,
    type,
    expires_at: expiresAt,
    created_by: createdBy,
  });
  if (error) throw error;
  return token;
}

export type TokenLookupResult =
  | { status: "ok"; profileId: string; tokenId: string }
  | { status: "not_found" }
  | { status: "expired" }
  | { status: "used" };

export async function lookupAccessToken(token: string, type: "invite" | "reset"): Promise<TokenLookupResult> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("access_tokens")
    .select("id, profile_id, expires_at, used_at")
    .eq("token", token)
    .eq("type", type)
    .maybeSingle();

  if (error) throw error;
  if (!data) return { status: "not_found" };
  if (data.used_at) return { status: "used" };
  if (new Date(data.expires_at).getTime() < Date.now()) return { status: "expired" };
  return { status: "ok", profileId: data.profile_id, tokenId: data.id };
}

export async function consumeAccessToken(tokenId: string) {
  const admin = createAdminClient();
  await admin.from("access_tokens").update({ used_at: new Date().toISOString() }).eq("id", tokenId);
}

export function activationUrl(token: string): string {
  return `${process.env.NEXT_PUBLIC_APP_URL}/activer/${token}`;
}

export function resetUrl(token: string): string {
  return `${process.env.NEXT_PUBLIC_APP_URL}/reinitialiser/${token}`;
}
