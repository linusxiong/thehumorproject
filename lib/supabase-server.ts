import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Public Storage bucket for uploaded profile photos (random object names; listing denied).
export const avatarBucket = "avatars";

// Server-only client for jokes, ratings, profiles, and avatar storage, which browsers cannot access directly.
export function createServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
}

type SessionUser = { name?: string | null; email?: string | null; image?: string | null };

// Keep the member's current Google photo on their profile so their jokes can show it to other readers,
// and their name, email, and last visit so superadmins can tell accounts apart in the admin area.
// Never touches is_superadmin, which only changes out of band.
export async function rememberProfile(client: SupabaseClient, userId: string, user: SessionUser) {
  const name = user.name?.trim().slice(0, 200);
  const email = user.email?.trim().toLowerCase();
  const { error } = await client.from("user_profiles").upsert({
    user_id: userId,
    ...(user.image ? { google_url: user.image } : {}),
    ...(name ? { display_name: name } : {}),
    ...(email && email.length >= 3 && email.length <= 320 ? { email } : {}),
    last_seen_at: new Date().toISOString(),
  }, { onConflict: "user_id" }).abortSignal(AbortSignal.timeout(15_000));
  if (error) console.error("Failed to remember a profile:", error.message);
}

// Profiles loaded within the last hour need no refresh unless the Google account details changed.
export function profileIsStale(row: { google_url?: string | null; display_name?: string | null; email?: string | null; last_seen_at?: string | null } | null, user: SessionUser) {
  if (!row) return true;
  if (user.image && row.google_url !== user.image) return true;
  if (user.name?.trim() && row.display_name !== user.name.trim().slice(0, 200)) return true;
  if (user.email?.trim() && row.email !== user.email.trim().toLowerCase()) return true;
  return !row.last_seen_at || Date.now() - new Date(row.last_seen_at).getTime() > 60 * 60 * 1000;
}
