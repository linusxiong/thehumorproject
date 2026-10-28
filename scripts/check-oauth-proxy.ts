import assert from "node:assert/strict";
import { betterAuth } from "better-auth";
import { symmetricDecrypt, symmetricEncrypt } from "better-auth/crypto";

// All requests stay in-process; these test keys never reach a deployed environment.
const productionURL = "https://sx2451.vercel.app";
const previewURL = "https://thehumorproject-test-xsy2004s-projects.vercel.app";
Object.assign(process.env, {
  BETTER_AUTH_URL: productionURL,
  BETTER_AUTH_SECRET: crypto.randomUUID() + crypto.randomUUID(),
  OAUTH_PROXY_SECRET: crypto.randomUUID() + crypto.randomUUID(),
  GOOGLE_CLIENT_ID: "test-client",
  GOOGLE_CLIENT_SECRET: "test-secret",
});
const { auth: production } = await import("../lib/auth");
const { GET: callback } = await import("../app/auth/callback/route");
const preview = betterAuth({ ...production.options, secret: crypto.randomUUID() + crypto.randomUUID() });
const provider = (await production.$context).socialProviders.find((item) => item.id === "google")!;
provider.validateAuthorizationCode = async ({ code, codeVerifier }) => {
  assert.equal(code, "test-code");
  assert(codeVerifier);
  return { accessToken: "test-token", scopes: ["openid", "email", "profile"] };
};
provider.getUserInfo = async () => ({
  user: { name: "Proxy Check", email: "proxy-check@example.com", emailVerified: true },
  data: { sub: "test-google-user" },
});
const cookies = (response: Response) => response.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");
async function signIn(origin = previewURL, instance = preview) {
  const response = await instance.handler(new Request(`${origin}/api/auth/sign-in/social`, {
    method: "POST", headers: { origin, "content-type": "application/json" },
    body: JSON.stringify({ provider: "google", callbackURL: `${origin}/members`, errorCallbackURL: `${origin}/login` }),
  }));
  return response;
}
const started = await signIn();
assert.equal(started.status, 200);
const google = new URL((await started.json()).url);
assert.equal(google.searchParams.get("redirect_uri"), `${productionURL}/auth/callback`);
assert.equal(google.searchParams.get("code_challenge_method"), "S256");
const state = google.searchParams.get("state")!;
const proxyState = JSON.parse(await symmetricDecrypt({ key: process.env.OAUTH_PROXY_SECRET!, data: state }));
assert.equal(proxyState.isOAuthProxy, true);
const stateCookie = cookies(started);
const denied = await callback(new Request(`${productionURL}/auth/callback?${new URLSearchParams({ state, error: "access_denied" })}`));
assert.equal(denied.headers.get("location"), `${previewURL}/login?error=access_denied`);

// Google returns to production without any preview cookies.
const exchanged = await callback(new Request(`${productionURL}/auth/callback?${new URLSearchParams({ state, code: "test-code" })}`));
assert.equal(exchanged.status, 302);
assert(!cookies(exchanged).includes("session_token="), "Production must not create the preview session.");
const completion = new URL(exchanged.headers.get("location")!);
assert.equal(completion.origin, previewURL);
assert.equal(completion.pathname, "/api/auth/callback/google/oauth-proxy");
const complete = (url: URL, cookie: string) => preview.handler(new Request(url, { headers: { cookie } }));
const failure = (response: Response, error: string) => {
  assert.equal(response.status, 302);
  assert.equal(new URL(response.headers.get("location")!, previewURL).searchParams.get("error"), error);
  assert(!cookies(response).includes("session_token="));
};
failure(await complete(completion, ""), "state_mismatch");
failure(await complete(completion, cookies(await signIn())), "state_mismatch");
const tampered = new URL(completion);
tampered.searchParams.set("profile", `invalid${completion.searchParams.get("profile")}`);
failure(await complete(tampered, stateCookie), "invalid_profile");
const expired = new URL(completion);
const payload = JSON.parse(await symmetricDecrypt({ key: process.env.OAUTH_PROXY_SECRET!, data: completion.searchParams.get("profile")! }));
payload.timestamp = Date.now() - 120_000;
expired.searchParams.set("profile", await symmetricEncrypt({ key: process.env.OAUTH_PROXY_SECRET!, data: JSON.stringify(payload) }));
failure(await complete(expired, stateCookie), "payload_expired");

const completed = await complete(completion, stateCookie);
assert.equal(completed.status, 302);
assert.equal(completed.headers.get("location"), `${previewURL}/members`);
const sessionHeaders = new Headers({ cookie: cookies(completed) });
assert.equal((await preview.api.getSession({ headers: sessionHeaders }))?.user.email, "proxy-check@example.com");
assert.equal(await production.api.getSession({ headers: sessionHeaders }), null, "Session secrets remain isolated.");
assert(completed.headers.getSetCookie().some((value) => value.includes("session_token=") && /HttpOnly/i.test(value) && /Secure/i.test(value)));
for (const origin of ["https://evil.vercel.app", "https://other-app-test-xsy2004s-projects.vercel.app", `${previewURL}.evil.example`]) {
  assert.equal((await signIn(origin)).status, 403, `Reject untrusted origin: ${origin}`);
}
const direct = new URL((await (await signIn(productionURL, production)).json()).url);
assert.equal(direct.searchParams.get("redirect_uri"), `${productionURL}/auth/callback`);
await assert.rejects(symmetricDecrypt({ key: process.env.OAUTH_PROXY_SECRET!, data: direct.searchParams.get("state")! }));
const local = await signIn("http://localhost:3000");
assert.equal(local.status, 200);
const localState = new URL((await local.json()).url).searchParams.get("state")!;
const localDenied = await callback(new Request(`${productionURL}/auth/callback?${new URLSearchParams({ state: localState, error: "access_denied" })}`));
assert.equal(localDenied.headers.get("location"), "http://localhost:3000/login?error=access_denied");

// The sign-up gate from the admin area: while signup_allowed refuses the account, both direct and proxied sign-ins
// return to /login with signup_not_allowed and create no session.
Object.assign(process.env, { SUPABASE_URL: "https://access.example.test", SUPABASE_SECRET_KEY: "sb_secret_test_only" });
let allowed = false;
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.origin !== "https://access.example.test") return realFetch(input, init);
  assert.equal(url.pathname, "/rest/v1/rpc/signup_allowed");
  return Response.json(JSON.parse(String(init?.body)).p_email === "proxy-check@example.com" && allowed);
}) as typeof fetch;
async function directSignIn() {
  const begun = await signIn(productionURL, production);
  const directState = new URL((await begun.json()).url).searchParams.get("state")!;
  return callback(new Request(`${productionURL}/auth/callback?${new URLSearchParams({ state: directState, code: "test-code" })}`, { headers: { cookie: cookies(begun) } }));
}
async function proxiedSignIn() {
  const begun = await signIn();
  const proxied = new URL((await begun.json()).url).searchParams.get("state")!;
  const handoff = await callback(new Request(`${productionURL}/auth/callback?${new URLSearchParams({ state: proxied, code: "test-code" })}`));
  return complete(new URL(handoff.headers.get("location")!), cookies(begun));
}
for (const [attempt, origin] of [[directSignIn, productionURL], [proxiedSignIn, previewURL]] as const) {
  allowed = false;
  const refused = await attempt();
  const target = new URL(refused.headers.get("location")!, origin);
  assert.equal(`${target.origin}${target.pathname}`, `${origin}/login`);
  assert.equal(target.searchParams.get("error"), "signup_not_allowed");
  assert(!cookies(refused).includes("session_token="));
  allowed = true;
  const admitted = await attempt();
  assert.equal(admitted.headers.get("location"), `${origin}/members`);
  assert(cookies(admitted).includes("session_token="));
}
globalThis.fetch = realFetch;
console.log("PASS: Proxy round trip with separate session keys, custom callback, original-browser binding, cancellation, tampered/expired profiles, trusted origins, direct production OAuth, and the sign-up gate on direct and proxied sign-ins.");
