import assert from "node:assert/strict";
import { makeSignature, symmetricEncodeJWT } from "better-auth/crypto";

// Exercise the real route and encrypted sessions with an isolated database stub.
const origin = "http://localhost:3000";
const secret = "vote-check-only-secret-at-least-thirty-two-characters";
Object.assign(process.env, {
  BETTER_AUTH_URL: origin,
  BETTER_AUTH_SECRET: secret,
  OAUTH_PROXY_SECRET: secret,
  GOOGLE_CLIENT_ID: "vote-check",
  GOOGLE_CLIENT_SECRET: "vote-check",
  NEXT_PUBLIC_SUPABASE_URL: "https://votes.example.test",
  SUPABASE_SECRET_KEY: "sb_secret_test_only",
});
const { POST } = await import("../app/api/caption-votes/route");
const saved: unknown[] = [];
let databaseError = "";
const originalFetch = globalThis.fetch;
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  assert.equal(String(input), "https://votes.example.test/rest/v1/caption_votes");
  assert.equal(init?.method, "POST");
  if (databaseError) return Response.json({ code: databaseError, message: "Test database failure" }, { status: 400 });
  saved.push(JSON.parse(String(init?.body)));
  return new Response(null, { status: 201 });
}) as typeof fetch;

async function cookie(expired = false) {
  const token = crypto.randomUUID();
  const now = new Date().toISOString();
  const encrypted = await symmetricEncodeJWT({
    session: { id: "vote-session", token, userId: "vote-user", expiresAt: new Date(Date.now() + (expired ? -60_000 : 300_000)).toISOString(), createdAt: now, updatedAt: now },
    user: { id: "vote-user", name: "Vote Check", email: "vote-check@example.com", emailVerified: true, createdAt: now, updatedAt: now },
    updatedAt: Date.now(), version: "1",
  }, secret, "better-auth-session", 300);
  return `better-auth.session_token=${encodeURIComponent(`${token}.${await makeSignature(token, secret)}`)}; better-auth.session_data=${encrypted}`;
}
const post = (body: unknown, session = "", requestOrigin = origin) => POST(new Request(`${origin}/api/caption-votes`, {
  method: "POST", headers: { origin: requestOrigin, cookie: session, "Content-Type": "application/json" }, body: JSON.stringify(body),
}));

try {
  const valid = await cookie();
  const input = { captionId: 1, vote: 1 };
  for (const session of ["", "better-auth.session_data=forged", await cookie(true), valid.replace("session_data=", "session_data=tampered")]) {
    assert.equal((await post(input, session)).status, 401);
  }
  assert.equal((await post(input, valid, "https://evil.example")).status, 403);
  assert.equal((await post(input, valid, "")).status, 403);
  for (const body of [null, {}, { ...input, captionId: -1 }, { ...input, captionId: "1" }, { ...input, captionId: 1.5 }, { ...input, captionId: Number.MAX_SAFE_INTEGER + 1 }, { ...input, vote: 0 }, { ...input, vote: "1" }]) {
    assert.equal((await post(body, valid)).status, 400);
  }
  assert.equal((await POST(new Request(`${origin}/api/caption-votes`, { method: "POST", headers: { origin, cookie: valid }, body: "{" }))).status, 400);
  assert.equal(saved.length, 0);
  for (const vote of [1, -1]) {
    const result = await post({ captionId: 7, vote, user_id: "forged-user" }, valid);
    assert.equal(result.status, 201);
    assert.deepEqual(await result.json(), { vote });
  }
  assert.deepEqual(saved, [
    { caption_id: 7, user_id: "vote-user", vote: 1 },
    { caption_id: 7, user_id: "vote-user", vote: -1 },
  ]);
  databaseError = "23503";
  assert.equal((await post(input, valid)).status, 404);
  databaseError = "42501";
  assert.equal((await post(input, valid)).status, 500);
  delete process.env.SUPABASE_SECRET_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  assert.equal((await post(input, valid)).status, 503);
  console.log("PASS: Vote inserts, trusted user identity, guest/expired/tampered session rejection, CSRF, invalid input, missing captions, database errors, and missing configuration.");
} finally {
  globalThis.fetch = originalFetch;
}
