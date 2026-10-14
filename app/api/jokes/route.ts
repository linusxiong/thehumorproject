import { auth, stableUserId } from "@/lib/auth";
import { adaptJoke, isClaudeConfigured, type AdaptationResult } from "@/lib/claude";
import { loadJokes } from "@/lib/joke-feed";
import { dailyJokeLimit, explanationLength, jokeLength } from "@/lib/jokes";
import { createServerSupabase, rememberGoogleAvatar } from "@/lib/supabase-server";

// One adaptation request may take up to 100 seconds, plus database round trips.
export const maxDuration = 120;

const noStore = { "Cache-Control": "private, no-store" };
const fail = (error: string, status: number) => Response.json({ error }, { status, headers: noStore });

export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    const client = createServerSupabase();
    if (!client) return fail("Jokes are not configured yet.", 503);
    const jokes = await loadJokes(client, session ? stableUserId(session.user) : null);
    return Response.json(jokes, { headers: noStore });
  } catch (error) {
    console.error("Failed to load jokes:", error instanceof Error ? error.message : error);
    return fail("Jokes could not be loaded. Please try again.", 500);
  }
}

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return fail("Invalid request origin.", 403);
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return fail("Please sign in to share a joke.", 401);
    const userId = stableUserId(session.user);
    if (!userId) return fail("A verified email is required to share a joke.", 403);
    const input = await request.json().catch(() => null);
    const body = typeof input?.body === "string" ? input.body.trim() : "";
    if (body.length < jokeLength.min || body.length > jokeLength.max) {
      return fail(`Write a joke between ${jokeLength.min} and ${jokeLength.max} characters.`, 400);
    }
    // The author's confirmed or corrected reading of the joke, from the analysis step; optional.
    const explanation = typeof input.explanation === "string" ? input.explanation.trim() : "";
    if ((input.explanation != null && typeof input.explanation !== "string")
      || (explanation && (explanation.length < explanationLength.min || explanation.length > explanationLength.max))) {
      return fail(`Explain the joke in ${explanationLength.min} to ${explanationLength.max} characters.`, 400);
    }
    const client = createServerSupabase();
    if (!client || !isClaudeConfigured()) return fail("Joke adaptation is not configured yet.", 503);

    const { count, error: countError } = await client.from("jokes").select("id", { count: "exact", head: true })
      .eq("author_id", userId).gt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .abortSignal(AbortSignal.timeout(15_000));
    if (countError || count === null) throw countError ?? new Error("Missing joke count.");
    if (count >= dailyJokeLimit) return fail(`You can share up to ${dailyJokeLimit} jokes per day. Please try again tomorrow.`, 429);

    let result: AdaptationResult;
    try {
      result = await adaptJoke(body, { signal: request.signal, explanation: explanation || undefined });
    } catch (error) {
      console.error("Joke adaptation failed:", error instanceof Error ? error.message : error);
      return fail("The joke could not be adapted right now. Please try again.", 502);
    }
    if (!result.suitable) {
      return fail("Please share a self-contained joke in English, Spanish, or Chinese that is not hateful or harassing.", 422);
    }
    if (!result.explanationAccepted) return fail("Your explanation does not seem to match this joke. Please edit it and try again.", 422);

    const authorName = session.user.name?.trim().split(/\s+/)[0]?.slice(0, 100) || "Member";
    const { data: jokeId, error } = await client.rpc("create_joke", {
      p_author_id: userId, p_author_name: authorName, p_body: body, p_source_language: result.sourceLanguage, p_adaptations: result.adaptations,
      p_adult: result.adult, p_explanation: explanation || null,
    }).abortSignal(AbortSignal.timeout(15_000));
    if (error) throw error;
    await rememberGoogleAvatar(client, userId, session.user.image);
    const [joke] = await loadJokes(client, userId, Number(jokeId));
    if (!joke) throw new Error("The new joke could not be loaded.");
    return Response.json(joke, { status: 201, headers: noStore });
  } catch (error) {
    console.error("Failed to share a joke:", error instanceof Error ? error.message : error);
    return fail("Your joke could not be shared. Please try again.", 500);
  }
}
