import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { makeSignature, symmetricEncodeJWT } from "better-auth/crypto";
import type { Joke } from "../lib/jokes";

// Exercise the real joke routes and encrypted sessions with isolated database and Claude stubs.
const origin = "http://localhost:3000";
const secret = "joke-check-only-secret-at-least-thirty-two-characters";
const apiKey = "sk-ant-joke-check-only";
Object.assign(process.env, {
  BETTER_AUTH_URL: origin,
  BETTER_AUTH_SECRET: secret,
  OAUTH_PROXY_SECRET: secret,
  GOOGLE_CLIENT_ID: "joke-check",
  GOOGLE_CLIENT_SECRET: "joke-check",
  NEXT_PUBLIC_SUPABASE_URL: "https://jokes.example.test",
  SUPABASE_SECRET_KEY: "sb_secret_test_only",
  ANTHROPIC_API_KEY: apiKey,
});
// Import after setting env: lib/auth.ts validates its configuration at module load.
const jokesRoute = await import("../app/api/jokes/route");
const ratingsRoute = await import("../app/api/joke-ratings/route");
const analyzeRoute = await import("../app/api/jokes/analyze/route");
const explanationsRoute = await import("../app/api/joke-explanations/route");
const digest = (email: string) => createHash("sha256").update(email).digest("hex");
const userId = digest("joke-check@example.com");
const limitedId = digest("limited@example.com");
const googlePhoto = "https://lh3.googleusercontent.com/a/joke-check";
// user_profiles stand-ins: Google photos remembered by the routes, and uploaded photo paths.
const rememberedPhotos = new Map<string, string>();
const uploadedPhotos = new Map<string, string>();

type Row = {
  id: number; body: string; source_language: string; origin: string; source_label: string | null; author_id: string | null; author_name: string; created_at: string;
  adult: boolean; explanation: string | null; explanation_source: "author" | "community" | null;
};
type Localized = Record<string, string>;
type AdaptationRow = { id: number; joke_id: number; audience: string; body: string; gloss: Localized; punchline_core: Localized; notes: Localized };
const jokes: Row[] = [{
  id: 1, body: "Why did the scarecrow win an award? He was outstanding in his field.", source_language: "en", origin: "demo", source_label: null,
  author_id: null, author_name: "Demo", created_at: "2026-10-01T00:00:00.000Z", adult: false, explanation: null, explanation_source: null,
}];
const adaptations: AdaptationRow[] = ["en", "es", "zh"].map((audience, index) => ({
  id: index + 1, joke_id: 1, audience, body: `Demo ${audience}`, gloss: { en: `Demo ${audience} gloss` }, punchline_core: { en: "Pun on outstanding." }, notes: { en: "Demo notes." },
}));
const ratings: { adaptation_id: number; user_id: string; funny: boolean }[] = [{ adaptation_id: 2, user_id: digest("other@example.com"), funny: true }];
// joke_explanations stand-in: every explanation a member supplied for an existing joke, accepted or rejected.
const explanations: { joke_id: number; user_id: string; explanation: string; accepted: boolean; created_at: string }[] = [];
const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
const member = (id: number, body: string, authorId: string, authorName: string, createdAt: string): Row =>
  ({ id, body, source_language: "en", origin: "member", source_label: null, author_id: authorId, author_name: authorName, created_at: createdAt, adult: false, explanation: null, explanation_source: null });
for (let i = 0; i < 10; i++) jokes.push(member(100 + i, "Limited joke body", limitedId, "Limited", hoursAgo(i + 1)));
jokes.push(member(200, "Old joke body text", userId, "Joke", hoursAgo(30)));
for (let i = 0; i < 9; i++) jokes.push(member(300 + i, "Older joke body", userId, "Joke", hoursAgo(25 + i)));

// ok: three valid versions; partial: the Spanish version has an empty body and the Chinese notes are too long;
// invalid: every version is broken (for analysis: an empty punchline); other: an unsupported language;
// truncated: stop_reason max_tokens; refusal: declined content.
type Mode = "ok" | "partial" | "invalid" | "unsuitable" | "other" | "error" | "malformed" | "truncated" | "refusal";
let claudeMode: Mode = "ok";
let claudeSource = "en";
let claudeAdult = false;
// explanation_accepted in adaptation answers.
let claudeAccepts = true;
let claudeRequests = 0;
// The explanation the route should send inside <explanation> tags, and the language an analysis should answer in.
let expectedExplanation: string | null = null;
let expectedLanguage = "English";
let nextJokeId = 1000;
let nextAdaptationId = 1000;

// ai_generation_context stand-in: the prompt chains the access migration seeds (null: the migration is not applied),
// glossary terms, and reference examples; plus the generation_requests and llm_responses logs the routes write.
type ChainStep = { id: number; position: number; kind: "analysis" | "adaptation"; model_id: number; model: string; effort: string; max_tokens: number };
const chainStep = (id: number, position: number, kind: ChainStep["kind"], model = "claude-haiku-5-5", effort = "medium"): ChainStep =>
  ({ id, position, kind, model_id: 1, model, effort, max_tokens: kind === "analysis" ? 8_000 : 16_000 });
const seededChains = () => ({
  preview: [{ id: 1, weight: 100, steps: [chainStep(1, 1, "analysis")] }],
  adaptation: [
    { id: 2, weight: 100, steps: [chainStep(2, 1, "adaptation")] },
    { id: 3, weight: 0, steps: [chainStep(3, 1, "adaptation", "claude-haiku-5-5", "high")] },
    { id: 4, weight: 0, steps: [chainStep(4, 1, "analysis"), chainStep(5, 2, "adaptation")] },
  ],
});
let chains: ReturnType<typeof seededChains> | null = seededChains();
let glossary: { term: string; language: string; definition: string; example: string | null }[] = [];
let examples: Record<string, string | null>[] = [];
const generationRequests: Record<string, unknown>[] = [];
const llmResponses: Record<string, unknown>[] = [];
// What each Claude request should carry under the active chain step and admin glossary.
let expectedModel = "claude-haiku-5-5";
let expectedEffort = "medium";
let expectedGlossary: string | null = null;
let expectedExamples = false;
const withGlossary = (content: string) => (expectedGlossary === null ? content : `${content}\n<glossary>\n${expectedGlossary}\n</glossary>`);

function feed(viewer: string | null, jokeId: number | null, limit: number) {
  const order = ["en", "es", "zh"];
  return jokes.filter((joke) => jokeId === null || joke.id === jokeId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id).slice(0, limit)
    .map((joke) => ({
      id: joke.id, body: joke.body, source_language: joke.source_language, origin: joke.origin, source_label: joke.source_label,
      author_name: joke.author_name, created_at: joke.created_at, adult: joke.adult, explanation: joke.explanation, explanation_source: joke.explanation_source,
      author_avatar_path: joke.author_id && uploadedPhotos.has(joke.author_id) ? uploadedPhotos.get(joke.author_id) : null,
      author_google_url: joke.author_id ? rememberedPhotos.get(joke.author_id) ?? null : null,
      adaptations: adaptations.filter((row) => row.joke_id === joke.id).sort((a, b) => order.indexOf(a.audience) - order.indexOf(b.audience))
        .map((row) => {
          const rows = ratings.filter((rating) => rating.adaptation_id === row.id);
          return {
            id: row.id, audience: row.audience, body: row.body, gloss: row.gloss, punchline_core: row.punchline_core, notes: row.notes,
            funny: rows.filter((rating) => rating.funny).length, not_funny: rows.filter((rating) => !rating.funny).length,
            user_rating: rows.find((rating) => rating.user_id === viewer)?.funny ?? null,
          };
        }),
    }));
}

const localizedText = (text: string) => ({ en: ` ${text} (en) `, es: `${text} (es)`, zh: `${text} (zh)` });
const version = (audience: string) => ({
  body: ` ${audience} version `, gloss: localizedText(`${audience} gloss`), punchline_core: localizedText("Same misunderstanding twist."), notes: localizedText(`Adapted for ${audience}.`),
});

function claude(init: RequestInit | undefined) {
  const headers = new Headers(init?.headers);
  assert.equal(headers.get("x-api-key"), apiKey);
  assert.equal(headers.get("anthropic-version"), "2023-06-01");
  const request = JSON.parse(String(init?.body));
  const schema = request.output_config.format.schema;
  // Analysis requests are told apart from adaptation requests by their answer schema.
  const analysis = "punchline" in schema.properties;
  assert.equal(request.model, expectedModel);
  assert.equal(request.max_tokens, analysis ? 8_000 : 16_000);
  assert.equal(request.tools, undefined, "JSON outputs keep adaptive thinking available; forced tools would disable it");
  assert.equal(request.output_config.effort, expectedEffort);
  assert.equal(request.system.includes("<glossary>"), expectedGlossary !== null, "The glossary note appears only with a glossary");
  assert.equal(request.system.includes("<examples>"), expectedExamples && !analysis, "Reference examples go to adaptation requests only");
  assert.equal(request.output_config.format.type, "json_schema");
  assert.match(request.system, /Punchline Passport/);
  assert.match(request.system, /上来自己动/, "The prompt teaches hidden homophones and innuendo");
  assert.equal(request.messages.length, 1);
  if (analysis) {
    assert.deepEqual(schema.required, ["suitable", "source_language", "adult", "punchline"]);
    assert.ok(request.system.includes(`in ${expectedLanguage}`), "The punchline is written in the reader's interface language");
    assert.equal(request.messages[0].content, withGlossary(`<joke>\n${submitted}\n</joke>`));
  } else {
    assert.deepEqual(schema.required, ["source_language", "suitable", "adult", "explanation_accepted", "versions"]);
    assert.deepEqual(schema.properties.versions.required, ["en", "es", "zh"]);
    assert.equal(request.messages[0].content, withGlossary(expectedExplanation === null
      ? `<joke>\n${submitted}\n</joke>`
      : `<joke>\n${submitted}\n</joke>\n<explanation>\n${expectedExplanation}\n</explanation>`));
  }
  claudeRequests++;
  if (claudeMode === "error") return Response.json({ type: "error", error: { type: "overloaded_error" } }, { status: 529 });
  if (claudeMode === "malformed") return Response.json({ content: [{ type: "text", text: "Not JSON." }], stop_reason: "end_turn" });
  if (claudeMode === "refusal") return Response.json({ content: [], stop_reason: "refusal" });
  if (analysis) {
    const answer = {
      suitable: claudeMode !== "unsuitable", source_language: claudeMode === "other" ? "other" : claudeSource, adult: claudeAdult,
      punchline: claudeMode === "invalid" ? "   " : "  We hear a pun.  ",
    };
    return Response.json({
      content: [{ type: "thinking", thinking: "" }, { type: "text", text: JSON.stringify(answer) }],
      stop_reason: claudeMode === "truncated" ? "max_tokens" : "end_turn", usage: { input_tokens: 90, output_tokens: 150 },
    });
  }
  const versions = { en: version("en"), es: version("es"), zh: version("zh") };
  if (claudeMode === "partial" || claudeMode === "invalid") {
    versions.es.body = "   ";
    versions.zh.notes.en = "x".repeat(1001);
  }
  if (claudeMode === "invalid") versions.en.punchline_core = "Not localized" as never;
  const input = {
    suitable: claudeMode !== "unsuitable", source_language: claudeMode === "other" ? "other" : claudeSource,
    adult: claudeAdult, explanation_accepted: claudeAccepts, versions,
  };
  return Response.json({
    content: [{ type: "thinking", thinking: "" }, { type: "text", text: JSON.stringify(input) }],
    stop_reason: claudeMode === "truncated" ? "max_tokens" : "end_turn", usage: { input_tokens: 120, output_tokens: 340, cache_read_input_tokens: 0 },
  });
}

const originalFetch = globalThis.fetch;
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = new URL(String(input));
  if (url.href === "https://api.anthropic.com/v1/messages") return claude(init);
  assert.equal(url.origin, "https://jokes.example.test");
  const body = init?.body ? JSON.parse(String(init.body)) : null;
  const value = (name: string) => url.searchParams.get(name)?.replace(/^(eq|gt)\./, "");
  switch (url.pathname) {
    case "/rest/v1/rpc/joke_feed":
      return Response.json(feed(body.p_user_id, body.p_joke_id, body.p_limit));
    case "/rest/v1/rpc/create_joke": {
      assert.deepEqual(Object.keys(body).sort(), [
        "p_adaptations", "p_adult", "p_author_id", "p_author_name", "p_body", "p_explanation", "p_source_language",
      ]);
      const id = nextJokeId++;
      jokes.push({
        ...member(id, body.p_body, body.p_author_id, body.p_author_name, new Date().toISOString()),
        source_language: body.p_source_language, adult: body.p_adult, explanation: body.p_explanation,
        explanation_source: body.p_explanation === null ? null : "author",
      });
      for (const row of body.p_adaptations) adaptations.push({ ...row, id: nextAdaptationId++, joke_id: id });
      return Response.json(id);
    }
    case "/rest/v1/rpc/readapt_joke": {
      assert.deepEqual(Object.keys(body).sort(), ["p_adaptations", "p_adult", "p_explanation", "p_joke_id", "p_user_id"]);
      const target = jokes.find((item) => item.id === body.p_joke_id);
      if (!target) return Response.json({ code: "P0002", message: "joke does not exist" }, { status: 404 });
      Object.assign(target, { adult: body.p_adult, explanation: body.p_explanation, explanation_source: "community" });
      explanations.push({
        joke_id: target.id, user_id: body.p_user_id, explanation: body.p_explanation, accepted: true, created_at: new Date().toISOString(),
      });
      // Deleting the old versions cascades to their ratings.
      const removed = new Set(adaptations.filter((row) => row.joke_id === target.id).map((row) => row.id));
      adaptations.splice(0, adaptations.length, ...adaptations.filter((row) => !removed.has(row.id)));
      ratings.splice(0, ratings.length, ...ratings.filter((row) => !removed.has(row.adaptation_id)));
      for (const row of body.p_adaptations) adaptations.push({ ...row, id: nextAdaptationId++, joke_id: target.id });
      return new Response(null, { status: 204 });
    }
    case "/rest/v1/jokes": {
      if (init?.method === "GET") {
        assert.equal(url.searchParams.get("select"), "body");
        return Response.json(jokes.filter((joke) => joke.id === Number(value("id"))).map((joke) => ({ body: joke.body })));
      }
      assert.equal(init?.method, "HEAD");
      const since = value("created_at") ?? "";
      const count = jokes.filter((joke) => joke.author_id === value("author_id") && joke.created_at > since).length;
      return new Response(null, { status: 200, headers: { "content-range": `*/${count}` } });
    }
    case "/rest/v1/joke_explanations": {
      if (init?.method === "POST") {
        assert.deepEqual(Object.keys(body).sort(), ["accepted", "explanation", "joke_id", "user_id"], "Explanations never store the member's name");
        explanations.push({ ...body, created_at: new Date().toISOString() });
        return new Response(null, { status: 201 });
      }
      assert.equal(init?.method, "HEAD");
      const since = value("created_at") ?? "";
      const count = explanations.filter((row) => row.user_id === value("user_id") && row.created_at > since).length;
      return new Response(null, { status: 200, headers: { "content-range": `*/${count}` } });
    }
    case "/rest/v1/joke_adaptations":
      return Response.json(adaptations.filter((row) => row.id === Number(value("id"))).map((row) => ({ joke_id: row.joke_id })));
    case "/rest/v1/adaptation_ratings": {
      if (init?.method === "DELETE") {
        const index = ratings.findIndex((row) => row.adaptation_id === Number(value("adaptation_id")) && row.user_id === value("user_id"));
        if (index !== -1) ratings.splice(index, 1);
        return new Response(null, { status: 204 });
      }
      assert.equal(init?.method, "POST");
      assert.equal(url.searchParams.get("on_conflict"), "adaptation_id,user_id");
      assert.match(new Headers(init?.headers).get("prefer") ?? "", /resolution=merge-duplicates/);
      const existing = ratings.find((row) => row.adaptation_id === body.adaptation_id && row.user_id === body.user_id);
      if (existing) existing.funny = body.funny;
      else ratings.push({ adaptation_id: body.adaptation_id, user_id: body.user_id, funny: body.funny });
      return new Response(null, { status: 201 });
    }
    case "/rest/v1/rpc/ai_generation_context": {
      if (!chains) return Response.json({ code: "PGRST202", message: "Could not find the function" }, { status: 404 });
      // The database matches terms as substrings; the app checks word boundaries.
      const text = String(body.p_text).toLowerCase();
      return Response.json({
        chains: chains[body.p_purpose as "preview" | "adaptation"],
        terms: glossary.filter((entry) => text.includes(entry.term.toLowerCase())),
        examples,
      });
    }
    case "/rest/v1/generation_requests": {
      if (init?.method === "PATCH") {
        const row = generationRequests.find((item) => item.id === Number(value("id")));
        assert.ok(row, "Only logged requests are updated");
        Object.assign(row, body);
        return new Response(null, { status: 204 });
      }
      assert.equal(init?.method, "POST");
      const row = { ...body, id: generationRequests.length + 1, status: "pending" };
      generationRequests.push(row);
      return Response.json({ id: row.id }, { status: 201 });
    }
    case "/rest/v1/llm_responses":
      assert.equal(init?.method, "POST");
      assert.ok(generationRequests.some((item) => item.id === body.request_id), "Responses belong to a logged request");
      llmResponses.push(body);
      return new Response(null, { status: 201 });
    case "/rest/v1/user_profiles": {
      assert.equal(init?.method, "POST");
      assert.equal(url.searchParams.get("on_conflict"), "user_id");
      rememberedPhotos.set(body.user_id, body.google_url);
      return new Response(null, { status: 201 });
    }
  }
  throw new Error(`Unexpected request: ${init?.method} ${url.pathname}`);
}) as typeof fetch;

async function cookie(expired = false, emailVerified = true, email = "joke-check@example.com") {
  const token = crypto.randomUUID();
  const now = new Date().toISOString();
  const encrypted = await symmetricEncodeJWT({
    session: { id: "joke-session", token, userId: "joke-user", expiresAt: new Date(Date.now() + (expired ? -60_000 : 300_000)).toISOString(), createdAt: now, updatedAt: now },
    user: { id: "joke-user", name: "Joke Check", email, emailVerified, image: googlePhoto, createdAt: now, updatedAt: now },
    updatedAt: Date.now(), version: "1",
  }, secret, "better-auth-session", 300);
  return `better-auth.session_token=${encodeURIComponent(`${token}.${await makeSignature(token, secret)}`)}; better-auth.session_data=${encrypted}`;
}
const send = (handler: (request: Request) => Promise<Response>, path: string, method: string, body: unknown, session = "", requestOrigin = origin) =>
  handler(new Request(`${origin}${path}`, { method, headers: { origin: requestOrigin, cookie: session, "Content-Type": "application/json" }, body: JSON.stringify(body) }));
const share = (body: unknown, session = "", requestOrigin = origin) => send(jokesRoute.POST, "/api/jokes", "POST", body, session, requestOrigin);
const rate = (body: unknown, session = "", requestOrigin = origin) => send(ratingsRoute.POST, "/api/joke-ratings", "POST", body, session, requestOrigin);
const withdraw = (body: unknown, session = "", requestOrigin = origin) => send(ratingsRoute.DELETE, "/api/joke-ratings", "DELETE", body, session, requestOrigin);
const analyze = (body: unknown, session = "", requestOrigin = origin) => send(analyzeRoute.POST, "/api/jokes/analyze", "POST", body, session, requestOrigin);
const explain = (body: unknown, session = "", requestOrigin = origin) => send(explanationsRoute.POST, "/api/joke-explanations", "POST", body, session, requestOrigin);
const list = async (session = "") => {
  const response = await jokesRoute.GET(new Request(`${origin}/api/jokes`, { headers: { cookie: session } }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  return await response.json() as Joke[];
};
const hasCounts = (joke: Joke) => joke.adaptations.some((adaptation) => "funny" in adaptation || "not_funny" in adaptation);
const joke = "My therapist says I have a preoccupation with vengeance. We'll see about that.";
const spanishJoke = "¿Qué le dice un jardinero a otro? Disfrutemos mientras podamos.";
const fridgeJoke = "冰箱和冰激凌分手了，冰激凌哭着说：“你让我留了好多水。”冰箱开门说，上来自己冻。";
// The exact joke text the route should send inside <joke> tags.
let submitted = joke;

try {
  assert.equal(jokesRoute.maxDuration, 120);
  const valid = await cookie();
  const stranger = await cookie(false, true, "other@example.com");
  const unverified = await cookie(false, false);

  // Guests read the feed without totals or ratings.
  const guestFeed = await list();
  const demo = guestFeed.find((item) => item.id === 1)!;
  assert.deepEqual([demo.origin, demo.source_label, demo.source_language], ["demo", null, "en"]);
  assert.deepEqual(demo.adaptations.map((adaptation) => adaptation.audience), ["en", "es", "zh"]);
  assert.deepEqual(demo.adaptations[0].gloss, { en: "Demo en gloss" });
  assert.ok(guestFeed.every((item) => !item.revealed && !hasCounts(item) && item.adaptations.every((adaptation) => adaptation.user_rating === null)));
  assert.ok(!hasCounts((await list(valid)).find((item) => item.id === 1)!), "Totals stay hidden until the viewer rates");
  const strangerDemo = (await list(stranger)).find((item) => item.id === 1)!;
  assert.equal(strangerDemo.revealed, true, "Rating any version reveals the joke's totals");
  assert.deepEqual(strangerDemo.adaptations.map((adaptation) => [adaptation.funny, adaptation.not_funny, adaptation.user_rating]), [[0, 0, null], [1, 0, true], [0, 0, null]]);

  // Authentication, CSRF, and validation run before any Claude call.
  for (const session of ["", "better-auth.session_data=forged", await cookie(true), valid.replace("session_data=", "session_data=tampered")]) {
    assert.equal((await share({ body: joke }, session)).status, 401);
    assert.equal((await rate({ adaptationId: 1, funny: true }, session)).status, 401);
    assert.equal((await withdraw({ adaptationId: 1 }, session)).status, 401);
  }
  for (const requestOrigin of ["https://evil.example", ""]) {
    assert.equal((await share({ body: joke }, valid, requestOrigin)).status, 403);
    assert.equal((await rate({ adaptationId: 1, funny: true }, valid, requestOrigin)).status, 403);
    assert.equal((await withdraw({ adaptationId: 1 }, valid, requestOrigin)).status, 403);
  }
  assert.equal((await share({ body: joke }, unverified)).status, 403);
  assert.equal((await rate({ adaptationId: 1, funny: true }, unverified)).status, 403);
  assert.equal((await withdraw({ adaptationId: 1 }, unverified)).status, 403);
  for (const body of [null, {}, { body: 42 }, { body: "too short" }, { body: "   short   " }, { body: "x".repeat(601) }]) {
    assert.equal((await share(body, valid)).status, 400);
  }
  assert.equal((await jokesRoute.POST(new Request(`${origin}/api/jokes`, { method: "POST", headers: { origin, cookie: valid }, body: "{" }))).status, 400);
  for (const body of [null, {}, { adaptationId: 1 }, { adaptationId: "1", funny: true }, { adaptationId: 0, funny: true }, { adaptationId: 1.5, funny: true }, { adaptationId: Number.MAX_SAFE_INTEGER + 1, funny: true }, { adaptationId: 1, funny: "yes" }]) {
    assert.equal((await rate(body, valid)).status, 400);
  }
  assert.equal((await withdraw({ adaptationId: -1 }, valid)).status, 400);
  assert.equal(claudeRequests, 0);

  // Missing configuration, daily limit, unsuitable submissions, and failed adaptation store nothing.
  const storedJokes = jokes.length;
  delete process.env.ANTHROPIC_API_KEY;
  assert.equal((await share({ body: joke }, valid)).status, 503);
  process.env.ANTHROPIC_API_KEY = apiKey;
  assert.equal((await share({ body: joke }, await cookie(false, true, "limited@example.com"))).status, 429);
  assert.equal(claudeRequests, 0);
  for (const mode of ["unsuitable", "other", "refusal"] as const) {
    claudeMode = mode;
    const rejected = await share({ body: joke }, valid);
    assert.equal(rejected.status, 422, `${mode} submissions are rejected`);
    assert.doesNotMatch(await rejected.text(), /claude/i);
  }
  for (const mode of ["error", "malformed", "truncated", "invalid"] as const) {
    claudeMode = mode;
    const failed = await share({ body: joke }, valid);
    assert.equal(failed.status, 502, `${mode} adaptation fails`);
    const failedText = await failed.text();
    assert.ok(!failedText.includes(apiKey));
    assert.doesNotMatch(failedText, /claude/i);
  }
  assert.equal(claudeRequests, 7, "Each submission makes exactly one adaptation request");
  assert.equal(jokes.length, storedJokes);

  // Partially invalid output stores only the valid versions, keeps the source language, and trims everything.
  claudeMode = "partial";
  claudeSource = "es";
  submitted = spanishJoke;
  claudeRequests = 0;
  const partial = await share({ body: `  ${spanishJoke}  ` }, valid);
  assert.equal(partial.status, 201);
  assert.equal(claudeRequests, 1);
  const partialJoke = await partial.json() as Joke;
  assert.deepEqual(partialJoke.adaptations.map((adaptation) => adaptation.audience), ["en"]);
  assert.equal(partialJoke.body, spanishJoke);
  assert.equal(partialJoke.source_language, "es");
  assert.deepEqual([partialJoke.origin, partialJoke.source_label], ["member", null]);
  assert.equal(partialJoke.author_name, "Joke");
  const [partialEnglish] = partialJoke.adaptations;
  assert.equal(partialEnglish.body, "en version", "Adapted text is trimmed");
  assert.deepEqual(partialEnglish.gloss, { en: "en version", es: "en gloss (es)", zh: "en gloss (zh)" }, "A version's own-language gloss is its body");
  assert.deepEqual(partialEnglish.punchline_core, { en: "Same misunderstanding twist. (en)", es: "Same misunderstanding twist. (es)", zh: "Same misunderstanding twist. (zh)" });
  assert.equal(partialEnglish.notes.zh, "Adapted for en. (zh)");

  // A full success returns the new joke with three hidden-total versions.
  claudeMode = "ok";
  claudeSource = "en";
  submitted = joke;
  const created = await share({ body: joke }, valid);
  assert.equal(created.status, 201);
  const createdText = await created.text();
  assert.ok(!createdText.includes(apiKey));
  const fresh = JSON.parse(createdText) as Joke;
  assert.deepEqual(fresh.adaptations.map((adaptation) => adaptation.audience), ["en", "es", "zh"]);
  assert.equal(fresh.author_avatar_url, googlePhoto, "A member's joke shows their Google photo");
  assert.ok(!("author_google_url" in fresh) && !("author_avatar_path" in fresh), "Raw avatar fields never reach the browser");
  uploadedPhotos.set(userId, "uploaded.png");
  const withUpload = (await list()).find((item) => item.id === fresh.id)!;
  assert.equal(withUpload.author_avatar_url, "https://jokes.example.test/storage/v1/object/public/avatars/uploaded.png", "An uploaded photo wins over the Google photo");
  assert.equal((await list()).find((item) => item.id === 1)!.author_avatar_url, null, "Demo jokes have no author photo");
  uploadedPhotos.delete(userId);
  assert.equal(fresh.source_language, "en");
  assert.deepEqual(fresh.adaptations.map((adaptation) => adaptation.gloss[adaptation.audience]), ["en version", "es version", "zh version"]);
  assert.equal(fresh.revealed, false);
  assert.ok(!hasCounts(fresh));
  assert.equal(claudeRequests, 2);
  assert.equal(jokes.filter((item) => item.author_id === userId).length, 12);
  for (let i = 0; i < 8; i++) jokes.push(member(400 + i, "Recent joke body", userId, "Joke", hoursAgo(i + 1)));
  assert.equal((await share({ body: joke }, valid)).status, 429, "Ten jokes within 24 hours reach the daily limit; older jokes do not count");
  assert.equal(claudeRequests, 2);

  // Rating reveals totals, changing a rating updates it, and withdrawal hides totals again.
  const [english, spanish] = fresh.adaptations;
  const rated = await rate({ adaptationId: spanish.id, funny: false }, valid);
  assert.equal(rated.status, 200);
  const ratedJoke = await rated.json() as Joke;
  assert.equal(ratedJoke.id, fresh.id);
  assert.equal(ratedJoke.revealed, true);
  assert.deepEqual(ratedJoke.adaptations.map((adaptation) => [adaptation.funny, adaptation.not_funny, adaptation.user_rating]), [[0, 0, null], [0, 1, false], [0, 0, null]]);
  const changed = await (await rate({ adaptationId: spanish.id, funny: true }, valid)).json() as Joke;
  assert.deepEqual([changed.adaptations[1].funny, changed.adaptations[1].not_funny, changed.adaptations[1].user_rating], [1, 0, true]);
  assert.equal(ratings.filter((row) => row.user_id === userId).length, 1, "Upserts keep one rating per account and version");
  assert.ok(hasCounts((await list(valid)).find((item) => item.id === fresh.id)!));
  assert.ok(!hasCounts((await list(stranger)).find((item) => item.id === fresh.id)!), "Other accounts still see hidden totals");
  assert.ok(!hasCounts((await list()).find((item) => item.id === fresh.id)!));
  assert.equal((await withdraw({ adaptationId: spanish.id }, stranger)).status, 200);
  assert.equal(ratings.filter((row) => row.user_id === userId).length, 1, "An account cannot withdraw another account's rating");
  const withdrawn = await withdraw({ adaptationId: spanish.id }, valid);
  assert.equal(withdrawn.status, 200);
  const withdrawnJoke = await withdrawn.json() as Joke;
  assert.equal(withdrawnJoke.revealed, false);
  assert.ok(!hasCounts(withdrawnJoke) && withdrawnJoke.adaptations.every((adaptation) => adaptation.user_rating === null));
  assert.equal((await withdraw({ adaptationId: english.id }, valid)).status, 200, "Withdrawing twice is harmless");

  // Step one of sharing: the analysis explains the punchline in the reader's language and stores nothing.
  assert.equal(analyzeRoute.maxDuration, 120);
  claudeRequests = 0;
  const storedBeforeAnalysis = jokes.length;
  for (const session of ["", "better-auth.session_data=forged", await cookie(true)]) {
    assert.equal((await analyze({ body: joke, locale: "en" }, session)).status, 401);
  }
  for (const requestOrigin of ["https://evil.example", ""]) assert.equal((await analyze({ body: joke, locale: "en" }, valid, requestOrigin)).status, 403);
  assert.equal((await analyze({ body: joke, locale: "en" }, unverified)).status, 403);
  for (const body of [null, {}, { body: 42, locale: "en" }, { body: "too short", locale: "en" }, { body: "x".repeat(601), locale: "en" }, { body: joke }, { body: joke, locale: "fr" }]) {
    assert.equal((await analyze(body, valid)).status, 400);
  }
  delete process.env.ANTHROPIC_API_KEY;
  assert.equal((await analyze({ body: joke, locale: "en" }, valid)).status, 503);
  process.env.ANTHROPIC_API_KEY = apiKey;
  assert.equal(claudeRequests, 0);
  for (const mode of ["unsuitable", "other", "refusal"] as const) {
    claudeMode = mode;
    const rejected = await analyze({ body: joke, locale: "en" }, valid);
    assert.equal(rejected.status, 422, `${mode} jokes are rejected by the analysis`);
    assert.doesNotMatch(await rejected.text(), /claude/i);
  }
  for (const mode of ["error", "malformed", "truncated", "invalid"] as const) {
    claudeMode = mode;
    const failed = await analyze({ body: joke, locale: "en" }, valid);
    assert.equal(failed.status, 502, `${mode} analysis fails`);
    const failedText = await failed.text();
    assert.ok(!failedText.includes(apiKey));
    assert.doesNotMatch(failedText, /claude/i);
  }
  claudeMode = "ok";
  claudeSource = "zh";
  claudeAdult = true;
  submitted = fridgeJoke;
  expectedLanguage = "Chinese";
  const analyzed = await analyze({ body: `  ${fridgeJoke}  `, locale: "zh" }, valid);
  assert.equal(analyzed.status, 200);
  assert.equal(analyzed.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(await analyzed.json(), { sourceLanguage: "zh", adult: true, punchline: "We hear a pun." }, "Adult jokes are analyzed, not rejected");
  expectedLanguage = "Spanish";
  assert.equal((await analyze({ body: fridgeJoke, locale: "es" }, valid)).status, 200);
  assert.equal(claudeRequests, 9, "Each analysis makes exactly one request");
  assert.equal(jokes.length, storedBeforeAnalysis, "Analysis stores nothing");

  // Step two: the confirmed explanation is adapted as the authoritative reading and stored with the 18+ flag.
  const explainer = await cookie(false, true, "explainer@example.com");
  for (const explanation of [42, "abc", "   abc   ", "x".repeat(501)]) {
    assert.equal((await share({ body: fridgeJoke, explanation }, explainer)).status, 400);
  }
  const fridgeExplanation = "“上来自己冻” sounds like “上来自己动”, an innuendo.";
  expectedExplanation = fridgeExplanation;
  claudeAccepts = false;
  const unrelated = await share({ body: fridgeJoke, explanation: `  ${fridgeExplanation}  ` }, explainer);
  assert.equal(unrelated.status, 422, "An explanation that does not match the joke is rejected");
  assert.equal(jokes.length, storedBeforeAnalysis);
  claudeAccepts = true;
  const explained = await share({ body: fridgeJoke, explanation: `  ${fridgeExplanation}  ` }, explainer);
  assert.equal(explained.status, 201);
  const explainedJoke = await explained.json() as Joke;
  assert.deepEqual([explainedJoke.adult, explainedJoke.explanation, explainedJoke.explanation_source, explainedJoke.source_language], [true, fridgeExplanation, "author", "zh"]);
  expectedExplanation = null;
  claudeAdult = false;
  const plain = await share({ body: fridgeJoke, explanation: "   " }, explainer);
  assert.equal(plain.status, 201, "A blank explanation is treated as none");
  const plainJoke = await plain.json() as Joke;
  assert.deepEqual([plainJoke.adult, plainJoke.explanation, plainJoke.explanation_source], [false, null, null]);
  assert.equal(claudeRequests, 12);

  // Community explanations: authentication, CSRF, and validation run before any request.
  assert.equal(explanationsRoute.maxDuration, 120);
  claudeRequests = 0;
  const explanation = "The scarecrow is literally out standing in a field.";
  for (const session of ["", "better-auth.session_data=forged", await cookie(true)]) {
    assert.equal((await explain({ jokeId: 1, explanation }, session)).status, 401);
  }
  for (const requestOrigin of ["https://evil.example", ""]) assert.equal((await explain({ jokeId: 1, explanation }, valid, requestOrigin)).status, 403);
  assert.equal((await explain({ jokeId: 1, explanation }, unverified)).status, 403);
  for (const body of [null, {}, { jokeId: 1 }, { jokeId: "1", explanation }, { jokeId: 0, explanation }, { jokeId: 1.5, explanation }, { jokeId: 1, explanation: 42 }, { jokeId: 1, explanation: "abc" }, { jokeId: 1, explanation: "x".repeat(501) }]) {
    assert.equal((await explain(body, valid)).status, 400);
  }
  delete process.env.ANTHROPIC_API_KEY;
  assert.equal((await explain({ jokeId: 1, explanation }, valid)).status, 503);
  process.env.ANTHROPIC_API_KEY = apiKey;
  for (let i = 0; i < 10; i++) {
    explanations.push({ joke_id: 1, user_id: limitedId, explanation, accepted: i % 2 === 0, created_at: hoursAgo(i + 1) });
  }
  assert.equal((await explain({ jokeId: 1, explanation }, await cookie(false, true, "limited@example.com"))).status, 429, "Accepted and rejected explanations count toward the daily limit");
  assert.equal((await explain({ jokeId: 999_999, explanation }, valid)).status, 404);
  assert.equal(claudeRequests, 0);

  // A rejected explanation is recorded but leaves the joke, its versions, and its ratings unchanged.
  claudeSource = "en";
  submitted = jokes.find((item) => item.id === 1)!.body;
  expectedExplanation = explanation;
  const demoVersions = adaptations.filter((row) => row.joke_id === 1).map((row) => row.id);
  claudeAccepts = false;
  const rejectedExplanation = await explain({ jokeId: 1, explanation: `  ${explanation}  ` }, valid);
  assert.equal(rejectedExplanation.status, 422);
  assert.doesNotMatch(await rejectedExplanation.text(), /claude/i);
  assert.deepEqual(explanations.filter((row) => row.user_id === userId).map((row) => [row.joke_id, row.explanation, row.accepted]), [[1, explanation, false]]);
  claudeAccepts = true;
  for (const [mode, status] of [["unsuitable", 422], ["refusal", 422], ["partial", 502], ["error", 502], ["malformed", 502]] as const) {
    claudeMode = mode;
    assert.equal((await explain({ jokeId: 1, explanation }, valid)).status, status, `${mode} re-adaptation`);
  }
  assert.equal(explanations.filter((row) => row.user_id === userId).length, 1, "Only a rejected explanation records a row before success");
  const unchanged = jokes.find((item) => item.id === 1)!;
  assert.deepEqual([unchanged.explanation, unchanged.explanation_source, unchanged.adult], [null, null, false]);
  assert.deepEqual(adaptations.filter((row) => row.joke_id === 1).map((row) => row.id), demoVersions);
  assert.equal(ratings.filter((row) => row.adaptation_id === 2).length, 1);

  // An accepted explanation replaces all three versions, resets their ratings, and is credited on the card.
  claudeMode = "ok";
  claudeAdult = true;
  rememberedPhotos.clear();
  const readapted = await explain({ jokeId: 1, explanation: `  ${explanation}  ` }, stranger);
  assert.equal(readapted.status, 200);
  assert.equal(readapted.headers.get("cache-control"), "private, no-store");
  const readaptedText = await readapted.text();
  assert.ok(!readaptedText.includes(apiKey));
  const readaptedJoke = JSON.parse(readaptedText) as Joke;
  assert.equal(readaptedJoke.id, 1);
  assert.equal(readaptedJoke.body, submitted, "The original joke text never changes");
  assert.deepEqual([readaptedJoke.explanation, readaptedJoke.explanation_source, readaptedJoke.adult], [explanation, "community", true]);
  assert.ok(!JSON.stringify(readaptedJoke).includes("Joke Check"), "A community explanation never reveals who wrote it");
  assert.deepEqual(readaptedJoke.adaptations.map((adaptation) => adaptation.audience), ["en", "es", "zh"]);
  assert.deepEqual(readaptedJoke.adaptations.map((adaptation) => adaptation.body), ["en version", "es version", "zh version"]);
  assert.ok(readaptedJoke.adaptations.every((adaptation) => !demoVersions.includes(adaptation.id)), "Every version is replaced");
  assert.equal(readaptedJoke.revealed, false, "The stranger's earlier rating was reset with the old versions");
  assert.ok(!hasCounts(readaptedJoke));
  assert.equal(ratings.filter((row) => demoVersions.includes(row.adaptation_id)).length, 0);
  assert.deepEqual(explanations.filter((row) => row.user_id === digest("other@example.com")).map((row) => [row.joke_id, row.accepted]), [[1, true]]);
  assert.equal(rememberedPhotos.get(digest("other@example.com")), googlePhoto);
  assert.deepEqual((await list()).find((item) => item.id === 1)!.explanation, explanation);
  assert.equal(claudeRequests, 7);
  expectedExplanation = null;
  claudeAdult = false;
  claudeRequests = 0;

  // Every AI request is logged with its chain, account, status, and joke; every model call with its step and usage.
  const requestLog = (purpose: string) => generationRequests.filter((row) => row.purpose === purpose);
  assert.equal(requestLog("preview").length, 9, "Every punchline preview is logged, including failed ones");
  assert.ok(requestLog("preview").every((row) => row.chain_id === 1 && row.user_id === userId && row.source === "share" && row.completed_at));
  assert.deepEqual(requestLog("preview").at(-1), {
    ...requestLog("preview").at(-1), input: fridgeJoke, locale: "es", status: "succeeded",
  });
  const shared = requestLog("adaptation").find((row) => row.status === "succeeded" && row.source === "share");
  assert.ok(shared && typeof shared.joke_id === "number" && jokes.some((item) => item.id === shared.joke_id), "A shared joke is linked to its request");
  assert.ok(requestLog("adaptation").some((row) => row.status === "unsuitable"));
  assert.ok(requestLog("adaptation").some((row) => row.status === "rejected" && row.source === "explanation" && row.joke_id === 1));
  const failedRequest = requestLog("adaptation").find((row) => row.status === "failed" && /529/.test(String(row.error)));
  assert.ok(failedRequest, "A failed request keeps the reason");
  assert.equal(generationRequests.filter((row) => row.status === "pending").length, 0, "Every request is finished");
  assert.equal(llmResponses.length, generationRequests.length, "The seeded chains make one model call per request");
  const failedCall = llmResponses.find((row) => row.request_id === failedRequest.id)!;
  assert.deepEqual([failedCall.status, failedCall.http_status, failedCall.kind, failedCall.model], ["failed", 529, "adaptation", "claude-haiku-5-5"]);
  const sharedCall = llmResponses.find((row) => row.request_id === shared.id)!;
  assert.deepEqual([sharedCall.status, sharedCall.step_id, sharedCall.model_id, sharedCall.input_tokens, sharedCall.output_tokens, sharedCall.stop_reason],
    ["succeeded", 2, 1, 120, 340, "end_turn"]);
  assert.match(String(sharedCall.prompt), /^<joke>\n/);
  assert.equal((sharedCall.answer as { suitable: boolean }).suitable, true, "The model's JSON answer is kept");
  assert.ok(llmResponses.some((row) => row.status === "refused"), "Refusals are logged as such");

  // Glossary terms found in the joke (English terms as whole words) and the reference examples reach the model.
  const chainMember = await cookie(false, true, "chain-check@example.com");
  const loggedBefore = generationRequests.length;
  glossary = [
    { term: "therapist", language: "en", definition: "A counselor people talk to.", example: null },
    { term: "venge", language: "en", definition: "Never sent: only part of a word in this joke.", example: null },
    { term: "躺平", language: "zh", definition: "Lying flat: opting out.", example: "我躺平了。" },
  ];
  examples = [{ source_language: "en", en: "Original.", es: "Versión.", zh: "版本。", explanation: null, notes: "Kept the pun." }];
  submitted = joke;
  expectedGlossary = "- therapist (en): A counselor people talk to.";
  expectedExamples = true;
  assert.equal((await share({ body: joke }, chainMember)).status, 201);
  assert.match(String(llmResponses.at(-1)!.prompt), /<glossary>\n- therapist \(en\)/);
  expectedLanguage = "English";
  assert.equal((await analyze({ body: joke, locale: "en" }, chainMember)).status, 200, "Previews get the glossary but no examples");
  glossary = [];
  examples = [];
  expectedGlossary = null;
  expectedExamples = false;

  // The mix picks the chain; its steps set the model and effort. "Read first" reads the punchline itself when nobody
  // explained the joke (a reading that is never rejected or stored), and skips that step when a member did.
  chains.adaptation[0].weight = 0;
  chains.adaptation[2].weight = 100;
  for (const item of chains.adaptation[2].steps) Object.assign(item, { model: "claude-sonnet-5-5", effort: "high" });
  expectedModel = "claude-sonnet-5-5";
  expectedEffort = "high";
  expectedExplanation = "We hear a pun.";
  claudeAccepts = false;
  const before = claudeRequests;
  const readFirst = await share({ body: joke }, chainMember);
  assert.equal(readFirst.status, 201);
  assert.equal(claudeRequests - before, 2, "Reading the punchline, then adapting");
  assert.equal(((await readFirst.json()) as Joke).explanation, null, "The chain's own reading is not stored as the author's explanation");
  claudeAccepts = true;
  expectedExplanation = explanation;
  assert.equal((await share({ body: joke, explanation }, chainMember)).status, 201);
  assert.equal(claudeRequests - before, 3, "A member's explanation replaces the reading step");
  const chainLog = generationRequests.slice(loggedBefore + 2);
  assert.deepEqual(chainLog.map((row) => [row.chain_id, row.status]), [[4, "succeeded"], [4, "succeeded"]]);
  assert.deepEqual(llmResponses.filter((row) => row.request_id === chainLog[0].id).map((row) => [row.step_id, row.kind, row.model, row.effort]),
    [[4, "analysis", "claude-sonnet-5-5", "high"], [5, "adaptation", "claude-sonnet-5-5", "high"]]);
  expectedExplanation = null;

  // Before the migration is applied, requests run the built-in defaults; a failing log never fails a member.
  chains = null;
  expectedModel = "claude-haiku-5-5";
  expectedEffort = "medium";
  assert.equal((await share({ body: joke }, chainMember)).status, 201);
  assert.equal(generationRequests.at(-1)!.chain_id, null);
  chains = seededChains();

  // Unknown versions and missing configuration.
  assert.equal((await rate({ adaptationId: 999_999, funny: true }, valid)).status, 404);
  assert.equal((await withdraw({ adaptationId: 999_999 }, valid)).status, 404);
  delete process.env.SUPABASE_SECRET_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  assert.equal((await share({ body: joke }, valid)).status, 503);
  assert.equal((await rate({ adaptationId: 1, funny: true }, valid)).status, 503);
  assert.equal((await explain({ jokeId: 1, explanation }, valid)).status, 503);
  assert.equal((await jokesRoute.GET(new Request(`${origin}/api/jokes`))).status, 503);
  console.log("PASS: Joke feed with origins and localized commentary, blind totals, one Claude request per joke, prompt chains from the mix with their models and effort, glossary terms and reference examples, request and model-call logs, the built-in chain before the migration, source language detection, partially invalid and failed adaptation, unsuitable and unsupported-language jokes, daily limit, ratings and withdrawal, punchline analysis in the reader's language, sharing with an explanation, adult jokes flagged 18+, community explanations (rejected, limited, unknown, and accepted re-adaptation with reset ratings), guest/expired/tampered/unverified sessions, CSRF, invalid input, unknown versions, and missing configuration.");
} finally {
  globalThis.fetch = originalFetch;
}
