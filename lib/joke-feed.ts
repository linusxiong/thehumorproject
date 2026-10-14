import type { SupabaseClient } from "@supabase/supabase-js";
import type { Joke } from "@/lib/jokes";

type FeedRow = Omit<Joke, "revealed">;

// The whole collection (demos, 100 imports, and members' jokes) fits in one response, so filters and sorting see every joke.
const feedLimit = 200;

// Loads jokes through joke_feed and hides totals until the viewer has rated a version of that joke.
export async function loadJokes(client: SupabaseClient, userId: string | null, jokeId: number | null = null): Promise<Joke[]> {
  const { data, error } = await client.rpc("joke_feed", { p_user_id: userId, p_joke_id: jokeId, p_limit: feedLimit })
    .abortSignal(AbortSignal.timeout(15_000));
  if (error) throw error;
  return ((data ?? []) as FeedRow[]).map((row) => {
    const revealed = userId !== null && row.adaptations.some((adaptation) => adaptation.user_rating !== null);
    const adaptations = row.adaptations.map((adaptation) => {
      if (revealed) return adaptation;
      const hidden = { ...adaptation };
      delete hidden.funny;
      delete hidden.not_funny;
      return hidden;
    });
    return { ...row, revealed, adaptations };
  });
}
