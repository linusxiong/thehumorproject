import { auth, stableUserId } from "@/lib/auth";
import { analyzeJoke, isClaudeConfigured, type AnalysisResult } from "@/lib/claude";
import { isAudienceId, jokeLength, type JokeAnalysis } from "@/lib/jokes";

// Step one of sharing: explain what makes a joke funny, in the reader's interface language, so the author can confirm
// or correct it before the joke is adapted. Nothing is stored.
// One analysis request may take up to 100 seconds.
export const maxDuration = 120;

const noStore = { "Cache-Control": "private, no-store" };
const fail = (error: string, status: number) => Response.json({ error }, { status, headers: noStore });

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return fail("Invalid request origin.", 403);
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return fail("Please sign in to share a joke.", 401);
    if (!stableUserId(session.user)) return fail("A verified email is required to share a joke.", 403);
    const input = await request.json().catch(() => null);
    const body = typeof input?.body === "string" ? input.body.trim() : "";
    if (body.length < jokeLength.min || body.length > jokeLength.max) {
      return fail(`Write a joke between ${jokeLength.min} and ${jokeLength.max} characters.`, 400);
    }
    if (!isAudienceId(input.locale)) return fail("Choose a supported language.", 400);
    if (!isClaudeConfigured()) return fail("Joke adaptation is not configured yet.", 503);

    let result: AnalysisResult;
    try {
      result = await analyzeJoke(body, input.locale, request.signal);
    } catch (error) {
      console.error("Joke analysis failed:", error instanceof Error ? error.message : error);
      return fail("The joke could not be read right now. Please try again.", 502);
    }
    if (!result.suitable) {
      return fail("Please share a self-contained joke in English, Spanish, or Chinese that is not hateful or harassing.", 422);
    }
    const analysis: JokeAnalysis = { sourceLanguage: result.sourceLanguage, adult: result.adult, punchline: result.punchline };
    return Response.json(analysis, { headers: noStore });
  } catch (error) {
    console.error("Failed to analyze a joke:", error instanceof Error ? error.message : error);
    return fail("Your joke could not be read. Please try again.", 500);
  }
}
