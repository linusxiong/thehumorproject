import { auth, stableUserId } from "@/lib/auth";
import { adaptJoke, isClaudeConfigured, type AdaptationResult } from "@/lib/claude";
import { loadJokes } from "@/lib/joke-feed";
import { dailyExplanationLimit, explanationLength } from "@/lib/jokes";
import { createServerSupabase, rememberGoogleAvatar } from "@/lib/supabase-server";

// Any member may explain what an existing joke really means when its versions missed the point.
// The joke is re-adapted with that explanation; an accepted one replaces all versions (resetting their ratings)
// and is credited on the card. One adaptation request may take up to 100 seconds, plus database round trips.
export const maxDuration = 120;

const noStore = { "Cache-Control": "private, no-store" };
const fail = (error: string, status: number) => Response.json({ error }, { status, headers: noStore });

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return fail("Invalid request origin.", 403);
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return fail("Please sign in to explain a joke.", 401);
    const userId = stableUserId(session.user);
    if (!userId) return fail("A verified email is required to explain a joke.", 403);
    const input = await request.json().catch(() => null);
    const jokeId = input?.jokeId;
    const explanation = typeof input?.explanation === "string" ? input.explanation.trim() : "";
    if (!Number.isSafeInteger(jokeId) || jokeId <= 0) return fail("Choose a valid joke.", 400);
    if (explanation.length < explanationLength.min || explanation.length > explanationLength.max) {
      return fail(`Explain the joke in ${explanationLength.min} to ${explanationLength.max} characters.`, 400);
    }
    const client = createServerSupabase();
    if (!client || !isClaudeConfigured()) return fail("Joke adaptation is not configured yet.", 503);

    // Accepted and rejected explanations both count, so rejected attempts cannot be retried endlessly.
    const { count, error: countError } = await client.from("joke_explanations").select("id", { count: "exact", head: true })
      .eq("user_id", userId).gt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .abortSignal(AbortSignal.timeout(15_000));
    if (countError || count === null) throw countError ?? new Error("Missing explanation count.");
    if (count >= dailyExplanationLimit) {
      return fail(`You can explain up to ${dailyExplanationLimit} jokes per day. Please try again tomorrow.`, 429);
    }

    const { data: target, error: lookupError } = await client.from("jokes").select("body")
      .eq("id", jokeId).abortSignal(AbortSignal.timeout(15_000)).maybeSingle<{ body: string }>();
    if (lookupError) throw lookupError;
    if (!target) return fail("This joke no longer exists.", 404);

    let result: AdaptationResult;
    try {
      result = await adaptJoke(target.body, { signal: request.signal, explanation });
    } catch (error) {
      console.error("Joke re-adaptation failed:", error instanceof Error ? error.message : error);
      return fail("The joke could not be adapted right now. Please try again.", 502);
    }
    if (!result.suitable) return fail("This joke cannot be adapted with that explanation.", 422);

    const authorName = session.user.name?.trim().split(/\s+/)[0]?.slice(0, 100) || "Member";
    if (!result.explanationAccepted) {
      const { error } = await client.from("joke_explanations")
        .insert({ joke_id: jokeId, user_id: userId, author_name: authorName, explanation, accepted: false })
        .abortSignal(AbortSignal.timeout(15_000));
      if (error?.code === "23503") return fail("This joke no longer exists.", 404);
      if (error) throw error;
      return fail("Your explanation does not seem to match this joke, so the joke was not changed.", 422);
    }
    // Replacing a joke's versions needs all three; a partial answer would silently drop a culture.
    if (result.adaptations.length < 3) {
      console.error(`Joke re-adaptation returned ${result.adaptations.length} valid versions.`);
      return fail("The joke could not be adapted right now. Please try again.", 502);
    }

    const { error } = await client.rpc("readapt_joke", {
      p_joke_id: jokeId, p_user_id: userId, p_author_name: authorName, p_explanation: explanation,
      p_adult: result.adult, p_adaptations: result.adaptations,
    }).abortSignal(AbortSignal.timeout(15_000));
    // no_data_found: the joke was deleted while it was being adapted.
    if (error?.code === "P0002") return fail("This joke no longer exists.", 404);
    if (error) throw error;
    await rememberGoogleAvatar(client, userId, session.user.image);
    const [joke] = await loadJokes(client, userId, jokeId);
    if (!joke) return fail("This joke no longer exists.", 404);
    return Response.json(joke, { headers: noStore });
  } catch (error) {
    console.error("Failed to explain a joke:", error instanceof Error ? error.message : error);
    return fail("Your explanation could not be saved. Please try again.", 500);
  }
}
