import { auth, stableUserId } from "@/lib/auth";
import type { MyJoke } from "@/lib/jokes";
import { createServerSupabase } from "@/lib/supabase-server";

const noStore = { "Cache-Control": "private, no-store" };
const fail = (error: string, status: number) => Response.json({ error }, { status, headers: noStore });

// The signed-in account's own jokes with full rating totals. Authors always see their own analytics;
// the blind-total rule protects readers deciding how to vote, not authors reviewing results.
export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return fail("Please sign in to see your jokes.", 401);
    const userId = stableUserId(session.user);
    if (!userId) return fail("A verified email is required to share jokes.", 403);
    const client = createServerSupabase();
    if (!client) return fail("Jokes are not configured yet.", 503);
    const { data, error } = await client.rpc("my_jokes", { p_user_id: userId }).abortSignal(AbortSignal.timeout(15_000));
    if (error) throw error;
    return Response.json((data ?? []) as MyJoke[], { headers: noStore });
  } catch (error) {
    console.error("Failed to load the member's jokes:", error instanceof Error ? error.message : error);
    return fail("Your jokes could not be loaded. Please try again.", 500);
  }
}
