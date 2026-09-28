import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { makeSignature, symmetricEncodeJWT } from "better-auth/crypto";

// Run against the local app; remove only this check's uniquely identified votes.
const origin = process.env.BETTER_AUTH_URL!;
assert.equal(new URL(origin).hostname, "localhost");
const secret = process.env.BETTER_AUTH_SECRET!;
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
assert(key, "Configure a server-only Supabase key first.");
const client = createClient((process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL)!, key, { auth: { persistSession: false } });
const { data: caption, error } = await client.from("humor_entries").select("id").limit(1).single();
assert.ifError(error);
assert(caption);
const userId = `vote-check-${crypto.randomUUID()}`;
const token = crypto.randomUUID();
const now = new Date().toISOString();
const encrypted = await symmetricEncodeJWT({
  session: { id: userId, token, userId, expiresAt: new Date(Date.now() + 300_000).toISOString(), createdAt: now, updatedAt: now },
  user: { id: userId, name: "Vote Check", email: "vote-check@example.com", emailVerified: true, createdAt: now, updatedAt: now },
  updatedAt: Date.now(), version: "1",
}, secret, "better-auth-session", 300);
const cookie = `better-auth.session_token=${encodeURIComponent(`${token}.${await makeSignature(token, secret)}`)}; better-auth.session_data=${encrypted}`;
const post = (vote: number, session = "") => fetch(new URL("/api/caption-votes", origin), {
  method: "POST", headers: { origin, cookie: session, "Content-Type": "application/json" },
  body: JSON.stringify({ captionId: caption.id, vote, user_id: "ignored-client-user" }),
});

try {
  assert.equal((await post(1)).status, 401);
  for (const vote of [1, -1]) {
    const response = await post(vote, cookie);
    assert.equal(response.status, 201, await response.text());
  }
  const { data: votes, error: readError } = await client.from("caption_votes")
    .select("caption_id,user_id,vote,created_at").eq("user_id", userId).order("id");
  assert.ifError(readError);
  assert.equal(votes?.length, 2);
  assert.deepEqual(votes?.map((vote) => vote.vote), [1, -1]);
  assert(votes?.every((vote) => vote.caption_id === caption.id && vote.user_id === userId && Number.isFinite(Date.parse(vote.created_at))));
} finally {
  const { error: cleanupError } = await client.from("caption_votes").delete().eq("user_id", userId);
  assert.ifError(cleanupError);
}
console.log("PASS: Local HTTP authentication and real upvote/downvote inserts verified; both test rows removed.");
