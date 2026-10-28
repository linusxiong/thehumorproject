import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { makeSignature, symmetricEncodeJWT } from "better-auth/crypto";
import { createServerSupabase } from "../lib/supabase-server";

// Run against a local `bun dev` server using the same .env.local, after applying the admin migration.
// It signs in with synthetic sessions, grants a synthetic superadmin for the run, round-trips one synthetic joke
// through the media API, and removes the profile and joke afterwards. No Google account or Claude call is used.
const origin = process.env.BETTER_AUTH_URL!;
assert.equal(new URL(origin).hostname, "localhost", "Run admin checks locally, never against production.");
const secret = process.env.BETTER_AUTH_SECRET!;
assert(secret);
const client = createServerSupabase();
assert(client, "Set SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local.");

const run = crypto.randomUUID().slice(0, 8);
const adminEmail = `admin-check-${run}@example.com`;
const memberEmail = `member-check-${run}@example.com`;
const digest = (email: string) => createHash("sha256").update(email).digest("hex");
const adminId = digest(adminEmail);

const request = (path: string, options: RequestInit = {}) => fetch(new URL(path, origin), { redirect: "manual", ...options });
const send = (path: string, method: string, cookie: string, body?: unknown, requestOrigin = origin) => request(path, {
  method, headers: { "Content-Type": "application/json", origin: requestOrigin, cookie }, body: body === undefined ? undefined : JSON.stringify(body),
});
const expectLogin = (response: Response, path: string) => {
  assert([302, 303, 307].includes(response.status), `${path}: expected a redirect, got ${response.status}`);
  assert.equal(new URL(response.headers.get("location")!, origin).pathname, "/admin/login", `${path} should redirect to the admin sign-in page`);
};

async function sessionCookie(email: string, { emailVerified = true, expired = false } = {}) {
  const token = crypto.randomUUID();
  const now = new Date().toISOString();
  const encrypted = await symmetricEncodeJWT({
    session: { id: `admin-check-${run}`, token, userId: email, expiresAt: new Date(Date.now() + (expired ? -60_000 : 300_000)).toISOString(), createdAt: now, updatedAt: now },
    user: { id: email, name: "Admin Check", email, emailVerified, createdAt: now, updatedAt: now },
    updatedAt: Date.now(), version: "1",
  }, secret, "better-auth-session", 300);
  return `better-auth.session_token=${encodeURIComponent(`${token}.${await makeSignature(token, secret)}`)}; better-auth.session_data=${encrypted}`;
}

const pages = [
  "/admin", "/admin?range=7", "/admin/users", "/admin/media", "/admin/ratings", "/admin/images", "/admin/requests", "/admin/responses",
  "/admin/prompt-chains", "/admin/mix", "/admin/terms", "/admin/examples", "/admin/models", "/admin/providers", "/admin/signup-domains", "/admin/whitelist",
];
const resourceNames = ["terms", "generation-examples", "llm-models", "llm-providers", "signup-domains", "whitelisted-emails"];
const apis: [string, string][] = [
  ["/api/admin/media", "GET"], ["/api/admin/media", "POST"], ["/api/admin/media/1", "PATCH"], ["/api/admin/media/1", "DELETE"],
  ...resourceNames.flatMap((name): [string, string][] => [
    [`/api/admin/${name}`, "GET"], [`/api/admin/${name}`, "POST"], [`/api/admin/${name}/1`, "PATCH"], [`/api/admin/${name}/1`, "DELETE"],
  ]),
  ["/api/admin/prompt-chain-mix", "GET"], ["/api/admin/prompt-chain-mix", "PATCH"], ["/api/admin/generation-requests/1", "GET"],
  ["/api/admin/llm-responses/1", "GET"], ["/api/admin/images", "POST"],
  ["/api/admin/images/00000000-0000-0000-0000-000000000000.jpg", "PATCH"], ["/api/admin/images/00000000-0000-0000-0000-000000000000.jpg", "DELETE"],
];
let jokeId: number | null = null;
let termId: number | null = null;

try {
  // Visitors: every admin page redirects to sign-in, every admin API answers 401, and only the sign-in page renders.
  const login = await request("/admin/login");
  assert.equal(login.status, 200);
  assert.match(await login.text(), /Continue with Google/);
  for (const path of [...pages, "/admin/not-a-page"]) expectLogin(await request(path), path);
  for (const [path, method] of apis) assert.equal((await send(path, method, "", method === "GET" ? undefined : {})).status, 401, `${method} ${path} as a visitor`);

  // Forged, tampered, and expired sessions pass the cookie-only proxy but fail the server's session check.
  const forged = "better-auth.session_token=forged; better-auth.session_data=forged";
  const member = await sessionCookie(memberEmail);
  const broken = [forged, member.replace("session_data=", "session_data=tampered"), await sessionCookie(memberEmail, { expired: true })];
  for (const cookie of broken) {
    expectLogin(await request("/admin", { headers: { cookie } }), "/admin with a broken session");
    assert.equal((await send("/api/admin/media", "GET", cookie)).status, 401);
  }

  // Signed-in members without the flag, and unverified emails, are turned away; the sign-in page says why.
  for (const cookie of [member, await sessionCookie(adminEmail, { emailVerified: false })]) {
    for (const path of pages) expectLogin(await request(path, { headers: { cookie } }), `${path} as a member`);
    for (const [path, method] of apis) assert.equal((await send(path, method, cookie, method === "GET" ? undefined : {})).status, 403, `${method} ${path} as a member`);
  }
  const denied = await request("/admin/login", { headers: { cookie: member } });
  assert.equal(denied.status, 200);
  assert.match(await denied.text(), /not a superadmin/);

  // Grant the flag out of band, exactly as scripts/grant-superadmin.ts does.
  const { error: grantError } = await client.from("user_profiles").upsert({ user_id: adminId, is_superadmin: true, email: adminEmail }, { onConflict: "user_id" });
  assert.ifError(grantError);
  const admin = await sessionCookie(adminEmail);
  for (const path of pages) {
    const response = await request(path, { headers: { cookie: admin } });
    assert.equal(response.status, 200, `${path} as a superadmin`);
    assert.match(await response.text(), /Superadmin/, `${path} renders the admin shell`);
  }
  assert.equal((await request("/admin/not-a-page", { headers: { cookie: admin } })).status, 404);
  const back = await request("/admin/login", { headers: { cookie: admin } });
  assert.equal(new URL(back.headers.get("location")!, origin).pathname, "/admin", "Superadmins skip the sign-in page");

  // Create a synthetic joke directly, then read, update, and delete one of its versions through the API.
  const { data: created, error: createError } = await client.rpc("create_joke", {
    p_author_id: adminId, p_author_name: "Admin", p_body: `Admin check ${run}: synthetic joke for an automated test.`, p_source_language: "en",
    p_adaptations: ["en", "es", "zh"].map((audience) => ({ audience, body: `${audience} check`, gloss: { en: "check" }, punchline_core: { en: "check" }, notes: { en: "check" } })),
    p_created_at: "2000-01-01T00:00:00Z",
  });
  assert.ifError(createError);
  jokeId = Number(created);
  const list = await send("/api/admin/media", "GET", admin);
  assert.equal(list.status, 200);
  assert.equal(list.headers.get("cache-control"), "private, no-store");
  const versions = (await list.json() as { id: number; audience: string; joke: { id: number } }[]).filter((item) => item.joke.id === jokeId);
  assert.equal(versions.length, 3);
  const spanish = versions.find((item) => item.audience === "es")!;

  const update = { body: "Versión editada", gloss: { en: "Edited version", es: "ignored: the own-language gloss is the body" }, punchline_core: { en: "Edited core" }, notes: { en: "Edited notes", es: "" } };
  assert.equal((await send(`/api/admin/media/${spanish.id}`, "PATCH", admin, update, "https://evil.example")).status, 403, "Cross-site edits are rejected");
  assert.equal((await send(`/api/admin/media/${spanish.id}`, "PATCH", admin, { ...update, body: " " })).status, 400);
  assert.equal((await send(`/api/admin/media/${spanish.id}`, "PATCH", admin, { ...update, punchline_core: { en: "x".repeat(501) } })).status, 400);
  assert.equal((await send("/api/admin/media/abc", "PATCH", admin, update)).status, 404);
  assert.equal((await send("/api/admin/media/999999999999", "PATCH", admin, update)).status, 404);
  const patched = await send(`/api/admin/media/${spanish.id}`, "PATCH", admin, update);
  assert.equal(patched.status, 200);
  const { data: row } = await client.from("joke_adaptations").select("body,gloss,punchline_core,notes,updated_at").eq("id", spanish.id).single();
  assert.deepEqual(row && { ...row, updated_at: Boolean(row.updated_at) },
    { body: "Versión editada", gloss: { en: "Edited version", es: "Versión editada" }, punchline_core: { en: "Edited core" }, notes: { en: "Edited notes" }, updated_at: true });

  assert.equal((await send(`/api/admin/media/${spanish.id}`, "DELETE", admin, undefined, "https://evil.example")).status, 403);
  assert.equal((await send(`/api/admin/media/${spanish.id}`, "DELETE", admin)).status, 200);
  assert.equal((await send(`/api/admin/media/${spanish.id}`, "DELETE", admin)).status, 404, "Deleted versions are gone");
  const { count } = await client.from("joke_adaptations").select("id", { count: "exact", head: true }).eq("joke_id", jokeId);
  assert.equal(count, 2, "Deleting a version keeps the joke and its other versions");

  // Creation validates input before any Claude request.
  assert.equal((await send("/api/admin/media", "POST", admin, { body: "short" })).status, 400);
  assert.equal((await send("/api/admin/media", "POST", admin, { body: "A long enough joke body.", explanation: "no" })).status, 400);
  assert.equal((await send("/api/admin/media", "POST", admin, { body: "A long enough joke body." }, "https://evil.example")).status, 403);

  // Terms round trip through the generic admin API: create, duplicate, invalid, edit, delete.
  const term = { term: `admin-check-${run}`, language: "en", definition: "A synthetic term for an automated test.", example: "" };
  const createdTerm = await send("/api/admin/terms", "POST", admin, term);
  assert.equal(createdTerm.status, 201);
  termId = (await createdTerm.json() as { id: number; example: string | null }).id;
  assert.equal((await send("/api/admin/terms", "POST", admin, { ...term, term: term.term.toUpperCase() })).status, 409, "Terms are unique per language, ignoring case");
  assert.equal((await send("/api/admin/terms", "POST", admin, { ...term, language: "fr" })).status, 400);
  assert.equal((await send("/api/admin/terms", "POST", admin, term, "https://evil.example")).status, 403);
  assert.equal((await send("/api/admin/not-a-resource", "GET", admin)).status, 404);
  const editedTerm = await send(`/api/admin/terms/${termId}`, "PATCH", admin, { ...term, definition: "Edited.", example: "An example." });
  assert.equal(editedTerm.status, 200);
  assert.deepEqual(await editedTerm.json().then((value: { definition: string; example: string }) => [value.definition, value.example]), ["Edited.", "An example."]);
  assert.ok((await (await send("/api/admin/terms", "GET", admin)).json() as { id: number }[]).some((item) => item.id === termId));
  assert.equal((await send(`/api/admin/terms/${termId}`, "DELETE", admin)).status, 200);
  assert.equal((await send(`/api/admin/terms/${termId}`, "DELETE", admin)).status, 404);
  termId = null;

  // Models a chain step runs on cannot be deleted; the mix keeps an active chain for every purpose.
  const models = await (await send("/api/admin/llm-models", "GET", admin)).json() as { id: number; steps: { count: number }[] }[];
  const usedModel = models.find((item) => (item.steps[0]?.count ?? 0) > 0);
  if (usedModel) assert.equal((await send(`/api/admin/llm-models/${usedModel.id}`, "DELETE", admin)).status, 409);
  const mix = await (await send("/api/admin/prompt-chain-mix", "GET", admin)).json() as { chainId: number; purpose: string; weight: number }[];
  assert.ok(mix.length > 0);
  assert.equal((await send("/api/admin/prompt-chain-mix", "PATCH", admin, { weights: mix.map(({ chainId }) => ({ chainId, weight: 0 })) })).status, 422);
  assert.equal((await send("/api/admin/prompt-chain-mix", "PATCH", admin, { weights: [{ chainId: mix[0].chainId, weight: 101 }] })).status, 400);
  const unchanged = await send("/api/admin/prompt-chain-mix", "PATCH", admin, { weights: mix.map(({ chainId, weight }) => ({ chainId, weight })) });
  assert.equal(unchanged.status, 200);

  // Revoking the flag takes effect on the very next request.
  await client.from("user_profiles").update({ is_superadmin: false }).eq("user_id", adminId);
  expectLogin(await request("/admin", { headers: { cookie: admin } }), "/admin after revocation");
  assert.equal((await send("/api/admin/media", "GET", admin)).status, 403);

  console.log("PASS: Admin sign-in page, visitor/forged/tampered/expired/member/unverified denial on every admin page and API, superadmin pages, "
    + "media list, edit validation and CSRF, edit, delete, create validation, terms round trip, models in use, mix validation, and immediate revocation.");
} finally {
  if (jokeId !== null) await client.from("jokes").delete().eq("id", jokeId);
  if (termId !== null) await client.from("terms").delete().eq("id", termId);
  await client.from("user_profiles").delete().eq("user_id", adminId);
}
