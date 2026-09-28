import { createClient } from "@supabase/supabase-js";

export const categories = ["All", "Everyday", "Work", "Code"] as const;
export type Category = (typeof categories)[number];
export type HumorEntry = {
  id: number;
  title: string;
  setup: string;
  punchline: string;
  category: Exclude<Category, "All">;
  author: string;
  created_at: string;
};

export async function loadHumor(signal?: AbortSignal): Promise<HumorEntry[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("The collection is not configured yet. Please contact the site owner.");

  const client = createClient(url, key, { auth: { persistSession: false } });
  const timeout = AbortSignal.timeout(15_000);
  const { data, error } = await client
    .from("humor_entries")
    .select("id,title,setup,punchline,category,author,created_at")
    .order("created_at", { ascending: false })
    // ponytail: newest 100 stories; add server-side pagination when the collection grows.
    .limit(100)
    .abortSignal(signal ? AbortSignal.any([signal, timeout]) : timeout)
    .returns<HumorEntry[]>();

  if (error) {
    if (!signal?.aborted) console.error("Failed to load humor entries:", error.message);
    throw new Error("We could not load the collection. Please try again in a moment.");
  }
  return data ?? [];
}

export function filterHumor(entries: HumorEntry[], category: Category, query: string) {
  const search = query.trim().toLowerCase();
  return entries.filter((entry) =>
    (category === "All" || entry.category === category) &&
    [entry.title, entry.setup, entry.punchline, entry.author].some((text) =>
      text.toLowerCase().includes(search),
    ),
  );
}
