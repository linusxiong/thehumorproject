# The Humor Project

A small humor collection built with Next.js App Router, HeroUI v3, and Supabase. The home page reads real database rows and supports category filters, search, refresh, loading placeholders, empty states, and error recovery.

The interface is built from HeroUI components with only layout utilities on top; `app/globals.css` sets just the brand accent and fonts. Light and dark themes follow the operating system automatically: an inline script in `app/layout.tsx` sets `data-theme` on `<html>` before the first paint and updates it when the system setting changes. HeroUI components are imported only from Client Components, because the HeroUI package cannot be imported from Server Components in webpack builds.

## Local development

```sh
bun install
```

Create `.env.local` at the repository root (ignored by Git):

```dotenv
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

The original `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` names are also supported. Legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` or `SUPABASE_ANON_KEY` values work as a fallback. `next.config.ts` maps these to the two public settings used by the browser, preferring an explicitly configured public URL and a publishable key. Database passwords, secret keys, and service-role keys are never mapped into the client configuration.

For a new database, run `supabase/seed.sql` once in the project's Supabase SQL Editor. It creates `humor_entries` and inserts nine fictional stories with randomized authors and timestamps. The transaction will fail safely if the table already exists.

The original seed script enables Row Level Security for the demo table and grants anonymous and authenticated clients read-only access. Existing projects may have different RLS settings; the voting migration does not alter them. Add stories through the SQL Editor. The UI displays database results and never silently substitutes local mock data. The current collection query loads the newest 100 stories.

```sh
bun dev
```

Open http://localhost:3000.

## Google sign-in

Authentication uses the open-source [Better Auth](https://better-auth.com/docs/integrations/next) package. It is the only additional direct dependency. The home page and demo Supabase collection remain public; `/members` validates the encrypted session on the server before rendering member content. The header shows Google sign-in for visitors. For members it shows only their avatar, which opens a menu with their name, a link to the members area, and sign-out.

Add these server-only variables to `.env.local` and to your Vercel deployment environment:

```dotenv
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
BETTER_AUTH_SECRET=your-random-secret-at-least-32-characters
OAUTH_PROXY_SECRET=another-random-secret-at-least-32-characters
BETTER_AUTH_URL=http://localhost:3000
```

Generate the session secret with `openssl rand -base64 48`. Never prefix these variables with `NEXT_PUBLIC_`, commit the downloaded Google credentials, or expose them through `next.config.ts`. For production, set `BETTER_AUTH_URL=https://sx2451.vercel.app` and use a separate random session secret.

In Google Cloud Console, configure the Web application's authorized redirect URIs:

- `http://localhost:3000/auth/callback` for local development.
- `https://sx2451.vercel.app/auth/callback` for the current production domain.

The supplied Google credential file already lists the production URI; add the localhost URI in Google Cloud before testing locally. If the OAuth consent screen is in Testing mode, add the accounts that will sign in as test users. The application explicitly sends `/auth/callback` as Google's redirect URI; its Route Handler forwards the request internally to Better Auth's Google handler without an extra browser redirect. Successful login opens `/members`; cancelled or failed login returns to `/login` with a retry option.

Sessions use Better Auth's encrypted, HttpOnly, SameSite cookies, with Secure cookies on HTTPS, and expire after 24 hours. No auth tables or database migration are required. Stateless sign-out clears this browser's cookies; it cannot centrally revoke copied sessions. Add database-backed session storage if central revocation or persistent user records become necessary. Better Auth sessions are separate from Supabase Auth and do not grant Supabase's `authenticated` database role; existing demo rows retain their public read-only policy.

### Preview deployments

Better Auth's built-in [OAuth Proxy](https://better-auth.com/docs/plugins/oauth-proxy) sends Google callbacks through production, then returns the encrypted result to the original deployment. That deployment validates its original state cookie and creates its own session. No additional package is required.

Set `BETTER_AUTH_URL=https://sx2451.vercel.app` in both Vercel Production and Preview. Give both environments the same `OAUTH_PROXY_SECRET` and Google credentials, but keep their `BETTER_AUTH_SECRET` values separate. Configure the public Supabase connection in Preview as well. Trusted origins include `http://localhost:3000`, `thehumorproject-*-xsy2004s-projects.vercel.app`, and the project's stable Vercel alias; the configured `BETTER_AUTH_URL` is trusted automatically. Google only needs the production `/auth/callback` URI, not each preview URL. Successful and cancelled sign-ins return to the domain where they started.

Redeploy both environments after changing proxy configuration. Existing immutable deployment URLs keep their old code and secrets; use a new deployment URL to test. Local development retains direct Google OAuth with `BETTER_AUTH_URL=http://localhost:3000` and its own random proxy secret.

Run `bun run check:oauth-proxy` for an offline integration check with separate production/preview session secrets, the real proxy plugin, and a stub Google provider. It checks successful round trips, callback errors, cookie binding, untrusted origins, tampered payloads, and expired payloads without contacting Google or creating production users.

To protect another page, check `await auth.api.getSession({ headers: await headers() })` on the server before returning private content and redirect missing sessions to `/login`, as in `app/members/page.tsx`. Independently check sessions in any future private Route Handler or Server Action. Client UI visibility is not an authorization boundary.

With `bun dev` running at `http://localhost:3000`, run `bun run check:auth`. The local check covers valid, expired and tampered sessions, protected rendering, callback URI, PKCE, callback errors, external redirect rejection, CSRF and sign-out. It uses synthetic local sessions and does not log into a real Google account; complete a browser sign-in after configuring Google's allowed localhost callback.

## Checks

### Caption voting

Apply the SQL files in `supabase/migrations` in order after creating `humor_entries`. Each story's punchline is its caption, so `caption_votes.caption_id` references `humor_entries.id`. Each verified account can submit one upvote (`1`) or downvote (`-1`) per caption, enforced by a database unique constraint. Click the selected arrow to withdraw a vote, then choose either arrow to vote again. Only the authenticated account's own vote can be withdrawn. To avoid biasing ratings, the card footer shows only arrow icons until the signed-in account has voted on that caption; real upvote and downvote totals appear after the vote is saved and hide again if the vote is withdrawn. The selected arrow updates immediately while saving and reconciles with the database afterward.

For an existing project linked with the Supabase CLI, apply pending migrations with `supabase db push`. The voting migrations have already been applied to this project's database and recorded in its migration history. Run `supabase db query --linked --file scripts/check-votes.sql` to verify real inserts, foreign keys, allowed vote values, table privileges, and disabled RLS; the check rolls back its test rows.

Configure `SUPABASE_SECRET_KEY` (or the legacy `SUPABASE_SERVICE_ROLE_KEY`) in `.env.local` and in the applicable Vercel environments. Restart the local server or redeploy after configuration. This key is server-only and must never use a `NEXT_PUBLIC_` prefix. Vercel environment settings do not automatically populate `.env.local`.

The vote table leaves RLS disabled as requested. Table privileges deny `anon` and `authenticated` direct access; `/api/caption-votes` checks the request origin and Better Auth session before inserting through the server-only Supabase client. The voter ID is a SHA-256 digest of the verified session's normalized email, never client input, so a new stateless login does not reset voting eligibility. Historical session IDs are bound to this stable identity when their original authenticated session next loads or submits votes; old IDs whose sessions are already lost cannot be attributed retroactively. Existing repeated submissions are preserved in the private `caption_vote_duplicates` archive; only the first vote counts. The count endpoint returns the current account's own vote, and aggregate totals only once that account has voted; guests and accounts that have not voted never receive totals. It never returns voter identities.

Run `bun run check:votes` for an offline route integration check using real encrypted sessions and a stub database. For a live smoke test, sign in, vote on a caption, and confirm a new row in `caption_votes` with that caption ID, user ID, and vote. Guests see disabled voting buttons, and unauthenticated POST requests are rejected.

With `bun dev` running and the local server key configured, `bun run check:votes:live` verifies the real HTTP-to-database flow with a synthetic local session, checks duplicate submissions (including concurrent requests and a new session for the same account), withdrawal ownership, and voting again after withdrawal, then removes only its uniquely identified test votes.

```sh
bun run lint
bun run check:votes
bun run check:avatar
bun run check:supabase
bun run build
```

The Supabase check covers environment aliases, rejection of private keys, the live read-only connection, seeded records, filters, and request cancellation. Environments that restrict Turbopack's internal ports can validate with `bun run build --webpack`.

### Profile photos

Members choose their avatar on `/members`: the photo from their Google account (the default) or a photo they upload. The header shows the chosen avatar, falling back to initials when no photo is available. Switching between the two options keeps the uploaded photo; uploading a new photo replaces it, and **Delete uploaded photo** removes it from storage and returns to the Google photo.

Before uploading, the browser crops the image to a centered square and resizes it to at most 512 × 512 pixels. `/api/avatar` then checks the request origin and Better Auth session, accepts files up to 2 MB, and identifies JPEG, PNG, or WebP from the file's leading bytes rather than its name or declared type. Photos are stored in the public `avatars` Supabase Storage bucket under random object names, so URLs reveal nothing about the member and the bucket cannot be listed. Preferences live in `user_profiles`, keyed by the same email digest as caption votes; RLS is enabled with no policies, and table privileges allow only the server-only key. The `replace_avatar` function swaps or clears the photo atomically and returns the previous object for cleanup.

Apply `supabase/migrations/202610120001_user_avatars.sql` with `supabase db push`; it creates the table, function, and bucket. The feature uses the same `SUPABASE_SECRET_KEY` as voting. Run `bun run check:avatar` for an offline route integration check with real encrypted sessions and stub database and storage services. After applying the migration, with `bun dev` running and the server key configured, `bun run check:avatar:live` verifies the real HTTP, database, and storage flow with a synthetic local session: browser-key denial, bucket type limits, public photo URLs, replacement and concurrent-upload cleanup, source switching, and deletion. It then removes its test profile and photos.

## Vercel

Select **Next.js** as the Framework Preset, leave Root Directory empty, and keep the default build settings. The Vercel Supabase integration supplies `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`; no duplicate public variables are required. Alternatively, add either supported naming pair to the required deployment environments (Production / Preview). Next.js embeds the public connection settings at build time, so changing them requires a new build and deployment.

All project content is in English. Follow [AGENTS.md](./AGENTS.md) for project and commit conventions.
