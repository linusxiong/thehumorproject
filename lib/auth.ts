import { betterAuth } from "better-auth";
import { oAuthProxy } from "better-auth/plugins";

const baseURL = process.env.BETTER_AUTH_URL;
if (!baseURL || !process.env.BETTER_AUTH_SECRET || !process.env.OAUTH_PROXY_SECRET || !process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  throw new Error("Set BETTER_AUTH_URL, BETTER_AUTH_SECRET, OAUTH_PROXY_SECRET, GOOGLE_CLIENT_ID, and GOOGLE_CLIENT_SECRET.");
}

export const auth = betterAuth({
  appName: "The Humor Project",
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
  // ponytail: stateless sessions cannot be revoked centrally; add a database if needed.
  session: {
    expiresIn: 60 * 60 * 24,
    cookieCache: { enabled: true, strategy: "jwe", maxAge: 60 * 60 * 24, refreshCache: false },
  },
  account: { storeStateStrategy: "cookie", storeAccountCookie: false },
  onAPIError: { errorURL: "/login" },
});
