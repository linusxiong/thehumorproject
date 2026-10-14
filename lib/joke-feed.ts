import type { SupabaseClient } from "@supabase/supabase-js";
import type { Joke } from "@/lib/jokes";
import { avatarBucket } from "@/lib/supabase-server";

// joke_feed returns the author's raw avatar fields; the route turns them into one public URL.
type FeedRow = Omit<Joke, "revealed" | "author_avatar_url"> & { author_avatar_path: string | null; author_google_url: string | null };

// The whole collection (demos, 100 imports, and members' jokes) fits in one response, so filters and sorting see every joke.
const feedLimit = 200;

// Loads jokes through joke_feed and hides totals until the viewer has rated a version of that joke.
export async function loadJokes(client: SupabaseClient, userId: string | null, jokeId: number | null = null): Promise<Joke[]> {
  const { data, error } = await client.rpc("joke_feed", { p_user_id: userId, p_joke_id: jokeId, p_limit: feedLimit })
    .abortSignal(AbortSignal.timeout(15_000));
  if (error) throw error;
  return ((data ?? []) as FeedRow[]).map(({ author_avatar_path: avatarPath, author_google_url: googleUrl, ...row }) => {
    const revealed = userId !== null && row.adaptations.some((adaptation) => adaptation.user_rating !== null);
    const adaptations = row.adaptations.map((adaptation) => {
      if (revealed) return adaptation;
      const hidden = { ...adaptation };
      delete hidden.funny;
      delete hidden.not_funny;
      return hidden;
    });
    const avatarUrl = avatarPath ? client.storage.from(avatarBucket).getPublicUrl(avatarPath).data.publicUrl : googleUrl;
    return { ...row, author_avatar_url: avatarUrl ?? null, revealed, adaptations };
  });
}
