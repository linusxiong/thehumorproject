import { adminRequest, fail, noStore, parseId, parseMediaUpdate } from "@/lib/admin";
import { isAudienceId } from "@/lib/jokes";

// Correct one AI-generated version in place. Its ratings stay, because a superadmin edit fixes rather than replaces it.
export async function PATCH(request: Request, context: RouteContext<"/api/admin/media/[id]">) {
  try {
    const admin = await adminRequest(request);
    if (admin instanceof Response) return admin;
    const id = parseId((await context.params).id);
    if (id === null) return fail("Unknown version.", 404);
    const { data: current, error: loadError } = await admin.client.from("joke_adaptations").select("audience").eq("id", id)
      .abortSignal(AbortSignal.timeout(15_000)).maybeSingle();
    if (loadError) throw loadError;
    if (!current || !isAudienceId(current.audience)) return fail("Unknown version.", 404);
    const update = parseMediaUpdate(await request.json().catch(() => null), current.audience);
    if (!update) return fail("Each field needs text within its length limit.", 400);
    const { data, error } = await admin.client.from("joke_adaptations").update({ ...update, updated_at: new Date().toISOString() })
      .eq("id", id).select("id, updated_at").abortSignal(AbortSignal.timeout(15_000)).maybeSingle();
    if (error) throw error;
    if (!data) return fail("Unknown version.", 404);
    return Response.json(data, { headers: noStore });
  } catch (error) {
    console.error("Failed to update AI media:", error instanceof Error ? error.message : error);
    return fail("The version could not be saved. Please try again.", 500);
  }
}

// Delete one AI-generated version; its ratings are deleted with it.
export async function DELETE(request: Request, context: RouteContext<"/api/admin/media/[id]">) {
  try {
    const admin = await adminRequest(request);
    if (admin instanceof Response) return admin;
    const id = parseId((await context.params).id);
    if (id === null) return fail("Unknown version.", 404);
    const { data, error } = await admin.client.from("joke_adaptations").delete().eq("id", id).select("id")
      .abortSignal(AbortSignal.timeout(15_000)).maybeSingle();
    if (error) throw error;
    if (!data) return fail("Unknown version.", 404);
    return Response.json(data, { headers: noStore });
  } catch (error) {
    console.error("Failed to delete AI media:", error instanceof Error ? error.message : error);
    return fail("The version could not be deleted. Please try again.", 500);
  }
}
