import { adminRequest, fail, noStore, parseId } from "@/lib/admin";

// One model call in full, including what was sent after the system prompt and the model's answer.
export async function GET(request: Request, context: RouteContext<"/api/admin/llm-responses/[id]">) {
  try {
    const admin = await adminRequest(request);
    if (admin instanceof Response) return admin;
    const id = parseId((await context.params).id);
    if (id === null) return fail("Unknown response.", 404);
    const { data, error } = await admin.client.from("llm_responses").select("*").eq("id", id)
      .abortSignal(AbortSignal.timeout(15_000)).maybeSingle();
    if (error) throw error;
    if (!data) return fail("Unknown response.", 404);
    return Response.json(data, { headers: noStore });
  } catch (error) {
    console.error("Failed to load a model response:", error instanceof Error ? error.message : error);
    return fail("The response could not be loaded. Please try again.", 500);
  }
}
