import { adminRequest, fail, noStore, parseId } from "@/lib/admin";

// Every model call of one AI request, with what was sent after the system prompt and the model's answer.
export async function GET(request: Request, context: RouteContext<"/api/admin/generation-requests/[id]">) {
  try {
    const admin = await adminRequest(request);
    if (admin instanceof Response) return admin;
    const id = parseId((await context.params).id);
    if (id === null) return fail("Unknown request.", 404);
    const { data, error } = await admin.client.from("generation_requests")
      .select("id, responses:llm_responses(*, step:prompt_chain_steps(name, position))")
      .eq("id", id).order("id", { referencedTable: "llm_responses" }).abortSignal(AbortSignal.timeout(15_000)).maybeSingle();
    if (error) throw error;
    if (!data) return fail("Unknown request.", 404);
    return Response.json(data.responses, { headers: noStore });
  } catch (error) {
    console.error("Failed to load an AI request:", error instanceof Error ? error.message : error);
    return fail("The request could not be loaded. Please try again.", 500);
  }
}
