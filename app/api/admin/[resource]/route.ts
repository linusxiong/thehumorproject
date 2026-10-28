import { adminRequest, fail, loadResource, noStore, writeFailure } from "@/lib/admin";
import { isResourceName, parseResourceInput, resources } from "@/lib/admin-resources";

// Simple admin tables (terms, generation examples, LLM models and providers, sign-up domains and emails):
// list every row, or create one. lib/admin-resources.ts defines the tables and validates every field.
export async function GET(request: Request, context: RouteContext<"/api/admin/[resource]">) {
  try {
    const admin = await adminRequest(request);
    if (admin instanceof Response) return admin;
    const { resource } = await context.params;
    if (!isResourceName(resource)) return fail("Unknown admin resource.", 404);
    return Response.json(await loadResource(admin.client, resource), { headers: noStore });
  } catch (error) {
    console.error("Failed to load an admin resource:", error instanceof Error ? error.message : error);
    return fail("The list could not be loaded. Please try again.", 500);
  }
}

export async function POST(request: Request, context: RouteContext<"/api/admin/[resource]">) {
  try {
    const admin = await adminRequest(request);
    if (admin instanceof Response) return admin;
    const { resource } = await context.params;
    if (!isResourceName(resource)) return fail("Unknown admin resource.", 404);
    const row = parseResourceInput(resource, await request.json().catch(() => null));
    if (!row) return fail("Each field needs a valid value within its length limit.", 400);
    const { data, error } = await admin.client.from(resources[resource].table).insert(row).select(resources[resource].select)
      .abortSignal(AbortSignal.timeout(15_000)).single();
    if (error) return writeFailure(error, "create");
    return Response.json(data, { status: 201, headers: noStore });
  } catch (error) {
    console.error("Failed to create an admin record:", error instanceof Error ? error.message : error);
    return fail("The record could not be created. Please try again.", 500);
  }
}
