import { createHash } from "node:crypto";
import { createServerSupabase } from "../lib/supabase-server";

// Grants, revokes, or lists superadmins out of band. The admin area requires user_profiles.is_superadmin, and nothing
// in the app can set that flag, so the first superadmin (and every later one) is granted here with the server-only
// Supabase key, which bypasses RLS. Profiles are keyed by the SHA-256 digest of the verified Google email,
// exactly as lib/auth.ts computes it, so the account needs no earlier visit.
//
//   bun run admin:grant you@gmail.com
//   bun run admin:grant --revoke you@gmail.com
//   bun run admin:grant --list
const args = process.argv.slice(2);
const revoke = args.includes("--revoke");
const list = args.includes("--list");
const email = args.find((arg) => !arg.startsWith("--"))?.trim().toLowerCase();

const client = createServerSupabase();
if (!client) throw new Error("Set SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local.");

if (list) {
  const { data, error } = await client.from("user_profiles").select("user_id,display_name,email,last_seen_at")
    .eq("is_superadmin", true).order("email");
  if (error) throw error;
  if (data.length === 0) console.log("No superadmins yet.");
  for (const row of data) console.log(`${row.email ?? "(email not recorded)"}\t${row.display_name ?? ""}\t${row.user_id.slice(0, 8)}…`);
  process.exit(0);
}

if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("Usage: bun run admin:grant [--revoke] <google-email> | --list");
  process.exit(1);
}

const userId = createHash("sha256").update(email).digest("hex");
if (revoke) {
  const { data, error } = await client.from("user_profiles").update({ is_superadmin: false }).eq("user_id", userId).select("user_id");
  if (error) throw error;
  console.log(data.length > 0 ? `Revoked superadmin access for ${email}.` : `${email} has no profile, so it was never a superadmin.`);
} else {
  const { error } = await client.from("user_profiles").upsert({ user_id: userId, is_superadmin: true, email }, { onConflict: "user_id" });
  if (error) throw error;
  console.log(`${email} is now a superadmin. Sign in at /admin with this Google account.`);
}
