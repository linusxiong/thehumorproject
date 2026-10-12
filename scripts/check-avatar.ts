import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { makeSignature, symmetricEncodeJWT } from "better-auth/crypto";

// Exercise the real avatar route and encrypted sessions with isolated database and storage stubs.
const origin = "http://localhost:3000";
const supabase = "https://avatars.example.test";
const secret = "avatar-check-only-secret-at-least-thirty-two-characters";
Object.assign(process.env, {
  BETTER_AUTH_URL: origin,
  BETTER_AUTH_SECRET: secret,
  OAUTH_PROXY_SECRET: secret,
  GOOGLE_CLIENT_ID: "avatar-check",
  GOOGLE_CLIENT_SECRET: "avatar-check",
  NEXT_PUBLIC_SUPABASE_URL: supabase,
  SUPABASE_SECRET_KEY: "sb_secret_test_only",
});
const { GET, POST, PATCH, DELETE } = await import("../app/api/avatar/route");
const userId = createHash("sha256").update("avatar-check@example.com").digest("hex");
const googleUrl = "https://lh3.googleusercontent.com/a/avatar-check";
const profiles = new Map<string, { avatar_source: string; avatar_path: string | null }>();
const objects = new Map<string, { type: string | null; bytes: Uint8Array }>();
let rpcError = false;
const originalFetch = globalThis.fetch;
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = new URL(String(input));
  const method = init?.method ?? "GET";
  assert.equal(url.origin, supabase);
  if (url.pathname.startsWith("/storage/v1/object/avatars/") && method === "POST") {
    const path = decodeURIComponent(url.pathname.slice("/storage/v1/object/avatars/".length));
    assert(!objects.has(path), "Uploads never overwrite an existing object");
    objects.set(path, { type: new Headers(init?.headers).get("content-type"), bytes: new Uint8Array(await new Response(init?.body).arrayBuffer()) });
    return Response.json({ Key: `avatars/${path}`, Id: crypto.randomUUID() });
  }
  if (url.pathname === "/storage/v1/object/avatars" && method === "DELETE") {
    const { prefixes } = JSON.parse(String(init?.body));
    for (const path of prefixes) objects.delete(path);
    return Response.json(prefixes.map((name: string) => ({ name })));
  }
  if (url.pathname === "/rest/v1/rpc/replace_avatar") {
    if (rpcError) return Response.json({ code: "42501", message: "permission denied" }, { status: 403 });
    const { p_user_id: owner, p_path: path } = JSON.parse(String(init?.body));
    const previous = profiles.get(owner)?.avatar_path ?? null;
    profiles.set(owner, { avatar_source: path ? "upload" : "google", avatar_path: path });
    return Response.json(previous);
  }
  assert.equal(url.pathname, "/rest/v1/user_profiles");
  const row = profiles.get(url.searchParams.get("user_id")!.slice(3));
  if (method === "GET") return Response.json(row ? [row] : []);
  assert.equal(method, "PATCH");
  assert.equal(url.searchParams.get("avatar_path"), "not.is.null");
  if (!row?.avatar_path) return Response.json([]);
  row.avatar_source = JSON.parse(String(init?.body)).avatar_source;
  return Response.json([{ avatar_path: row.avatar_path }]);
}) as typeof fetch;

async function cookie({ expired = false, emailVerified = true, email = "avatar-check@example.com" } = {}) {
  const token = crypto.randomUUID();
  const now = new Date().toISOString();
  const encrypted = await symmetricEncodeJWT({
    session: { id: "avatar-session", token, userId: "avatar-user", expiresAt: new Date(Date.now() + (expired ? -60_000 : 300_000)).toISOString(), createdAt: now, updatedAt: now },
    user: { id: "avatar-user", name: "Avatar Check", email, emailVerified, image: googleUrl, createdAt: now, updatedAt: now },
    updatedAt: Date.now(), version: "1",
  }, secret, "better-auth-session", 300);
  return `better-auth.session_token=${encodeURIComponent(`${token}.${await makeSignature(token, secret)}`)}; better-auth.session_data=${encrypted}`;
}
const handlers = { GET, POST, PATCH, DELETE };
const call = (method: keyof typeof handlers, session = "", body?: BodyInit, headers: Record<string, string> = {}) =>
  handlers[method](new Request(`${origin}/api/avatar`, { method, body, headers: { origin, cookie: session, ...headers } }));
const choose = (session: string, source: unknown) => call("PATCH", session, JSON.stringify({ source }), { "Content-Type": "application/json" });
function photo(signature: number[] | string, size = 64) {
  const bytes = new Uint8Array(size);
  bytes.set((typeof signature === "string" ? new TextEncoder().encode(signature) : signature).slice(0, size));
  const form = new FormData();
  form.set("file", new Blob([bytes], { type: "image/png" }), "photo.png");
  return form;
}
const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const jpeg = [0xff, 0xd8, 0xff, 0xe0];
const webp = "RIFF\0\0\0\0WEBP";
const publicUrl = (path: string) => `${supabase}/storage/v1/object/public/avatars/${path}`;
const google = { source: "google", googleUrl, uploadUrl: null };

try {
  const valid = await cookie();
  for (const session of ["", "better-auth.session_data=forged", await cookie({ expired: true }), valid.replace("session_data=", "session_data=tampered")]) {
    assert.equal((await call("GET", session)).status, 401);
    assert.equal((await call("POST", session, photo(png))).status, 401);
    assert.equal((await choose(session, "google")).status, 401);
    assert.equal((await call("DELETE", session)).status, 401);
  }
  for (const requestOrigin of ["https://evil.example", ""]) {
    assert.equal((await call("POST", valid, photo(png), { origin: requestOrigin })).status, 403);
    assert.equal((await call("PATCH", valid, JSON.stringify({ source: "google" }), { origin: requestOrigin })).status, 403);
    assert.equal((await call("DELETE", valid, undefined, { origin: requestOrigin })).status, 403);
  }
  const unverified = await cookie({ emailVerified: false });
  assert.deepEqual(await (await call("GET", unverified)).json(), google);
  assert.equal((await call("POST", unverified, photo(png))).status, 403);
  assert.equal((await choose(unverified, "google")).status, 403);
  assert.equal(objects.size + profiles.size, 0);

  const initial = await call("GET", valid);
  assert.equal(initial.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(await initial.json(), google, "New members start with their Google photo");
  assert.equal((await choose(valid, "upload")).status, 409, "The uploaded option needs a photo first");
  for (const source of ["", "gravatar", null, 1]) assert.equal((await choose(valid, source)).status, 400);
  assert.equal((await call("PATCH", valid, "{")).status, 400);
  assert.equal((await call("POST", valid, new FormData())).status, 400);
  assert.equal((await call("POST", valid, "not a form")).status, 400);
  assert.equal((await call("POST", valid, photo(png, 0))).status, 400);
  assert.equal((await call("POST", valid, photo(png, 2 * 1024 * 1024 + 1))).status, 413);
  assert.equal((await call("POST", valid, photo(png), { "content-length": String(10 * 1024 * 1024) })).status, 413);
  for (const disguised of ["<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>", "GIF89a", "%PDF-1.7"]) {
    assert.equal((await call("POST", valid, photo(disguised))).status, 415, "Only real JPEG, PNG, or WebP bytes are accepted");
  }
  assert.equal(objects.size + profiles.size, 0);

  const uploaded = await call("POST", valid, photo(png));
  assert.equal(uploaded.status, 201);
  const first = profiles.get(userId)?.avatar_path;
  assert(first && /^[0-9a-f-]{36}\.png$/.test(first), "Object names are random, never the user ID or email");
  assert.deepEqual(await uploaded.json(), { source: "upload", googleUrl, uploadUrl: publicUrl(first) });
  assert.equal(objects.get(first)?.type, "image/png", "Content type comes from the sniffed bytes");
  assert.deepEqual([...objects.get(first)!.bytes.subarray(0, 8)], png);
  assert.deepEqual(await (await call("GET", valid)).json(), { source: "upload", googleUrl, uploadUrl: publicUrl(first) });

  const stranger = await cookie({ email: "someone-else@example.com" });
  assert.equal((await call("POST", stranger, photo(webp))).status, 201);
  assert.equal(objects.size, 2);
  const replaced = await call("POST", valid, photo(jpeg));
  assert.equal(replaced.status, 201);
  const second = profiles.get(userId)?.avatar_path;
  assert(second && second.endsWith(".jpg") && second !== first);
  assert(!objects.has(first), "Replacing a photo deletes the previous one");
  assert.equal(objects.size, 2, "Another member's photo is untouched");
  assert.equal(objects.get(second)?.type, "image/jpeg");

  assert.deepEqual(await (await choose(valid, "google")).json(), { source: "google", googleUrl, uploadUrl: publicUrl(second) });
  assert.deepEqual(await (await call("GET", valid)).json(), { source: "google", googleUrl, uploadUrl: publicUrl(second) }, "Switching keeps the upload");
  assert.deepEqual(await (await choose(valid, "upload")).json(), { source: "upload", googleUrl, uploadUrl: publicUrl(second) });

  rpcError = true;
  assert.equal((await call("POST", valid, photo(png))).status, 500);
  assert.equal(objects.size, 2, "A failed save removes the orphaned upload");
  assert.equal((await call("DELETE", valid)).status, 500);
  rpcError = false;
  assert.equal(profiles.get(userId)?.avatar_path, second);

  for (let i = 0; i < 2; i++) assert.deepEqual(await (await call("DELETE", valid)).json(), google);
  assert(!objects.has(second), "Deleting removes the stored photo");
  assert.equal(objects.size, 1);
  assert.deepEqual(await (await call("GET", valid)).json(), google);
  assert.equal((await choose(valid, "upload")).status, 409);

  delete process.env.SUPABASE_SECRET_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  assert.deepEqual(await (await call("GET", valid)).json(), google, "Without storage, members still see their Google photo");
  assert.equal((await call("POST", valid, photo(png))).status, 503);
  assert.equal((await choose(valid, "google")).status, 503);
  assert.equal((await call("DELETE", valid)).status, 503);
  console.log("PASS: Google default, uploads with sniffed types and random names, replacement cleanup, source switching, deletion, ownership, size/type limits, guest/expired/tampered session rejection, CSRF, unverified accounts, database errors, and missing configuration.");
} finally {
  globalThis.fetch = originalFetch;
}
