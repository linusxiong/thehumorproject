import { adminRequest, fail, noStore } from "@/lib/admin";
import { isPhotoPath } from "@/lib/photos";
import { avatarBucket } from "@/lib/supabase-server";

// Show or hide an uploaded photo on its account ({ inUse }). Hiding switches the account back to its Google photo
// and keeps the file, just like the member's own switch.
export async function PATCH(request: Request, context: RouteContext<"/api/admin/images/[path]">) {
  try {
    const admin = await adminRequest(request);
    if (admin instanceof Response) return admin;
    const { path } = await context.params;
    if (!isPhotoPath(path)) return fail("Unknown image.", 404);
    const inUse = (await request.json().catch(() => null))?.inUse;
    if (typeof inUse !== "boolean") return fail("Choose whether the account shows this photo.", 400);
    const { data, error } = await admin.client.from("user_profiles")
      .update({ avatar_source: inUse ? "upload" : "google", updated_at: new Date().toISOString() })
      .eq("avatar_path", path).select("user_id").abortSignal(AbortSignal.timeout(15_000)).maybeSingle();
    if (error) throw error;
    if (!data) return fail("This photo does not belong to an account.", 409);
    return Response.json({ path, in_use: inUse }, { headers: noStore });
  } catch (error) {
    console.error("Failed to update an image:", error instanceof Error ? error.message : error);
    return fail("The photo could not be updated. Please try again.", 500);
  }
}

// Delete a photo for good. An account that used it falls back to its Google photo.
export async function DELETE(request: Request, context: RouteContext<"/api/admin/images/[path]">) {
  try {
    const admin = await adminRequest(request);
    if (admin instanceof Response) return admin;
    const { path } = await context.params;
    if (!isPhotoPath(path)) return fail("Unknown image.", 404);
    // Detach first, and only while the account still points at this photo.
    const { error: detachError } = await admin.client.from("user_profiles")
      .update({ avatar_source: "google", avatar_path: null, updated_at: new Date().toISOString() })
      .eq("avatar_path", path).abortSignal(AbortSignal.timeout(15_000));
    if (detachError) throw detachError;
    const { data, error } = await admin.client.storage.from(avatarBucket).remove([path]);
    if (error) throw error;
    if (!data?.length) return fail("Unknown image.", 404);
    return Response.json({ path }, { headers: noStore });
  } catch (error) {
    console.error("Failed to delete an image:", error instanceof Error ? error.message : error);
    return fail("The photo could not be deleted. Please try again.", 500);
  }
}
