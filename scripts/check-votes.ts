import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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
const { GET, POST } = await import("../app/api/caption-votes/route");
const userId = createHash("sha256").update("vote-check@example.com").digest("hex");
const saved: { caption_id: number; user_id: string; vote: number }[] = [];
let databaseError = "";
const originalFetch = globalThis.fetch;
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = new URL(String(input));
  assert.equal(url.origin, "https://votes.example.test");
  if (init?.method === "PATCH") return new Response(null, { status: 204 });
  const body = JSON.parse(String(init?.body));
  if (url.pathname.endsWith("/rpc/caption_vote_summary")) {
    const rows = saved.filter(row => row.caption_id === body.p_caption_id);
    return Response.json({ upvotes: rows.filter(row => row.vote === 1).length, downvotes: rows.filter(row => row.vote === -1).length, user_vote: rows.find(row => row.user_id === body.p_user_id)?.vote ?? null });
  }
  assert.equal(url.pathname, "/rest/v1/caption_votes");
  assert.equal(init?.method, "POST");
  if (databaseError) return Response.json({ code: databaseError }, { status: 400 });
  if (saved.some(row => row.caption_id === body.caption_id && row.user_id === body.user_id)) {
    return Response.json({ code: "23505" }, { status: 409 });
  }
  saved.push(body);
  return new Response(null, { status: 201 });
}) as typeof fetch;

async function cookie(expired = false, accountId = "vote-user", emailVerified = true) {
  const token = crypto.randomUUID();
  const now = new Date().toISOString();
  const encrypted = await symmetricEncodeJWT({
    session: { id: "vote-session", token, userId: accountId, expiresAt: new Date(Date.now() + (expired ? -60_000 : 300_000)).toISOString(), createdAt: now, updatedAt: now },
    user: { id: accountId, name: "Vote Check", email: "vote-check@example.com", emailVerified, createdAt: now, updatedAt: now },
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
    const result = await post({ captionId: vote === 1 ? 7 : 8, vote, user_id: "forged-user" }, valid);
    assert.equal(result.status, 201);
    assert.deepEqual(await result.json(), { vote });
  }
  assert.deepEqual(saved, [
    { caption_id: 7, user_id: userId, vote: 1 },
    { caption_id: 8, user_id: userId, vote: -1 },
  ]);
  assert.equal((await post({ captionId: 7, vote: -1 }, valid)).status, 409);
  assert.equal((await post({ captionId: 7, vote: 1 }, await cookie(false, "new-session-user"))).status, 409);
  assert.equal((await post(input, await cookie(false, "unverified", false))).status, 403);
  const counts = await GET(new Request(`${origin}/api/caption-votes?captionId=7`, { headers: { cookie: valid } }));
  assert.deepEqual(await counts.json(), { upvotes: 1, downvotes: 0, user_vote: 1 });
  const guest = await GET(new Request(`${origin}/api/caption-votes?captionId=7`));
  assert.deepEqual(await guest.json(), { upvotes: 1, downvotes: 0, user_vote: null });
  assert.equal((await GET(new Request(`${origin}/api/caption-votes?captionId=-1`))).status, 400);
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
