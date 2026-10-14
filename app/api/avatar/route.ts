import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { auth, stableUserId } from "@/lib/auth";
import { avatarBucket as bucket, createServerSupabase, rememberGoogleAvatar } from "@/lib/supabase-server";

const maxBytes = 2 * 1024 * 1024;
const ascii = (bytes: Uint8Array, start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end));
// Trust the file's leading bytes, never the client-supplied name or type.
const formats = [
  { type: "image/jpeg", extension: "jpg", matches: (bytes: Uint8Array) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  { type: "image/png", extension: "png", matches: (bytes: Uint8Array) => ascii(bytes, 0, 8) === "\x89PNG\r\n\x1a\n" },
  { type: "image/webp", extension: "webp", matches: (bytes: Uint8Array) => ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP" },
];
const noStore = { "Cache-Control": "private, no-store" };
const fail = (error: string, status: number) => Response.json({ error }, { status });

async function avatarContext(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  return { session, userId: session ? stableUserId(session.user) : null, client: createServerSupabase() };
}

function profile(client: SupabaseClient | null, googleUrl: string | null | undefined, source: string, path: string | null) {
  const uploadUrl = client && path ? client.storage.from(bucket).getPublicUrl(path).data.publicUrl : null;
  return { source, googleUrl: googleUrl || null, uploadUrl };
}

async function removePhoto(client: SupabaseClient, path: string | null) {
  if (!path) return;
  const { error } = await client.storage.from(bucket).remove([path]);
  if (error) console.error("Failed to remove a replaced avatar:", error.message);
}

export async function GET(request: Request) {
  try {
    const { session, userId, client } = await avatarContext(request);
    if (!session) return fail("Please sign in to see your profile photo.", 401);
    if (!client || !userId) return Response.json(profile(client, session.user.image, "google", null), { headers: noStore });
    const { data, error } = await client.from("user_profiles").select("avatar_source,avatar_path,google_url")
      .eq("user_id", userId).abortSignal(AbortSignal.timeout(15_000)).maybeSingle();
    if (error) throw error;
    // The header loads this on every visit, which keeps the photo shown on the member's jokes current.
    if (session.user.image && data?.google_url !== session.user.image) await rememberGoogleAvatar(client, userId, session.user.image);
    return Response.json(profile(client, session.user.image, data?.avatar_source ?? "google", data?.avatar_path ?? null), { headers: noStore });
  } catch {
    return fail("Your profile photo could not be loaded. Please try again.", 500);
  }
}

// Upload a new photo and make it the active avatar.
export async function POST(request: Request) {
  return mutate(request, async ({ client, userId, googleUrl }) => {
    if (Number(request.headers.get("content-length")) > maxBytes + 64 * 1024) return fail("Photos must be 2 MB or smaller.", 413);
    const file = (await request.formData().catch(() => null))?.get("file");
    if (!(file instanceof Blob) || file.size === 0) return fail("Choose a photo to upload.", 400);
    if (file.size > maxBytes) return fail("Photos must be 2 MB or smaller.", 413);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const format = formats.find((candidate) => candidate.matches(bytes));
    if (!format) return fail("Choose a JPEG, PNG, or WebP image.", 415);
    const path = `${randomUUID()}.${format.extension}`;
    const { error: uploadError } = await client.storage.from(bucket)
      .upload(path, bytes, { contentType: format.type, cacheControl: "31536000", upsert: false });
    if (uploadError) throw uploadError;
    const { data: previous, error } = await client.rpc("replace_avatar", { p_user_id: userId, p_path: path })
      .abortSignal(AbortSignal.timeout(15_000));
    if (error) {
      await removePhoto(client, path);
      throw error;
    }
    await removePhoto(client, previous);
    return Response.json(profile(client, googleUrl, "upload", path), { status: 201 });
  });
}

// Switch between the Google photo and the uploaded photo without deleting either.
export async function PATCH(request: Request) {
  return mutate(request, async ({ client, userId, googleUrl }) => {
    const source = (await request.json().catch(() => null))?.source;
    if (source !== "google" && source !== "upload") return fail("Choose your Google photo or an uploaded photo.", 400);
    const { data, error } = await client.from("user_profiles").update({ avatar_source: source, updated_at: new Date().toISOString() })
      .eq("user_id", userId).not("avatar_path", "is", null).select("avatar_path")
      .abortSignal(AbortSignal.timeout(15_000)).maybeSingle();
    if (error) throw error;
    if (!data && source === "upload") return fail("Upload a photo first.", 409);
    return Response.json(profile(client, googleUrl, data ? source : "google", data?.avatar_path ?? null));
  });
}

// Delete the uploaded photo and fall back to the Google photo.
export async function DELETE(request: Request) {
  return mutate(request, async ({ client, userId, googleUrl }) => {
    const { data: previous, error } = await client.rpc("replace_avatar", { p_user_id: userId, p_path: null })
      .abortSignal(AbortSignal.timeout(15_000));
    if (error) throw error;
    await removePhoto(client, previous);
    return Response.json(profile(client, googleUrl, "google", null));
  });
}

type MutationContext = { client: SupabaseClient; userId: string; googleUrl: string | null | undefined };

async function mutate(request: Request, run: (context: MutationContext) => Promise<Response>) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return fail("Invalid request origin.", 403);
  try {
    const { session, userId, client } = await avatarContext(request);
    if (!session) return fail("Please sign in to change your profile photo.", 401);
    if (!userId) return fail("A verified email is required to change your profile photo.", 403);
    if (!client) return fail("Profile photos are not configured yet.", 503);
    return await run({ client, userId, googleUrl: session.user.image });
  } catch {
    return fail("Your profile photo could not be updated. Please try again.", 500);
  }
}
