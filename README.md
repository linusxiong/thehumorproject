# Punchline Passport

A cross-cultural joke lab built with Next.js App Router, HeroUI v3, Supabase, and Claude. Members share a joke in English, Spanish, or Chinese; Claude adapts it for English-, Spanish-, and Chinese-speaking audiences while keeping the core punchline, and readers rate whether each version is still funny.

Brand: jokes travel across borders and get stamped. The logo mark, app icon (`app/icon.png`), hero, and per-language spot illustrations in `public/brand/` were generated with the Codex CLI image generation feature.

The interface is built from HeroUI components with only layout utilities on top; `app/globals.css` sets just the brand accent, fonts, and the admin chart colors. Light and dark themes follow the operating system automatically: an inline script in `app/layout.tsx` sets `data-theme` on `<html>` before the first paint and updates it when the system setting changes. HeroUI components are imported only from Client Components, because the HeroUI package cannot be imported from Server Components in webpack builds.

## Jokes across cultures

The home page is the whole app. A signed-in member with a verified email shares a joke in English, Spanish, or Chinese (10–600 characters) in two steps. First, `/api/jokes/analyze` (`{ body, locale }`) reads the joke and returns a `JokeAnalysis` — `{ sourceLanguage, adult, punchline }` — where `punchline` explains in one or two sentences, in the reader's interface language, exactly what makes the joke funny, naming hidden homophones (谐音), puns, double meanings, and innuendo. No joke is stored in this step; the request itself is logged for the admin area (see [AI requests](#ai-requests-and-responses)). Second, the member confirms or edits that explanation ("why it's funny") and `/api/jokes` (`{ body, explanation? }`, explanation 5–500 characters) adapts the joke using it as the authoritative reading; the explanation is stored on the joke with `explanation_source = 'author'` and shown as the author's explanation. `/api/jokes` sends one request to Claude (model `claude-haiku-5-5`) that detects the source language and returns all three versions at once: English for the English-speaking world, Spanish for the Spanish-speaking world, and Chinese for Mainland China. The request uses JSON outputs (`output_config.format` with a JSON schema) rather than a forced tool call, so adaptive thinking stays on: the model first works out the comic mechanism and every culture-specific reference, then picks an equivalent each audience actually knows, and the grammar guarantees the final answer matches the schema. The version in the source language keeps the member's wording (only obvious typos are fixed); the other two aim for 信达雅: faithful to the comic mechanism, natural for a native reader, with the timing intact. References a reader would not recognize are swapped for local equivalents that trigger the same twist (for example, a joke about Lu Xun's pen name becomes one about Mark Twain in English and Pablo Neruda in Spanish), and puns are rebuilt with native wordplay. Every version carries localized commentary as `{en, es, zh}` objects: `gloss` (a faithful translation of that version into each interface language, equal to the body in its own language), `punchline_core` (one sentence naming the comic mechanism), and `notes` (one sentence naming what changed, including every substitution). The **Compare** tab shows the three adapted versions side by side, each in its own language, with its core punchline underneath in the reader's language, so readers can see whether the punchline survived. Commentary is written in the platform's own voice; the website never mentions the model. Both prompts tell the model to read for sound-alikes before the literal meaning: "冰箱开门说，上来自己冻" only works because "上来自己冻" sounds like "上来自己动", an innuendo, and the literal "freeze yourself" reading misses the joke.

Adult and sexual humor is allowed. The model flags such jokes `adult`, the card shows an **18+** label, and the versions keep the innuendo with an equivalent euphemism or wordplay in each language (信达雅) rather than sanitizing it or making it literal. Submissions that are not self-contained jokes or humorous anecdotes (including comments and replies), that are hateful or harassing, that involve sexual content with minors, that the model refuses, or that are written in another language are rejected with 422, by both the analysis and the adaptation; an explanation the model judges clearly unrelated to the joke or not offered in good faith is also rejected with 422. Versions with missing or oversized fields are dropped and the rest are saved; if the request fails or no version is valid, nothing is stored (502). Live submissions use `medium` effort and usually take 15–30 seconds (the route allows 120 s); imports use `high`. Each account can share up to 10 jokes per 24 hours. `lib/claude.ts` exports the request bodies (`adaptationParams`, `analysisParams`) and the response parsers (`parseAdaptation`, `parseAnalysis`) separately so the import script can send the exact same adaptation request through the Message Batches API. An explanation, when given, is sent after the joke in `<explanation>` tags, and the answer schema adds `adult` and `explanation_accepted`. Live requests go through `lib/generation.ts`, which applies the prompt chain, glossary, and reference examples configured in the admin area (see [AI configuration](#ai-configuration)); without that configuration the requests are exactly the ones described here.

### Community explanations

When a joke's versions miss the point, any signed-in member with a verified email can explain what it really means. `/api/joke-explanations` (`{ jokeId, explanation }`, 5–500 characters) re-adapts the original joke with that explanation as the authoritative reading at `medium` effort. The model double-checks that the explanation is a plausible, good-faith reading of the joke; if not, the attempt is recorded as rejected in `joke_explanations` and the joke is left unchanged (422). Otherwise the `readapt_joke` function atomically records the accepted explanation, stores it on the joke with `explanation_source = 'community'`, updates the `adult` flag, and replaces all three versions; their ratings are deleted with them, because the content readers rated has changed. The response is the updated joke (200). A result with fewer than three valid versions changes nothing (502); unknown jokes return 404. Each account can submit up to 10 explanations, accepted or rejected, per 24 hours (429). The card shows the accepted explanation labeled "From the author" or "Added by a community member" (作者说明 / 社区用户补充), never with a name; `joke_explanations` keeps only the account digest needed for the daily limit (`202610160002_anonymous_explanations.sql` replaced the earlier `explained_by` name column and dropped stored names).

The interface is available in English, Spanish, and Chinese, and the interface language is also the reader's language background: one choice (in the header or above the feed) translates every screen and decides which version of each joke opens first. On a first visit it follows the browser's preferred languages; the choice is then saved in `localStorage`. The server renders English and the client switches right after hydration. `app/locale.ts` holds the locale store and shared names; each component keeps its English text with Spanish and Chinese translations in a colocated `Messages` object, and `app/api-errors.ts` turns API status codes into localized messages. Joke versions are shown as written; their commentary follows the interface language and falls back to English for entries that predate localized commentary. Signed-in readers answer **Still funny?** for each version; selecting the chosen answer again withdraws it. To avoid biasing ratings, totals stay hidden until the account has rated any version of that joke, and hide again when all its ratings are withdrawn. Guests can read jokes but cannot submit or rate.

The feed loads up to 200 jokes at once, so filters (All / Members / Qiushibaike / Demo) and ordering always cover the whole collection. **Recommended** (the default) shows jokes in a random order, drawn again on every load, refresh, and each time Recommended is chosen; jokes shared during the visit appear first. **Newest** orders by date, and **Most rated** counts only totals the viewer is allowed to see, so the order never reveals hidden ratings.

`jokes`, `joke_adaptations`, `adaptation_ratings`, and `joke_explanations` have RLS enabled with no policies; only the server-only key has access, through the `joke_feed`, `create_joke`, and `readapt_joke` functions and the Route Handlers, which check the request origin and the Better Auth session. Ratings are keyed by a SHA-256 digest of the verified session's normalized email, never client input. `ANTHROPIC_API_KEY` is read only in `lib/claude.ts` and is never logged or returned to the browser; without it, browsing and rating still work, but analysis, submissions, and explanations return 503. Every joke records its `source_language` and an `origin`: `demo` (seeded by the migrations), `member` (shared on the site; the only origin with an author account), or `import` (bulk-imported posts, credited through `source_label`, such as `Qiushibaike`, with the original username as the author name).

## Importing Qiushibaike posts

The archive is the public Hugging Face dataset [`qiushibaike-bak/metadata`](https://huggingface.co/datasets/qiushibaike-bak/metadata) (`articles.bson.gz`, December 2022; no license stated). `/terms` (linked in the footer and from each imported joke's Qiushibaike chip) discloses the source, that authors are credited by their original usernames, that displayed dates are import dates rather than original posting dates, that copyright stays with the authors, and how to request removal.

`bun run import:qiushibaike [posts.json] [--batch <id> ...]` imports 100 popular posts from the Qiushibaike archive and re-adapts the demo jokes so they get localized commentary. The input (default `/tmp/qb-top.json`) is `{ "best": [{ "id", "likes", "login", "content", "topic" }] }`, sorted by likes; it is extracted from the archive's `articles.bson` by a separate scan and is not committed. The script:

1. Cleans each post (control characters, leading `#topic#` hashtags, `[emoticon]` codes, extra whitespace), keeps 10–600 characters, and removes duplicates.
2. Pre-screens every candidate in chunks of 150, sent together as one Message Batch. Like adaptation, the pre-screen uses JSON outputs at `high` effort so adaptive thinking stays on (a thinking-free forced-tool screen let roughly half its picks through as comments or non-jokes). It keeps only complete, self-contained jokes and funny anecdotes, including adult humor and sexual innuendo (labeled 18+ on the site), and rejects comments and replies, announcements, greetings and like-begging, personal ads, sad or serious posts, hate or harassment, sexual content involving minors, and personal data. Decisions are cached per post in `/tmp/qb-import/prescreen-decisions.json`, and posts the adaptation step later judges unsuitable are recorded there too, so no post is paid for twice. Decisions cached before adult humor was allowed still reject innuendo; delete the file to screen those posts again.
3. Sends the `adaptationParams` request (at `high` effort) for the 100 most-liked accepted posts, plus every demo joke whose commentary is not yet localized, as one [Message Batch](https://docs.anthropic.com/en/docs/build-with-claude/batch-processing), which costs 50% of the regular price. The adaptation step checks again that each post is a self-contained joke. It polls every 20 seconds until the batch ends, downloads the JSONL results, and parses them with `parseAdaptation`; only results with all three versions are stored. If fewer than 100 posts succeed, it submits one more batch for exactly the shortfall from the next accepted candidates, until 100 are imported or candidates run out.
4. Stores each post with `create_joke` as origin `import`, source label `Qiushibaike`, the original username, the model's `adult` flag, and a random timestamp within the last 30 days. Each demo joke is stored again with its original text and timestamp, and the old row (with its ratings) is deleted only after the new one is saved.

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

For a new database, run `supabase/seed.sql` once in the Supabase SQL Editor, then apply `supabase/migrations` in order (`supabase db push` for a project linked with the Supabase CLI). The seed and the `2026092800*` migrations create the original humor collection and caption votes tables; they stay only because the migration history builds on them, and `202610150002_drop_legacy_humor.sql` drops those tables and the `caption_vote_summary` function again. `202610140001_cross_cultural_jokes.sql` creates the jokes tables and the four demo jokes; `202610150001_multilingual_jokes.sql` adds source languages, origins, and localized commentary; `202610150003_author_avatars.sql` adds `user_profiles.google_url`, the author avatar fields in `joke_feed`, and the `my_ratings` function; `202610150004_my_jokes.sql` adds the `my_jokes` function; `202610160001_explanations_and_adult.sql` adds `jokes.adult` and `jokes.explanation`, the `joke_explanations` table, the matching `joke_feed` fields, the `p_adult` and `p_explanation` parameters of `create_joke`, and the `readapt_joke` function; `202610160002_anonymous_explanations.sql` replaces the explainer's name with `jokes.explanation_source` (`author` or `community`); `202610170001_admin_area.sql` adds `user_profiles.is_superadmin` and the account details the admin area lists, `joke_adaptations.updated_at` with the column grant for superadmin edits, and the `admin_dashboard`, `admin_users`, `admin_media`, and `admin_ratings` functions; `202610280001_ai_config_and_access.sql` adds the AI configuration (`llm_providers`, `llm_models`, `prompt_chains`, `prompt_chain_steps`, `prompt_chain_mix`, `terms`, `generation_examples`), the AI request logs (`generation_requests`, `llm_responses`), the sign-up lists (`allowed_signup_domains`, `whitelisted_emails`), the `signup_allowed`, `ai_generation_context`, and `set_prompt_chain_mix` functions, and the `admin_prompt_chains`, `admin_generation_requests`, `admin_llm_responses`, and `admin_images` functions. It seeds the Anthropic provider, Claude Haiku 5.5, and four chains whose default mix reproduces the earlier behavior. After all migrations the public schema holds `jokes`, `joke_adaptations`, `adaptation_ratings`, `joke_explanations`, `user_profiles`, and those eleven tables.

```sh
bun dev
```

Open http://localhost:3000.

## Google sign-in

Authentication uses the open-source [Better Auth](https://better-auth.com/docs/integrations/next) package, the only authentication dependency. Reading jokes is public; sharing and rating require a session, which every Route Handler verifies on the server. `/members` validates the encrypted session on the server before rendering member content. The header shows Google sign-in for visitors. For members it shows only their avatar, which opens a menu with their name, a link to the members area, and sign-out.

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

Sign-in can be limited to allowed email domains and whitelisted addresses from the admin area (see [Sign-up access](#sign-up-access)); while both lists are empty, any Google account can sign in. Sessions use Better Auth's encrypted, HttpOnly, SameSite cookies, with Secure cookies on HTTPS, and expire after 24 hours. No auth tables or database migration are required. Stateless sign-out clears this browser's cookies; it cannot centrally revoke copied sessions. Add database-backed session storage if central revocation or persistent user records become necessary. Better Auth sessions are separate from Supabase Auth and do not grant Supabase's `authenticated` database role.

### Preview deployments

Better Auth's built-in [OAuth Proxy](https://better-auth.com/docs/plugins/oauth-proxy) sends Google callbacks through production, then returns the encrypted result to the original deployment. That deployment validates its original state cookie and creates its own session. No additional package is required.

Set `BETTER_AUTH_URL=https://sx2451.vercel.app` in both Vercel Production and Preview. Give both environments the same `OAUTH_PROXY_SECRET` and Google credentials, but keep their `BETTER_AUTH_SECRET` values separate. Configure the public Supabase connection in Preview as well. Trusted origins include `http://localhost:3000`, `thehumorproject-*-xsy2004s-projects.vercel.app`, and the project's stable Vercel alias; the configured `BETTER_AUTH_URL` is trusted automatically. Google only needs the production `/auth/callback` URI, not each preview URL. Successful and cancelled sign-ins return to the domain where they started.

Redeploy both environments after changing proxy configuration. Existing immutable deployment URLs keep their old code and secrets; use a new deployment URL to test. Local development retains direct Google OAuth with `BETTER_AUTH_URL=http://localhost:3000` and its own random proxy secret.

Run `bun run check:oauth-proxy` for an offline integration check with separate production/preview session secrets, the real proxy plugin, and a stub Google provider. It checks successful round trips, callback errors, cookie binding, untrusted origins, tampered payloads, expired payloads, and the sign-up gate on direct and proxied sign-ins without contacting Google or creating production users.

To protect another page, check `await auth.api.getSession({ headers: await headers() })` on the server before returning private content and redirect missing sessions to `/login`, as in `app/members/page.tsx`. Independently check sessions in any future private Route Handler or Server Action. Client UI visibility is not an authorization boundary.

With `bun dev` running at `http://localhost:3000`, run `bun run check:auth`. The local check covers valid, expired and tampered sessions, protected rendering, callback URI, PKCE, callback errors, external redirect rejection, CSRF and sign-out. It uses synthetic local sessions and does not log into a real Google account; complete a browser sign-in after configuring Google's allowed localhost callback.

## Checks

```sh
bun run lint
bun run check:jokes
bun run check:avatar
bun run build
```

With `bun dev` running and the admin migration applied, `bun run check:admin` checks the admin area's authorization live (see [Admin area](#admin-area)).

`bun run check:jokes` is an offline route integration check with real encrypted sessions and stub database and Claude services; it does not call Anthropic. It covers the feed with origins and localized commentary, prompt chains picked from the mix with their models and effort (including the two-step "read first" chain), glossary terms matched as whole words and reference examples, the request and model-call logs, the built-in chain when the configuration is missing, blind totals, exactly one Claude request per analysis, submission, and explanation (model, JSON-schema output, effort, API key, and the joke and explanation tags), punchline analysis in the reader's language (statuses and response shape, nothing stored), sharing with an explanation and the 18+ flag, community explanations (unknown jokes, rejected explanations recorded without changing the joke, the daily limit, and accepted re-adaptation that replaces every version and resets its ratings), source language detection, partially invalid and failed adaptation (HTTP errors, malformed JSON, truncated output, no valid version), unsuitable, refused, and unsupported-language submissions, the daily limit, rating and withdrawal, guest/expired/tampered/unverified sessions, CSRF, invalid input, unknown versions, and missing configuration. Environments that restrict Turbopack's internal ports can validate with `bun run build --webpack`.

### Profile photos

Members choose their avatar in the personal center (`/members`, linked from the account menu): the photo from their Google account (the default) or a photo they upload. The header shows the chosen avatar, falling back to initials when no photo is available. Switching between the two options keeps the uploaded photo; uploading a new photo replaces it, and **Delete uploaded photo** removes it from storage and returns to the Google photo.

The same avatar appears next to every joke a member shares. Because sessions are stateless, the server remembers each member's current Google photo in `user_profiles.google_url` whenever the header loads their profile and whenever they share a joke; `joke_feed` joins the author's profile and the feed returns a single `author_avatar_url` (the uploaded photo if chosen, otherwise the Google photo), never the author's id. Imported and demo jokes show initials.

The personal center starts with **Your jokes**: every joke the account shared, newest first, with analytics. A summary shows jokes shared, ratings received, the overall still-funny share, and the culture the jokes travel best to (highest share, ties broken by more ratings), followed by a still-funny meter per culture across all jokes. Each joke then shows its original, a meter and still-funny / not-funny counts per version, and a disclosure with the three versions. Authors always see their own full totals: the blind-total rule keeps readers from being swayed before they vote, not authors from reviewing results. `/api/my-jokes` returns them through the `my_jokes` function (`202610150004_my_jokes.sql`) for the verified account only.

Below it, **Your ratings** lists every version the account has rated, newest first, with the answer, the version's language and text, the original joke, and how many of the account's ratings were "still funny". `/api/my-ratings` returns them through the `my_ratings` function for the verified account only.

The **Still funny** and **Not funny** buttons carry face icons (`app/rating-icons.tsx`) and turn green or red when chosen. Picking an answer plays a short animation: the laughing face bounces and a copy floats up, while the meh face shakes its head. The keyframes are skipped when the reader prefers reduced motion.

Before uploading, the browser crops the image to a centered square and resizes it to at most 512 × 512 pixels. `/api/avatar` then checks the request origin and Better Auth session, accepts files up to 2 MB, and identifies JPEG, PNG, or WebP from the file's leading bytes rather than its name or declared type. Photos are stored in the public `avatars` Supabase Storage bucket under random object names, so URLs reveal nothing about the member and the bucket cannot be listed. Preferences live in `user_profiles`, keyed by the same email digest as joke ratings; RLS is enabled with no policies, and table privileges allow only the server-only key. The `replace_avatar` function swaps or clears the photo atomically and returns the previous object for cleanup.

Apply `supabase/migrations/202610120001_user_avatars.sql` with `supabase db push`; it creates the table, function, and bucket. The feature uses the same `SUPABASE_SECRET_KEY` as jokes. Run `bun run check:avatar` for an offline route integration check with real encrypted sessions and stub database and storage services. After applying the migration, with `bun dev` running and the server key configured, `bun run check:avatar:live` verifies the real HTTP, database, and storage flow with a synthetic local session: browser-key denial, bucket type limits, public photo URLs, replacement and concurrent-upload cleanup, source switching, and deletion. It then removes its test profile and photos.

## Admin area

`/admin` is a back office for superadmins, laid out after the [HeroUI Pro dashboard template](https://template-dashboard.heroui.pro/): a sidebar with the signed-in superadmin, navigation, a link back to the site, and sign-out (a drawer below the `lg` breakpoint), a sticky header with the language switcher, KPI tiles, chart cards, and data tables with search, filters, sorting, pagination, and row actions. It uses HeroUI v3 components and the template's icon set, [`@gravity-ui/icons`](https://github.com/gravity-ui/icons); the charts are small dependency-free SVG components in `app/admin/charts.tsx`. Every screen is translated like the rest of the site, and the account menu links to it for superadmins.

### Access: a Google login wall plus `is_superadmin`

Every admin route requires a Google session for an account whose `user_profiles.is_superadmin` is `true`. The check is layered:

1. `proxy.ts` runs on `/admin`, `/admin/*`, and `/api/admin/*`, including routes added later. Without a session cookie it redirects pages to `/admin/login` and answers APIs with 401. It only reads the cookie.
2. `lib/admin.ts` is the data access layer. The console layout, every admin page, and every admin Route Handler call it themselves (layouts do not re-run on client navigation): it verifies the encrypted Better Auth session, derives the verified-email digest exactly like the rest of the app, and reads `is_superadmin` from the database on every request. Revoking the flag takes effect on the next request, and database errors fail closed. Changes must also come from this site's origin.
3. `/admin/login` is the only admin route without the flag check. It offers Google sign-in (returning to `/admin`) or, for a signed-in account without the flag, explains that access is granted on the server and offers to switch accounts.

The tables keep RLS on with no policies, as before; only the server-only key can read them, through `admin_dashboard`, `admin_users`, `admin_media`, `admin_ratings`, and the functions below, which are executable by `service_role` only. The server-only key itself can only read prompt chains and their steps and only add to the AI logs; those change through migrations.

**Avoiding a lockout.** If only superadmins can enter, who makes the first one? Nothing in the app can set `is_superadmin`, so no request can escalate privileges. The flag is granted out of band with the server-only Supabase key, which bypasses RLS:

```sh
bun run admin:grant you@gmail.com
```

`scripts/grant-superadmin.ts` stores the flag on the profile keyed by the SHA-256 digest of the email, so the account needs no earlier visit; sign in at `/admin` with that Google account afterwards. `--revoke <email>` removes the flag and `--list` lists superadmins. The Supabase SQL Editor works too:

```sql
insert into public.user_profiles (user_id, email, is_superadmin)
values (encode(sha256(convert_to(lower(trim('you@gmail.com')), 'UTF8')), 'hex'), lower(trim('you@gmail.com')), true)
on conflict (user_id) do update set is_superadmin = true;
```

### Dashboard

A date range (7 days, 30 days, 90 days, or 12 months, in the URL as `?range=`) scopes the activity numbers; everything else covers the whole collection.

- **KPI tiles**: jokes shared, AI versions generated, ratings, and active accounts in the range, each with the change against the previous period of the same length, the all-time total, and a sparkline.
- **Activity**: jokes or ratings per day (per week for 12 months), with the period total, average, and busiest day. Hovering, or focusing the chart and using the arrow keys, shows each value.
- **Does the punchline survive?**: the share of "Still funny" answers per culture.
- **What makes it funny**: the comic devices (twist, deadpan, literal reading, absurd exaggeration, wordplay and homophones, irony, self-mockery, innuendo) named in each joke's punchline commentary.
- **Translation stretch**: the median length of an adapted version relative to its original, per language pair. Chinese originals grow about four times longer in English and Spanish.
- **How much each culture rewrites**: versions in another language classified from their adaptation notes as kept close, reworded, or rebuilt around a swapped cultural reference.
- **Crowd board**: the most "still funny" versions and the ones most often "lost in translation".
- **Collection**: jokes by origin, original languages, the 18+ share, accepted explanations, and versions edited by admins.

Culture colors in charts come from `--chart-en`, `--chart-es`, and `--chart-zh` in `app/globals.css`, stepped separately for light and dark surfaces and checked for color-vision deficiencies; culture names always accompany them.

### Users, AI media, and ratings

- **Users** (`/admin/users`, read-only) lists every known account: profiles, joke authors, raters, and explainers, with role, jokes, ratings, explanations, and last activity, plus a detail view with the account digest. To tell accounts apart, the app now also remembers each member's name, email, and last visit in `user_profiles` whenever the header loads their profile (at most hourly) or they share or explain a joke. Accounts not seen since then show without an email.
- **AI media** (`/admin/media`) manages the AI-generated versions in `joke_adaptations`. **Create**: *Generate with AI* sends a joke (and optionally why it is funny) through the same adaptation request members use and publishes it as a member joke from the superadmin's account, without the daily limit. **Read**: search, filter by culture and origin, sort, and open any version with its commentary, ratings, and original joke. **Update**: edit the version text and its translation, core punchline, and notes in each language; the version keeps its ratings and is marked as edited. **Delete**: remove a version together with its ratings; the joke and its other versions stay.
- **Ratings** (`/admin/ratings`, read-only) lists the newest 1,000 "Still funny?" answers with the rater, the version, and the original joke, filterable by answer and culture.

`GET`/`POST /api/admin/media` and `PATCH`/`DELETE /api/admin/media/[id]` back the media page.

The sidebar groups the pages: Overview (Dashboard); Community (Users, Ratings, Images); AI content (AI media, Generation requests, LLM responses); Prompts (Prompt chains, Chain mix, Terms, Generation examples); Models (LLM models, LLM providers); and Access (Sign-up domains, Whitelisted emails).

| Data | Page | Superadmins can |
| --- | --- | --- |
| Accounts (`user_profiles` and activity) | Users | read |
| AI-generated versions | AI media | create, read, update, delete |
| Uploaded profile photos | Images | upload, read, show or hide, replace, delete |
| Prompt chains and their steps | Prompt chains | read |
| Prompt chain mix | Chain mix | read, update |
| Glossary terms | Terms | create, read, update, delete |
| Reference adaptations | Generation examples | create, read, update, delete |
| LLM models and providers | LLM models, LLM providers | create, read, update, delete |
| AI requests and model calls | Generation requests, LLM responses | read |
| Allowed sign-up domains and whitelisted emails | Sign-up domains, Whitelisted emails | create, read, update, delete |

### AI configuration

Every AI request the site makes (the punchline preview, sharing, community explanations, and admin generation; not imports) runs a **prompt chain**. A chain serves one purpose, the punchline preview or the adaptation, and runs its steps in order; each step names its kind (`analysis` or `adaptation`), model, effort, and output limit. The prompt text stays in `lib/claude.ts`; the Prompt chains page shows it for each step. Chains and steps are defined by migrations and are read-only in the app. The migration seeds:

- **Punchline preview**: one analysis step (Claude Haiku 5.5, `medium`).
- **Direct adaptation**: one adaptation step (Claude Haiku 5.5, `medium`); the earlier behavior.
- **Careful adaptation**: the same step at `high` effort; slower and more expensive.
- **Read first, then adapt**: when nobody explained the joke, an analysis step first works out the punchline in English and the adaptation follows that reading. A human explanation replaces the reading step, and the chain's own reading is never rejected as an explanation or stored on the joke.

The **chain mix** gives each chain a weight from 0 to 100. Each request picks one chain of its purpose at random, weighted by the mix; 0 turns a chain off, and every purpose keeps at least one chain above 0 (`set_prompt_chain_mix` enforces it). Preview and Direct adaptation start at 100, the others at 0. The mix page shows each chain's requests and how readers rated the versions it wrote (a joke's versions belong to the chain of its latest successful adaptation request), so chains can be compared before shifting weights.

**LLM models** map a display name to the API model ID a step sends; editing a model's API ID changes every step that uses it on the next request, and a model a step uses, or a provider with models, cannot be deleted (409). Every step is sent to the Anthropic Messages API, so other providers are kept for reference only.

**Terms** form a glossary of culture-specific slang, references, and sound-alikes. When a joke contains a term (any case; English and Spanish terms as whole words), up to 20 matching entries are sent after the joke in `<glossary>` tags, for previews and adaptations, and the system prompt notes that the glossary is reference data that never overrides an explanation. **Generation examples** are reference adaptations: a joke in its original language, its versions for the other two cultures, and optionally why it is funny and why the adaptation works. The ten newest are added to the adaptation system prompt in `<examples>` tags. Without terms or examples, the prompts are unchanged.

`lib/generation.ts` loads the chains, matching terms, and examples with one `ai_generation_context` call. If the database is not configured or the migration is not applied yet, it runs the built-in defaults, so deploying the code before the migration is safe.

The simple tables share one API: `GET`/`POST /api/admin/[resource]` and `PATCH`/`DELETE /api/admin/[resource]/[id]` for `terms`, `generation-examples`, `llm-models`, `llm-providers`, `signup-domains`, and `whitelisted-emails`. `lib/admin-resources.ts` defines each table and validates every field for both the forms and the Route Handlers; duplicates and rows still in use answer 409. `GET`/`PATCH /api/admin/prompt-chain-mix` (body `{ weights: [{ chainId, weight }] }`) reads and replaces the mix.

### AI requests and responses

`generation_requests` records every AI request with its purpose, source (share, explanation, or admin), chain, account digest, input (including previewed drafts that were never shared, as the terms disclose), explanation, status (`succeeded`, `unsuitable`, `rejected`, or `failed`, with the reason), timing, and the joke it produced or changed. `llm_responses` records every model call within a request: the step, model and effort, what was sent after the system prompt, status (`succeeded`, `refused`, or `failed`), HTTP status, stop reason, token usage including cache reads and writes, duration, and the model's JSON answer. Logging uses short timeouts and never fails a member's request.

**Generation requests** lists the newest 1,000 requests with filters for status, purpose, and source, and a detail view with every model call; **LLM responses** lists the newest 1,000 model calls. Both are read-only; `GET /api/admin/generation-requests/[id]` and `GET /api/admin/llm-responses/[id]` load the prompts and answers on demand.

### Images

Profile photos are the only images members upload. **Images** lists every photo in the `avatars` bucket with the account that uses it, whether the account shows it, and photos no account references. Superadmins can upload a photo for an account (cropped in the browser to a square of at most 512 × 512 pixels, then checked on the server exactly like a member upload), show or hide it on the account, replace it, or delete it; an account whose photo is deleted or hidden falls back to its Google photo. `POST /api/admin/images` (multipart `file` and `userId`), `PATCH /api/admin/images/[path]` (`{ inUse }`), and `DELETE /api/admin/images/[path]` back the page; the upload checks are shared with `/api/avatar` in `lib/photos.ts`.

### Sign-up access

**Sign-up domains** and **Whitelisted emails** limit who can sign in. While both lists are empty, every Google account can sign in, as before. Once either has an entry, Better Auth's `validateUserInfo` hook (`lib/auth.ts`) admits a Google sign-in only when `signup_allowed` passes: the verified email's exact domain (after the @, without subdomains) is allowed, the email is whitelisted, or the account is a superadmin, so the lists can never lock superadmins out. Refused sign-ins return to `/login?error=signup_not_allowed`, which explains the limit. Before the migration is applied the gate stays open; any other database error refuses the sign-in. Sessions already open are stateless and last until they expire (at most 24 hours).

### Checking the admin area

`bun run check:admin` runs against a local `bun dev` server with the server-only key. With synthetic sessions it checks that visitors, forged, tampered, and expired sessions, signed-in members, and unverified emails are turned away from every admin page and API; then it grants a synthetic superadmin, renders every page, round-trips a synthetic joke through the media API (list, cross-site and invalid edits, edit, delete), checks creation input validation without calling Claude, round-trips a synthetic term through the generic admin API (create, duplicate, invalid, cross-site, edit, delete), checks that a model in use cannot be deleted and that the mix rejects invalid weights, and confirms that revoking the flag takes effect immediately. It deletes its profile, joke, and term afterwards.

## Vercel

Select **Next.js** as the Framework Preset, leave Root Directory empty, and keep the default build settings. The Vercel Supabase integration supplies `SUPABASE_URL`; add `SUPABASE_SECRET_KEY`, `ANTHROPIC_API_KEY`, and the auth variables to the required deployment environments (Production / Preview). All of them are read only on the server, so nothing is embedded in the browser bundle.

All project content is in English. Follow [AGENTS.md](./AGENTS.md) for project and commit conventions.
