import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Public Storage bucket for uploaded profile photos (random object names; listing denied).
export const avatarBucket = "avatars";

// Server-only client for jokes, ratings, profiles, and avatar storage, which browsers cannot access directly.
export function createServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
}

// Keep the member's current Google photo on their profile so their jokes can show it to other readers.
export async function rememberGoogleAvatar(client: SupabaseClient, userId: string, googleUrl: string | null | undefined) {
  if (!googleUrl) return;
  const { error } = await client.from("user_profiles").upsert({ user_id: userId, google_url: googleUrl }, { onConflict: "user_id" })
    .abortSignal(AbortSignal.timeout(15_000));
  if (error) console.error("Failed to remember a Google avatar:", error.message);
}
