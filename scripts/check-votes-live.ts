import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { makeSignature, symmetricEncodeJWT } from "better-auth/crypto";

const origin = process.env.BETTER_AUTH_URL!;
assert.equal(new URL(origin).hostname, "localhost");
const secret = process.env.BETTER_AUTH_SECRET!;
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
assert(key, "Configure a server-only Supabase key first.");
const client = createClient((process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL)!, key, { auth: { persistSession: false } });
const { data: caption, error } = await client.from("humor_entries").select("id").limit(1).single();
assert.ifError(error);
assert(caption);
const emails = [0, 1].map(() => `vote-check-${crypto.randomUUID()}@example.com`);
const userIds = emails.map(email => createHash("sha256").update(email).digest("hex"));
async function cookie(email: string) {
  const userId = crypto.randomUUID();
  const token = crypto.randomUUID();
  const now = new Date().toISOString();
  const encrypted = await symmetricEncodeJWT({
    session: { id: userId, token, userId, expiresAt: new Date(Date.now() + 300_000).toISOString(), createdAt: now, updatedAt: now },
    user: { id: userId, name: "Vote Check", email, emailVerified: true, createdAt: now, updatedAt: now },
    updatedAt: Date.now(), version: "1",
  }, secret, "better-auth-session", 300);
  return `better-auth.session_token=${encodeURIComponent(`${token}.${await makeSignature(token, secret)}`)}; better-auth.session_data=${encrypted}`;
}
const post = (vote: number, session = "", withdraw = false) => fetch(new URL("/api/caption-votes", origin), {
  method: withdraw ? "DELETE" : "POST", headers: { origin, cookie: session, "Content-Type": "application/json" },
  body: JSON.stringify({ captionId: caption.id, vote, user_id: "ignored-client-user" }),
});
const counts = async (session = "") => {
  const response = await fetch(`${origin}/api/caption-votes?captionId=${caption.id}`, { headers: { cookie: session } });
  assert.equal(response.status, 200);
  return response.json();
};
try {
  const before = await counts();
  assert.equal(before.user_vote, null);
  assert.equal((await post(1)).status, 401);
  assert.equal((await post(1, "", true)).status, 401);
  const firstCookie = await cookie(emails[0]);
  const attempts = await Promise.all([post(1, firstCookie), post(1, firstCookie)]);
  assert.deepEqual(attempts.map(response => response.status).sort(), [201, 409]);
  assert.equal((await post(-1, await cookie(emails[0]))).status, 409, "A new login must not permit another vote");
  const secondCookie = await cookie(emails[1]);
  assert.equal((await post(-1, secondCookie)).status, 201);
  const after = await counts(firstCookie);
  assert.deepEqual(after, { upvotes: before.upvotes + 1, downvotes: before.downvotes + 1, user_vote: 1 });
  const { data: votes, error: readError } = await client.from("caption_votes")
    .select("id,caption_id,user_id,vote,created_at").in("user_id", userIds).order("id");
  assert.ifError(readError);
  assert.equal(votes?.length, 2);
  assert.deepEqual(votes?.map(vote => vote.vote), [1, -1]);
  assert(votes?.every(vote => vote.caption_id === caption.id && userIds.includes(vote.user_id) && Number.isFinite(Date.parse(vote.created_at))));
  assert.equal((await post(1, secondCookie, true)).status, 200);
  assert.deepEqual(await counts(firstCookie), after, "Another account cannot withdraw the first account's vote");
  assert.equal((await post(1, firstCookie, true)).status, 200);
  assert.equal((await post(1, firstCookie, true)).status, 200);
  assert.deepEqual(await counts(firstCookie), { upvotes: before.upvotes, downvotes: before.downvotes + 1, user_vote: null });
  assert.equal((await post(-1, firstCookie)).status, 201);
  assert.deepEqual(await counts(firstCookie), { upvotes: before.upvotes, downvotes: before.downvotes + 2, user_vote: -1 });
  assert.equal((await post(1, firstCookie)).status, 409);
  const { data: replacement, error: replacementError } = await client.from("caption_votes").select("id").eq("caption_id", caption.id).eq("user_id", userIds[0]).single();
  assert.ifError(replacementError);
  assert(replacement && votes && replacement.id !== votes[0].id, "Re-voting inserts a new row");
} finally {
  const { error: cleanupError } = await client.from("caption_votes").delete().in("user_id", userIds);
  assert.ifError(cleanupError);
}
console.log("PASS: Live counts, upvotes/downvotes, simultaneous duplicate rejection, returning-user identity, withdrawal ownership, re-voting, and guest rejection; test votes removed.");
