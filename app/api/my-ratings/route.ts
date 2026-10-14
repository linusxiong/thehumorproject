import { auth, stableUserId } from "@/lib/auth";
import type { MyRating } from "@/lib/jokes";
import { createServerSupabase } from "@/lib/supabase-server";

const noStore = { "Cache-Control": "private, no-store" };
const fail = (error: string, status: number) => Response.json({ error }, { status, headers: noStore });

// The signed-in account's own ratings for the personal center, newest first.
export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return fail("Please sign in to see your ratings.", 401);
    const userId = stableUserId(session.user);
    if (!userId) return fail("A verified email is required to rate jokes.", 403);
    const client = createServerSupabase();
    if (!client) return fail("Ratings are not configured yet.", 503);
    const { data, error } = await client.rpc("my_ratings", { p_user_id: userId }).abortSignal(AbortSignal.timeout(15_000));
    if (error) throw error;
    return Response.json((data ?? []) as MyRating[], { headers: noStore });
  } catch (error) {
    console.error("Failed to load ratings:", error instanceof Error ? error.message : error);
    return fail("Your ratings could not be loaded. Please try again.", 500);
  }
}
