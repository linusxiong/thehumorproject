import { adminRequest, fail, loadMedia, noStore } from "@/lib/admin";
import { isClaudeConfigured } from "@/lib/claude";
import { adaptJoke, settleAdaptation, type Adaptation } from "@/lib/generation";
import { explanationLength, jokeLength } from "@/lib/jokes";
import { rememberProfile } from "@/lib/supabase-server";

// One adaptation request may take up to 100 seconds, plus database round trips.
export const maxDuration = 120;

// Every AI-generated version, for superadmins only.
export async function GET(request: Request) {
  try {
    const admin = await adminRequest(request);
    if (admin instanceof Response) return admin;
    return Response.json(await loadMedia(admin.client), { headers: noStore });
  } catch (error) {
    console.error("Failed to load AI media:", error instanceof Error ? error.message : error);
    return fail("AI media could not be loaded. Please try again.", 500);
  }
}

// Generate new AI media: Claude adapts a joke for all three cultures with the same request members use.
// The joke is stored as a member joke by the superadmin's own account; superadmins skip the daily limit.
export async function POST(request: Request) {
  try {
    const admin = await adminRequest(request);
    if (admin instanceof Response) return admin;
    const input = await request.json().catch(() => null);
    const body = typeof input?.body === "string" ? input.body.trim() : "";
    if (body.length < jokeLength.min || body.length > jokeLength.max) {
      return fail(`Write a joke between ${jokeLength.min} and ${jokeLength.max} characters.`, 400);
    }
    const explanation = typeof input.explanation === "string" ? input.explanation.trim() : "";
    if ((input.explanation != null && typeof input.explanation !== "string")
      || (explanation && (explanation.length < explanationLength.min || explanation.length > explanationLength.max))) {
      return fail(`Explain the joke in ${explanationLength.min} to ${explanationLength.max} characters.`, 400);
    }
    if (!isClaudeConfigured()) return fail("AI generation is not configured yet.", 503);

    let adaptation: Adaptation;
    try {
      adaptation = await adaptJoke({ client: admin.client, userId: admin.userId, source: "admin", signal: request.signal }, body, explanation || undefined);
    } catch (error) {
      console.error("Admin joke adaptation failed:", error instanceof Error ? error.message : error);
      return fail("The joke could not be adapted right now. Please try again.", 502);
    }
    const { result } = adaptation;
    if (!result.suitable) return fail("Please use a self-contained joke in English, Spanish, or Chinese that is not hateful or harassing.", 422);
    if (!result.explanationAccepted) return fail("The explanation does not seem to match this joke.", 422);

    const authorName = admin.user.name.trim().split(/\s+/)[0]?.slice(0, 100) || "Member";
    const { data: jokeId, error } = await admin.client.rpc("create_joke", {
      p_author_id: admin.userId, p_author_name: authorName, p_body: body, p_source_language: result.sourceLanguage,
      p_adaptations: result.adaptations, p_adult: result.adult, p_explanation: explanation || null,
    }).abortSignal(AbortSignal.timeout(15_000));
    if (error) {
      await settleAdaptation(adaptation, { error: "The joke could not be stored." });
      throw error;
    }
    await settleAdaptation(adaptation, { jokeId: Number(jokeId) });
    await rememberProfile(admin.client, admin.userId, admin.user);
    return Response.json({ jokeId: Number(jokeId), versions: result.adaptations.length }, { status: 201, headers: noStore });
  } catch (error) {
    console.error("Failed to generate AI media:", error instanceof Error ? error.message : error);
    return fail("The AI media could not be created. Please try again.", 500);
  }
}
