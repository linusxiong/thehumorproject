import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { makeSignature, symmetricEncodeJWT } from "better-auth/crypto";

const origin = process.env.BETTER_AUTH_URL!;
assert.equal(new URL(origin).hostname, "localhost");
const secret = process.env.BETTER_AUTH_SECRET!;
const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL)!;
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY
  || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
assert(key && publicKey, "Configure the public and server-only Supabase keys first.");
const client = createClient(url, key, { auth: { persistSession: false } });
const browser = createClient(url, publicKey, { auth: { persistSession: false } });
const email = `avatar-check-${crypto.randomUUID()}@example.com`;
const userId = createHash("sha256").update(email).digest("hex");
const googleUrl = "https://lh3.googleusercontent.com/a/avatar-check";
// A real 1×1 PNG.
const png = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="), (char) => char.charCodeAt(0));

async function cookie() {
  const id = crypto.randomUUID();
  const token = crypto.randomUUID();
  const now = new Date().toISOString();
  const encrypted = await symmetricEncodeJWT({
    session: { id, token, userId: id, expiresAt: new Date(Date.now() + 300_000).toISOString(), createdAt: now, updatedAt: now },
    user: { id, name: "Avatar Check", email, emailVerified: true, image: googleUrl, createdAt: now, updatedAt: now },
    updatedAt: Date.now(), version: "1",
  }, secret, "better-auth-session", 300);
  return `better-auth.session_token=${encodeURIComponent(`${token}.${await makeSignature(token, secret)}`)}; better-auth.session_data=${encrypted}`;
}
const api = (method: string, session: string, body?: BodyInit, headers: Record<string, string> = {}) =>
  fetch(new URL("/api/avatar", origin), { method, body, headers: { origin, cookie: session, ...headers } });
const upload = (session: string) => {
  const form = new FormData();
  form.set("file", new Blob([png], { type: "image/png" }), "avatar.png");
  return api("POST", session, form);
};
const choose = (session: string, source: string) => api("PATCH", session, JSON.stringify({ source }), { "Content-Type": "application/json" });
const stored = async (photoUrl: string) => (await fetch(photoUrl, { cache: "no-store" })).ok;
const row = async () => {
  const { data, error } = await client.from("user_profiles").select("avatar_source,avatar_path").eq("user_id", userId).maybeSingle();
  assert.ifError(error);
  return data;
};

try {
  const { error: readError } = await browser.from("user_profiles").select("user_id").limit(1);
  assert(readError, "Browser keys cannot read profiles");
  const { error: rpcError } = await browser.rpc("replace_avatar", { p_user_id: userId, p_path: "forged.png" });
  assert(rpcError, "Browser keys cannot change avatars");
  const { error: directUpload } = await browser.storage.from("avatars").upload(`${crypto.randomUUID()}.png`, png, { contentType: "image/png" });
  assert(directUpload, "Browser keys cannot upload directly");
  const { data: listing } = await browser.storage.from("avatars").list();
  assert.deepEqual(listing ?? [], [], "Browser keys cannot list stored photos");
  const { error: svgError } = await client.storage.from("avatars").upload(`${crypto.randomUUID()}.svg`, "<svg xmlns='http://www.w3.org/2000/svg'/>", { contentType: "image/svg+xml" });
  assert(svgError, "The bucket itself rejects non-photo types");

  const session = await cookie();
  assert.deepEqual(await (await api("GET", session)).json(), { source: "google", googleUrl, uploadUrl: null });
  const first = await upload(session);
  assert.equal(first.status, 201);
  const { uploadUrl: firstUrl } = await first.json();
  assert(await stored(firstUrl), "Uploaded photos are publicly readable by URL");
  assert.equal((await fetch(firstUrl)).headers.get("content-type"), "image/png");
  assert.equal((await row())?.avatar_source, "upload");

  // A new login for the same account sees the same photo; simultaneous uploads leave exactly one stored photo.
  const attempts = await Promise.all([upload(await cookie()), upload(session)]);
  assert.deepEqual(attempts.map((response) => response.status), [201, 201]);
  const urls: string[] = await Promise.all(attempts.map(async (response) => (await response.json()).uploadUrl));
  assert(!(await stored(firstUrl)), "Replacing a photo deletes the previous one");
  const current = (await row())?.avatar_path;
  assert(current);
  const kept = await Promise.all(urls.map(stored));
  assert.deepEqual(kept.filter(Boolean).length, 1, "Concurrent uploads leave no orphaned photo");
  assert(urls[kept.indexOf(true)].endsWith(`/${current}`));

  assert.equal((await (await choose(session, "google")).json()).source, "google");
  assert.deepEqual(await row(), { avatar_source: "google", avatar_path: current }, "Switching keeps the upload");
  assert.equal((await (await choose(session, "upload")).json()).source, "upload");
  const removal = await api("DELETE", session);
  assert.deepEqual(await removal.json(), { source: "google", googleUrl, uploadUrl: null });
  assert(!(await stored(urls[kept.indexOf(true)])), "Deleting removes the stored photo");
  assert.deepEqual(await row(), { avatar_source: "google", avatar_path: null });
  assert.equal((await choose(session, "upload")).status, 409);
} finally {
  const path = (await row())?.avatar_path;
  if (path) await client.storage.from("avatars").remove([path]);
  const { error } = await client.from("user_profiles").delete().eq("user_id", userId);
  assert.ifError(error);
}
console.log("PASS: Live Google default, upload, public photo URLs, replacement and concurrent-upload cleanup, source switching, deletion, browser-key denial, and bucket type limits; test profile removed.");
