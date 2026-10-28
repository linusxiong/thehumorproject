import { adminRequest, fail, noStore, parseId, writeFailure } from "@/lib/admin";
import { isResourceName, parseResourceInput, resources } from "@/lib/admin-resources";

// Update or delete one row of a simple admin table. A row that other rows still use (a provider with models,
// or a model a prompt chain step runs on) cannot be deleted.
export async function PATCH(request: Request, context: RouteContext<"/api/admin/[resource]/[id]">) {
  try {
    const admin = await adminRequest(request);
    if (admin instanceof Response) return admin;
    const params = await context.params;
    const id = parseId(params.id);
    if (!isResourceName(params.resource) || id === null) return fail("Unknown record.", 404);
    const { table, select } = resources[params.resource];
    const row = parseResourceInput(params.resource, await request.json().catch(() => null));
    if (!row) return fail("Each field needs a valid value within its length limit.", 400);
    const { data, error } = await admin.client.from(table).update({ ...row, updated_at: new Date().toISOString() }).eq("id", id)
      .select(select).abortSignal(AbortSignal.timeout(15_000)).maybeSingle();
    if (error) return writeFailure(error, "update");
    if (!data) return fail("Unknown record.", 404);
    return Response.json(data, { headers: noStore });
  } catch (error) {
    console.error("Failed to update an admin record:", error instanceof Error ? error.message : error);
    return fail("The record could not be saved. Please try again.", 500);
  }
}

export async function DELETE(request: Request, context: RouteContext<"/api/admin/[resource]/[id]">) {
  try {
    const admin = await adminRequest(request);
    if (admin instanceof Response) return admin;
    const params = await context.params;
    const id = parseId(params.id);
    if (!isResourceName(params.resource) || id === null) return fail("Unknown record.", 404);
    const { data, error } = await admin.client.from(resources[params.resource].table).delete().eq("id", id).select("id")
      .abortSignal(AbortSignal.timeout(15_000)).maybeSingle();
    if (error) return writeFailure(error, "delete");
    if (!data) return fail("Unknown record.", 404);
    return Response.json(data, { headers: noStore });
  } catch (error) {
    console.error("Failed to delete an admin record:", error instanceof Error ? error.message : error);
    return fail("The record could not be deleted. Please try again.", 500);
  }
}
