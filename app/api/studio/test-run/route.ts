import { createHash, timingSafeEqual } from "node:crypto";
import { isClaudeConfigured } from "@/lib/claude";
import { adaptJoke, runPreview } from "@/lib/generation";
import { explanationLength, isAudienceId } from "@/lib/jokes";
import { createServerSupabase } from "@/lib/supabase-server";

// Runs one chain on a joke for Punchline Studio, so a test uses exactly the pipeline readers get: the same prompts,
// glossary, examples, answer format, and logs. Nothing is published: no joke is created or changed. The caller is the
// studio's server, not a browser, so it signs in with a shared secret rather than a session.

// The model calls of a two-step chain can each take most of 100 seconds; see sendMessage.
export const maxDuration = 300;

const noStore = { "Cache-Control": "private, no-store" };
const fail = (error: string, status: number) => Response.json({ error }, { status, headers: noStore });
const digest = (value: string) => createHash("sha256").update(value).digest();

function authorized(request: Request) {
  const secret = process.env.STUDIO_API_SECRET;
  const header = request.headers.get("authorization");
  return Boolean(secret && header) && timingSafeEqual(digest(header!), digest(`Bearer ${secret}`));
}

type Body = { chainId?: unknown; text?: unknown; explanation?: unknown; locale?: unknown; userId?: unknown };

export async function POST(request: Request) {
  if (!authorized(request)) return fail("Not authorized.", 401);
  const body = (await request.json().catch(() => null)) as Body | null;
  const chainId = Number.isSafeInteger(body?.chainId) && (body?.chainId as number) > 0 ? body?.chainId as number : null;
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const explanation = typeof body?.explanation === "string" ? body.explanation.trim() : "";
  const userId = typeof body?.userId === "string" && body.userId ? body.userId : null;
  const validExplanation = !explanation || (explanation.length >= explanationLength.min && explanation.length <= explanationLength.max);
  if (!chainId || !userId || text.length < 1 || text.length > 2000 || !validExplanation || !isAudienceId(body?.locale)) {
    return fail("Give a chain, a joke of at most 2,000 characters, an interface language, and an account.", 400);
  }
  const client = createServerSupabase();
  if (!client || !isClaudeConfigured()) return fail("The site is not configured to run chains.", 503);
  const { data: chain, error } = await client.from("prompt_chains").select("purpose").eq("id", chainId)
    .abortSignal(AbortSignal.timeout(15_000)).maybeSingle();
  if (error) throw error;
  if (!chain || chain.purpose === "media") return fail("This chain does not run on the site.", 404);

  const who = { client, userId, source: "studio" as const, signal: request.signal, chainId };
  try {
    if (chain.purpose === "preview") {
      const { result, requestId } = await runPreview(who, text, body!.locale as "en");
      return Response.json({ requestId, reading: result.suitable ? result.punchline : null, result }, { headers: noStore });
    }
    const { result, requestId, reading } = await adaptJoke(who, text, explanation || undefined);
    return Response.json({ requestId, reading, result }, { headers: noStore });
  } catch (runError) {
    const detail = runError instanceof Error ? runError.message : "The chain failed.";
    console.error("A Studio test run failed:", detail);
    return fail(detail.slice(0, 300), 502);
  }
}
