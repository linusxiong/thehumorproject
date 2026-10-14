# Punchline Passport

A cross-cultural joke lab built with Next.js App Router, HeroUI v3, Supabase, and Claude. Members share a joke in English, Spanish, or Chinese; Claude adapts it for English-, Spanish-, and Chinese-speaking audiences while keeping the core punchline, and readers rate whether each version is still funny.

Brand: jokes travel across borders and get stamped. The logo mark, app icon (`app/icon.png`), hero, and per-language spot illustrations in `public/brand/` were generated with the Codex CLI image generation feature.

The interface is built from HeroUI components with only layout utilities on top; `app/globals.css` sets just the brand accent and fonts. Light and dark themes follow the operating system automatically: an inline script in `app/layout.tsx` sets `data-theme` on `<html>` before the first paint and updates it when the system setting changes. HeroUI components are imported only from Client Components, because the HeroUI package cannot be imported from Server Components in webpack builds.

## Jokes across cultures

The home page is the whole app. A signed-in member with a verified email submits a joke in English, Spanish, or Chinese (10–600 characters). `/api/jokes` sends one request to Claude (model `claude-haiku-5-5`) that detects the source language and returns all three versions at once: English for the English-speaking world, Spanish for the Spanish-speaking world, and Chinese for Mainland China. The request uses JSON outputs (`output_config.format` with a JSON schema) rather than a forced tool call, so adaptive thinking stays on: the model first works out the comic mechanism and every culture-specific reference, then picks an equivalent each audience actually knows, and the grammar guarantees the final answer matches the schema. The version in the source language keeps the member's wording (only obvious typos are fixed); the other two aim for 信达雅: faithful to the comic mechanism, natural for a native reader, with the timing intact. References a reader would not recognize are swapped for local equivalents that trigger the same twist (for example, a joke about Lu Xun's pen name becomes one about Mark Twain in English and Pablo Neruda in Spanish), and puns are rebuilt with native wordplay. Every version carries localized commentary as `{en, es, zh}` objects: `gloss` (a faithful translation of that version into each interface language, equal to the body in its own language), `punchline_core` (one sentence naming the comic mechanism), and `notes` (one sentence naming what changed, including every substitution). The **Compare** tab shows the three adapted versions side by side, each in its own language, with its core punchline underneath in the reader's language, so readers can see whether the punchline survived. Commentary is written in the platform's own voice; the website never mentions the model. Submissions that are not self-contained jokes or humorous anecdotes (including comments and replies), that are hateful, harassing, or sexually explicit, that the model refuses, or that are written in another language are rejected with 422. Versions with missing or oversized fields are dropped and the rest are saved; if the request fails or no version is valid, nothing is stored (502). Live submissions use `medium` effort and usually take 15–30 seconds (the route allows 120 s); imports use `high`. Each account can share up to 10 jokes per 24 hours. `lib/claude.ts` exports the request body (`adaptationParams`) and the response parser (`parseAdaptation`) separately so the import script can send the exact same request through the Message Batches API.

The interface is available in English, Spanish, and Chinese, and the interface language is also the reader's language background: one choice (in the header or above the feed) translates every screen and decides which version of each joke opens first. On a first visit it follows the browser's preferred languages; the choice is then saved in `localStorage`. The server renders English and the client switches right after hydration. `app/locale.ts` holds the locale store and shared names; each component keeps its English text with Spanish and Chinese translations in a colocated `Messages` object, and `app/api-errors.ts` turns API status codes into localized messages. Joke versions are shown as written; their commentary follows the interface language and falls back to English for entries that predate localized commentary. Signed-in readers answer **Still funny?** for each version; selecting the chosen answer again withdraws it. To avoid biasing ratings, totals stay hidden until the account has rated any version of that joke, and hide again when all its ratings are withdrawn. Guests can read jokes but cannot submit or rate.

The feed loads up to 200 jokes at once, so filters (All / Members / Qiushibaike / Demo) and ordering always cover the whole collection. **Recommended** (the default) shows jokes in a random order, drawn again on every load, refresh, and each time Recommended is chosen; jokes shared during the visit appear first. **Newest** orders by date, and **Most rated** counts only totals the viewer is allowed to see, so the order never reveals hidden ratings.

`jokes`, `joke_adaptations`, and `adaptation_ratings` have RLS enabled with no policies; only the server-only key has access, through the `joke_feed` and `create_joke` functions and the Route Handlers, which check the request origin and the Better Auth session. Ratings are keyed by a SHA-256 digest of the verified session's normalized email, never client input. `ANTHROPIC_API_KEY` is read only in `lib/claude.ts` and is never logged or returned to the browser; without it, browsing and rating still work, but submissions return 503. Every joke records its `source_language` and an `origin`: `demo` (seeded by the migrations), `member` (shared on the site; the only origin with an author account), or `import` (bulk-imported posts, credited through `source_label`, such as `Qiushibaike`, with the original username as the author name).

## Importing Qiushibaike posts

The archive is the public Hugging Face dataset [`qiushibaike-bak/metadata`](https://huggingface.co/datasets/qiushibaike-bak/metadata) (`articles.bson.gz`, December 2022; no license stated). `/terms` (linked in the footer and from each imported joke's Qiushibaike chip) discloses the source, that authors are credited by their original usernames, that displayed dates are import dates rather than original posting dates, that copyright stays with the authors, and how to request removal.

`bun run import:qiushibaike [posts.json] [--batch <id> ...]` imports 100 popular posts from the Qiushibaike archive and re-adapts the demo jokes so they get localized commentary. The input (default `/tmp/qb-top.json`) is `{ "best": [{ "id", "likes", "login", "content", "topic" }] }`, sorted by likes; it is extracted from the archive's `articles.bson` by a separate scan and is not committed. The script:

1. Cleans each post (control characters, leading `#topic#` hashtags, `[emoticon]` codes, extra whitespace), keeps 10–600 characters, and removes duplicates.
2. Pre-screens every candidate in chunks of 150, sent together as one Message Batch. Like adaptation, the pre-screen uses JSON outputs at `high` effort so adaptive thinking stays on (a thinking-free forced-tool screen let roughly half its picks through as comments, non-jokes, or innuendo). It keeps only complete, self-contained, family-friendly jokes and funny anecdotes and rejects comments and replies, announcements, greetings and like-begging, personal ads, sad or serious posts, anything relying on sex or sexual innuendo, hate, and personal data. Decisions are cached per post in `/tmp/qb-import/prescreen-decisions.json`, and posts the adaptation step later judges unsuitable are recorded there too, so no post is paid for twice.
3. Sends the `adaptationParams` request (at `high` effort) for the 100 most-liked accepted posts, plus every demo joke whose commentary is not yet localized, as one [Message Batch](https://docs.anthropic.com/en/docs/build-with-claude/batch-processing), which costs 50% of the regular price. The adaptation step checks again that each post is a self-contained joke. It polls every 20 seconds until the batch ends, downloads the JSONL results, and parses them with `parseAdaptation`; only results with all three versions are stored. If fewer than 100 posts succeed, it submits one more batch for exactly the shortfall from the next accepted candidates, until 100 are imported or candidates run out.
4. Stores each post with `create_joke` as origin `import`, source label `Qiushibaike`, the original username, and a random timestamp within the last 30 days. Each demo joke is stored again with its original text and timestamp, and the old row (with its ratings) is deleted only after the new one is saved.

The pre-screen decision, batch ids, and raw batch results are saved in `/tmp/qb-import/`. If a run stops, rerun with `--batch <id>` (printed when the batch is created) to reuse that batch's results without paying again. Reruns are idempotent: posts whose text is already imported are skipped and count toward the 100, and demos that already have localized commentary are not re-adapted. The script prints a summary of requests sent, batch ids, inserted jokes, and rejections. It needs `ANTHROPIC_API_KEY` and the server-only Supabase key in `.env.local`.

## Local development

```sh
bun install
```

Create `.env.local` at the repository root (ignored by Git):

```dotenv
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=your-server-only-secret-key
ANTHROPIC_API_KEY=your-anthropic-api-key
```

`NEXT_PUBLIC_SUPABASE_URL` is also accepted for the URL, and the legacy `SUPABASE_SERVICE_ROLE_KEY` for the secret key. All of these are server-only: never prefix the keys with `NEXT_PUBLIC_`. `bun run check:avatar:live` additionally reads `SUPABASE_PUBLISHABLE_KEY` to confirm that browser keys are denied. Vercel environment settings do not automatically populate `.env.local`; restart the local server after changing it.

For a new database, run `supabase/seed.sql` once in the Supabase SQL Editor, then apply `supabase/migrations` in order (`supabase db push` for a project linked with the Supabase CLI). The seed and the `2026092800*` migrations create the original humor collection and caption votes tables; they stay only because the migration history builds on them, and `202610150002_drop_legacy_humor.sql` drops those tables and the `caption_vote_summary` function again. `202610140001_cross_cultural_jokes.sql` creates the jokes tables and the four demo jokes; `202610150001_multilingual_jokes.sql` adds source languages, origins, and localized commentary; `202610150003_author_avatars.sql` adds `user_profiles.google_url`, the author avatar fields in `joke_feed`, and the `my_ratings` function. After all migrations the public schema holds `jokes`, `joke_adaptations`, `adaptation_ratings`, and `user_profiles`.

```sh
bun dev
```

Open http://localhost:3000.

## Google sign-in

Authentication uses the open-source [Better Auth](https://better-auth.com/docs/integrations/next) package. It is the only additional direct dependency. Reading jokes is public; sharing and rating require a session, which every Route Handler verifies on the server. `/members` validates the encrypted session on the server before rendering member content. The header shows Google sign-in for visitors. For members it shows only their avatar, which opens a menu with their name, a link to the members area, and sign-out.

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

The supplied Google credential file already lists the production URI; add the localhost URI in Google Cloud before testing locally. If the OAuth consent screen is in Testing mode, add the accounts that will sign in as test users. The application explicitly sends `/auth/callback` as Google's redirect URI; its Route Handler forwards the request internally to Better Auth's Google handler without an extra browser redirect. Successful login returns to the home page; cancelled or failed login returns to `/login` with a retry option.

Sessions use Better Auth's encrypted, HttpOnly, SameSite cookies, with Secure cookies on HTTPS, and expire after 24 hours. No auth tables or database migration are required. Stateless sign-out clears this browser's cookies; it cannot centrally revoke copied sessions. Add database-backed session storage if central revocation or persistent user records become necessary. Better Auth sessions are separate from Supabase Auth and do not grant Supabase's `authenticated` database role.

### Preview deployments

Better Auth's built-in [OAuth Proxy](https://better-auth.com/docs/plugins/oauth-proxy) sends Google callbacks through production, then returns the encrypted result to the original deployment. That deployment validates its original state cookie and creates its own session. No additional package is required.

Set `BETTER_AUTH_URL=https://sx2451.vercel.app` in both Vercel Production and Preview. Give both environments the same `OAUTH_PROXY_SECRET` and Google credentials, but keep their `BETTER_AUTH_SECRET` values separate. Configure the public Supabase connection in Preview as well. Trusted origins include `http://localhost:3000`, `thehumorproject-*-xsy2004s-projects.vercel.app`, and the project's stable Vercel alias; the configured `BETTER_AUTH_URL` is trusted automatically. Google only needs the production `/auth/callback` URI, not each preview URL. Successful and cancelled sign-ins return to the domain where they started.

Redeploy both environments after changing proxy configuration. Existing immutable deployment URLs keep their old code and secrets; use a new deployment URL to test. Local development retains direct Google OAuth with `BETTER_AUTH_URL=http://localhost:3000` and its own random proxy secret.

Run `bun run check:oauth-proxy` for an offline integration check with separate production/preview session secrets, the real proxy plugin, and a stub Google provider. It checks successful round trips, callback errors, cookie binding, untrusted origins, tampered payloads, and expired payloads without contacting Google or creating production users.

To protect another page, check `await auth.api.getSession({ headers: await headers() })` on the server before returning private content and redirect missing sessions to `/login`, as in `app/members/page.tsx`. Independently check sessions in any future private Route Handler or Server Action. Client UI visibility is not an authorization boundary.

With `bun dev` running at `http://localhost:3000`, run `bun run check:auth`. The local check covers valid, expired and tampered sessions, protected rendering, callback URI, PKCE, callback errors, external redirect rejection, CSRF and sign-out. It uses synthetic local sessions and does not log into a real Google account; complete a browser sign-in after configuring Google's allowed localhost callback.

## Checks

```sh
bun run lint
bun run check:jokes
bun run check:avatar
bun run build
```

`bun run check:jokes` is an offline route integration check with real encrypted sessions and stub database and Claude services; it does not call Anthropic. It covers the feed with origins and localized commentary, blind totals, exactly one Claude request per submission (model, JSON-schema output, effort, and API key), source language detection, partially invalid and failed adaptation (HTTP errors, malformed JSON, truncated output, no valid version), unsuitable, refused, and unsupported-language submissions, the daily limit, rating and withdrawal, guest/expired/tampered/unverified sessions, CSRF, invalid input, unknown versions, and missing configuration. Environments that restrict Turbopack's internal ports can validate with `bun run build --webpack`.

### Profile photos

Members choose their avatar in the personal center (`/members`, linked from the account menu): the photo from their Google account (the default) or a photo they upload. The header shows the chosen avatar, falling back to initials when no photo is available. Switching between the two options keeps the uploaded photo; uploading a new photo replaces it, and **Delete uploaded photo** removes it from storage and returns to the Google photo.

The same avatar appears next to every joke a member shares. Because sessions are stateless, the server remembers each member's current Google photo in `user_profiles.google_url` whenever the header loads their profile and whenever they share a joke; `joke_feed` joins the author's profile and the feed returns a single `author_avatar_url` (the uploaded photo if chosen, otherwise the Google photo), never the author's id. Imported and demo jokes show initials.

The personal center starts with **Your jokes**: every joke the account shared, newest first, with analytics. A summary shows jokes shared, ratings received, the overall still-funny share, and the culture the jokes travel best to (highest share, ties broken by more ratings), followed by a still-funny meter per culture across all jokes. Each joke then shows its original, a meter and still-funny / not-funny counts per version, and a disclosure with the three versions. Authors always see their own full totals: the blind-total rule keeps readers from being swayed before they vote, not authors from reviewing results. `/api/my-jokes` returns them through the `my_jokes` function (`202610150004_my_jokes.sql`) for the verified account only.

Below it, **Your ratings** lists every version the account has rated, newest first, with the answer, the version's language and text, the original joke, and how many of the account's ratings were "still funny". `/api/my-ratings` returns them through the `my_ratings` function for the verified account only.

The **Still funny** and **Not funny** buttons carry face icons (`app/rating-icons.tsx`) and turn green or red when chosen. Picking an answer plays a short animation: the laughing face bounces and a copy floats up, while the meh face shakes its head. The keyframes are the only additions to `app/globals.css`, and they are skipped when the reader prefers reduced motion.

Before uploading, the browser crops the image to a centered square and resizes it to at most 512 × 512 pixels. `/api/avatar` then checks the request origin and Better Auth session, accepts files up to 2 MB, and identifies JPEG, PNG, or WebP from the file's leading bytes rather than its name or declared type. Photos are stored in the public `avatars` Supabase Storage bucket under random object names, so URLs reveal nothing about the member and the bucket cannot be listed. Preferences live in `user_profiles`, keyed by the same email digest as joke ratings; RLS is enabled with no policies, and table privileges allow only the server-only key. The `replace_avatar` function swaps or clears the photo atomically and returns the previous object for cleanup.

Apply `supabase/migrations/202610120001_user_avatars.sql` with `supabase db push`; it creates the table, function, and bucket. The feature uses the same `SUPABASE_SECRET_KEY` as jokes. Run `bun run check:avatar` for an offline route integration check with real encrypted sessions and stub database and storage services. After applying the migration, with `bun dev` running and the server key configured, `bun run check:avatar:live` verifies the real HTTP, database, and storage flow with a synthetic local session: browser-key denial, bucket type limits, public photo URLs, replacement and concurrent-upload cleanup, source switching, and deletion. It then removes its test profile and photos.

## Vercel

Select **Next.js** as the Framework Preset, leave Root Directory empty, and keep the default build settings. The Vercel Supabase integration supplies `SUPABASE_URL`; add `SUPABASE_SECRET_KEY`, `ANTHROPIC_API_KEY`, and the auth variables to the required deployment environments (Production / Preview). All of them are read only on the server, so nothing is embedded in the browser bundle.

All project content is in English. Follow [AGENTS.md](./AGENTS.md) for project and commit conventions.
