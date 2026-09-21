import assert from "node:assert/strict";
import { makeSignature, symmetricEncodeJWT } from "better-auth/crypto";

// Run against a local `bun dev` server using the same .env.local.
const origin = process.env.BETTER_AUTH_URL!;
assert.equal(new URL(origin).hostname, "localhost", "Run auth checks locally, never against production.");
const secret = process.env.BETTER_AUTH_SECRET!;
assert(secret);
const request = (path: string, options?: RequestInit) => fetch(new URL(path, origin), { redirect: "manual", ...options });
const post = (path: string, body: unknown, cookie = "", requestOrigin = origin) => request(path, {
  method: "POST", headers: { "Content-Type": "application/json", origin: requestOrigin, cookie }, body: JSON.stringify(body),
});
const isLoginRedirect = (response: Response) => {
  assert([302, 303, 307].includes(response.status), `${response.url}: expected a redirect, got ${response.status}`);
  assert.equal(new URL(response.headers.get("location")!, origin).pathname, "/login");
};

assert.equal((await request("/")).status, 200);
isLoginRedirect(await request("/members"));
isLoginRedirect(await request("/members", { headers: { cookie: "better-auth.session_token=forged; better-auth.session_data=forged" } }));

const signIn = await post("/api/auth/sign-in/social", { provider: "google", callbackURL: "/members", errorCallbackURL: "/login" });
assert.equal(signIn.status, 200);
const google = new URL((await signIn.json()).url);
assert.equal(google.origin, "https://accounts.google.com");
assert.equal(google.searchParams.get("redirect_uri"), new URL("/auth/callback", origin).href);
assert.equal(google.searchParams.get("code_challenge_method"), "S256");
assert(google.searchParams.get("code_challenge"));
assert(google.searchParams.get("state"));
const stateCookies = signIn.headers.getSetCookie();
assert(stateCookies.some((cookie) => /httponly/i.test(cookie) && /samesite=lax/i.test(cookie)));
const cookie = stateCookies.map((value) => value.split(";")[0]).join("; ");
isLoginRedirect(await request(`/auth/callback?state=${google.searchParams.get("state")}&error=access_denied`, { headers: { cookie } }));
isLoginRedirect(await request("/auth/callback?code=fake&state=forged"));
isLoginRedirect(await request("/auth/callback?code=fake"));
assert.equal((await post("/api/auth/sign-in/social", { provider: "google", callbackURL: "https://evil.example" })).status, 403);
assert.equal((await post("/api/auth/sign-out", {}, "", "https://evil.example")).status, 403);

// Issue test-only sessions with the local secret to exercise real server authorization.
async function sessionCookie(expiresAt: Date) {
  const token = crypto.randomUUID();
  const now = new Date().toISOString();
  const encrypted = await symmetricEncodeJWT({
    session: { id: "test-session", token, userId: "test-user", expiresAt: expiresAt.toISOString(), createdAt: now, updatedAt: now },
    user: { id: "test-user", name: "Auth Check", email: "auth-check@example.com", emailVerified: true, createdAt: now, updatedAt: now },
    updatedAt: Date.now(), version: "1",
  }, secret, "better-auth-session", 300);
  return `better-auth.session_token=${encodeURIComponent(`${token}.${await makeSignature(token, secret)}`)}; better-auth.session_data=${encrypted}`;
}
const validCookie = await sessionCookie(new Date(Date.now() + 300_000));
const members = await request("/members", { headers: { cookie: validCookie } });
assert.equal(members.status, 200);
assert.match(await members.text(), /auth-check@example.com/);
assert.equal((await (await request("/api/auth/get-session", { headers: { cookie: validCookie } })).json()).user.name, "Auth Check");
isLoginRedirect(await request("/members", { headers: { cookie: validCookie.replace("session_data=", "session_data=tampered") } }));
isLoginRedirect(await request("/members", { headers: { cookie: await sessionCookie(new Date(Date.now() - 60_000)) } }));
const signOut = await post("/api/auth/sign-out", {}, validCookie);
assert.equal(signOut.status, 200);
assert(signOut.headers.getSetCookie().some((value) => value.includes("session_token=") && /max-age=0/i.test(value)));
console.log("PASS: Public home, protected members, valid/tampered/expired sessions, Google callback URI, PKCE, denied/missing/invalid OAuth state, redirect protection, CSRF, and sign-out.");
