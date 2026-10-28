import { createHash } from "node:crypto";
import { betterAuth } from "better-auth";
import { oAuthProxy } from "better-auth/plugins";
import { createServerSupabase } from "@/lib/supabase-server";

const baseURL = process.env.BETTER_AUTH_URL;
if (!baseURL || !process.env.BETTER_AUTH_SECRET || !process.env.OAUTH_PROXY_SECRET || !process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  throw new Error("Set BETTER_AUTH_URL, BETTER_AUTH_SECRET, OAUTH_PROXY_SECRET, GOOGLE_CLIENT_ID, and GOOGLE_CLIENT_SECRET.");
}

export const auth = betterAuth({
  appName: "Punchline Passport",
  baseURL,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: [
    "http://localhost:3000",
    "https://thehumorproject-*-xsy2004s-projects.vercel.app",
    "https://thehumorproject-xsy2004s-projects.vercel.app",
  ],
  plugins: [oAuthProxy({ productionURL: baseURL, secret: process.env.OAUTH_PROXY_SECRET })],
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      redirectURI: new URL("/auth/callback", baseURL).href,
      disableIdTokenSignIn: true,
    },
  },
  // Sign-up gate managed in the admin area (allowed domains and whitelisted emails); see signupAllowed.
  user: {
    validateUserInfo: async ({ user }) => {
      if (await signupAllowed(user.email, user.emailVerified === true)) return;
      return { error: "signup_not_allowed", errorDescription: "This Google account is not on the list of accounts allowed to sign in." };
    },
  },
  // ponytail: stateless sessions cannot be revoked centrally; add a database if needed.
  session: {
    expiresIn: 60 * 60 * 24,
    cookieCache: { enabled: true, strategy: "jwe", maxAge: 60 * 60 * 24, refreshCache: false },
  },
  account: { storeStateStrategy: "cookie", storeAccountCookie: false },
  onAPIError: { errorURL: "/login" },
});

// Stateless Better Auth user IDs can change; a verified email identifies returning users.
export function stableUserId(user: { email: string; emailVerified: boolean }) {
  return user.emailVerified ? createHash("sha256").update(user.email.trim().toLowerCase()).digest("hex") : null;
}

// Every Google sign-in passes through here. While the admin area lists no allowed domains and no whitelisted emails,
// everyone may sign in; otherwise only verified emails on those lists, plus superadmins. Without a database, or before
// the access migration is applied, sign-in stays open; any other database error rejects the sign-in (fails closed).
async function signupAllowed(email: unknown, emailVerified: boolean) {
  const client = createServerSupabase();
  if (!client) return true;
  const { data, error } = await client.rpc("signup_allowed", { p_email: typeof email === "string" ? email : "" })
    .abortSignal(AbortSignal.timeout(15_000));
  // PGRST202: the function does not exist yet.
  if (error?.code === "PGRST202") return true;
  if (error) throw error;
  // An unverified email proves nothing about its domain, so it only passes while sign-in is open to everyone.
  if (data !== true) return false;
  if (emailVerified) return true;
  const { data: open, error: openError } = await client.rpc("signup_allowed", { p_email: "" }).abortSignal(AbortSignal.timeout(15_000));
  if (openError) throw openError;
  return open === true;
}
