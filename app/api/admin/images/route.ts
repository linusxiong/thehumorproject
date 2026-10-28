import { randomUUID } from "node:crypto";
import { adminRequest, fail, noStore } from "@/lib/admin";
import { maxPhotoBytes, photoFormat } from "@/lib/photos";
import { avatarBucket } from "@/lib/supabase-server";

// Upload a new profile photo for an account (multipart: file, userId). It replaces the account's uploaded photo,
// if any, and becomes the photo the account shows, exactly as if the member had uploaded it.
export async function POST(request: Request) {
  try {
    const admin = await adminRequest(request);
    if (admin instanceof Response) return admin;
    if (Number(request.headers.get("content-length")) > maxPhotoBytes + 64 * 1024) return fail("Photos must be 2 MB or smaller.", 413);
    const form = await request.formData().catch(() => null);
    const userId = form?.get("userId");
    const file = form?.get("file");
    if (typeof userId !== "string" || !/^[0-9a-f]{64}$/.test(userId)) return fail("Choose an account.", 400);
    if (!(file instanceof Blob) || file.size === 0) return fail("Choose a photo to upload.", 400);
    if (file.size > maxPhotoBytes) return fail("Photos must be 2 MB or smaller.", 413);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const format = photoFormat(bytes);
    if (!format) return fail("Choose a JPEG, PNG, or WebP image.", 415);

    const { data: profile, error: profileError } = await admin.client.from("user_profiles").select("user_id").eq("user_id", userId)
      .abortSignal(AbortSignal.timeout(15_000)).maybeSingle();
    if (profileError) throw profileError;
    if (!profile) return fail("Unknown account.", 404);

    const storage = admin.client.storage.from(avatarBucket);
    const path = `${randomUUID()}.${format.extension}`;
    const { error: uploadError } = await storage.upload(path, bytes, { contentType: format.type, cacheControl: "31536000", upsert: false });
    if (uploadError) throw uploadError;
    const { data: previous, error } = await admin.client.rpc("replace_avatar", { p_user_id: userId, p_path: path })
      .abortSignal(AbortSignal.timeout(15_000));
    if (error) {
      await storage.remove([path]);
      throw error;
    }
    if (previous) {
      const { error: removeError } = await storage.remove([previous]);
      if (removeError) console.error("Failed to remove a replaced avatar:", removeError.message);
    }
    return Response.json({ path, url: storage.getPublicUrl(path).data.publicUrl }, { status: 201, headers: noStore });
  } catch (error) {
    console.error("Failed to upload an image:", error instanceof Error ? error.message : error);
    return fail("The photo could not be uploaded. Please try again.", 500);
  }
}
