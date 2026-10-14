import { auth, stableUserId } from "@/lib/auth";
import { loadJokes } from "@/lib/joke-feed";
import { createServerSupabase } from "@/lib/supabase-server";

const noStore = { "Cache-Control": "private, no-store" };
const fail = (error: string, status: number) => Response.json({ error }, { status, headers: noStore });

export async function POST(request: Request) {
  return mutateRating(request, false);
}

export async function DELETE(request: Request) {
  return mutateRating(request, true);
}

async function mutateRating(request: Request, withdraw: boolean) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return fail("Invalid request origin.", 403);
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return fail("Please sign in to rate jokes.", 401);
    const userId = stableUserId(session.user);
    if (!userId) return fail("A verified email is required to rate jokes.", 403);
    const input = await request.json().catch(() => null);
    const adaptationId = input?.adaptationId;
    if (!Number.isSafeInteger(adaptationId) || adaptationId <= 0 || (!withdraw && typeof input.funny !== "boolean")) {
      return fail("Choose a valid joke version and whether it is still funny.", 400);
    }
    const client = createServerSupabase();
    if (!client) return fail("Ratings are not configured yet.", 503);

    const { data: target, error: lookupError } = await client.from("joke_adaptations").select("joke_id")
      .eq("id", adaptationId).abortSignal(AbortSignal.timeout(15_000)).maybeSingle<{ joke_id: number }>();
    if (lookupError) throw lookupError;
    if (!target) return fail("This joke version no longer exists.", 404);
    const mutation = withdraw
      ? client.from("adaptation_ratings").delete().eq("adaptation_id", adaptationId).eq("user_id", userId)
      : client.from("adaptation_ratings").upsert(
        { adaptation_id: adaptationId, user_id: userId, funny: input.funny, updated_at: new Date().toISOString() },
        { onConflict: "adaptation_id,user_id" },
      );
    const { error } = await mutation.abortSignal(AbortSignal.timeout(15_000));
    if (error?.code === "23503") return fail("This joke version no longer exists.", 404);
    if (error) throw error;
    const [joke] = await loadJokes(client, userId, target.joke_id);
    if (!joke) return fail("This joke no longer exists.", 404);
    return Response.json(joke, { headers: noStore });
  } catch (error) {
    console.error("Failed to update a joke rating:", error instanceof Error ? error.message : error);
    return fail("Your rating could not be saved. Please try again.", 500);
  }
}
