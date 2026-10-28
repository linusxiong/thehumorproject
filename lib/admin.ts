import type { SupabaseClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth, stableUserId } from "@/lib/auth";
import { resources, type ResourceName, type ResourceRows } from "@/lib/admin-resources";
import {
  mediaLimits, type AccessSummary, type AdminAccount, type AdminImage, type AdminRating, type AdminUser, type DashboardStats,
  type GenerationRequest, type LlmResponseSummary, type MediaItem, type MediaUpdate, type PromptChain,
} from "@/lib/admin-types";
import { audiences, type AudienceId } from "@/lib/jokes";
import { avatarBucket, createServerSupabase } from "@/lib/supabase-server";

// Server-only data access layer for the admin area. Every admin page, layout, and Route Handler checks access
// here, as close to the data as possible; proxy.ts only turns away requests without a session cookie early.

export type AdminAccess =
  | { status: "anonymous" }
  // Signed in, but not a superadmin (or the email is unverified, or the database is not configured).
  | { status: "forbidden"; user: AdminUser }
  | { status: "admin"; user: AdminUser; userId: string; client: SupabaseClient };

const timeout = () => AbortSignal.timeout(15_000);

const avatarUrl = (client: SupabaseClient, path: string | null, googleUrl: string | null) =>
  path ? client.storage.from(avatarBucket).getPublicUrl(path).data.publicUrl : googleUrl;

async function checkAccess(requestHeaders: Headers): Promise<AdminAccess> {
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session) return { status: "anonymous" };
  const image = session.user.image ?? null;
  const user: AdminUser = { name: session.user.name, email: session.user.email, image, avatar: image };
  const userId = stableUserId(session.user);
  const client = createServerSupabase();
  if (!userId || !client) return { status: "forbidden", user };
  // Read the flag on every request; a revoked superadmin loses access immediately. Errors fail closed.
  const { data, error } = await client.from("user_profiles").select("is_superadmin,avatar_source,avatar_path,google_url").eq("user_id", userId)
    .abortSignal(timeout()).maybeSingle();
  if (error) throw error;
  if (data?.is_superadmin !== true) return { status: "forbidden", user };
  // Show the avatar the member chose on the site: an uploaded photo, or their Google photo.
  const avatar = avatarUrl(client, data.avatar_source === "upload" ? data.avatar_path : null, image ?? data.google_url);
  return { status: "admin", user: { ...user, avatar: avatar ?? null }, userId, client };
}

// Pages and layouts: memoized for one render pass, so the layout and page share a single check.
export const getAdminAccess = cache(async () => checkAccess(await headers()));

// Every admin page calls this itself, because layouts do not re-run on client navigation.
export async function requireAdmin() {
  const access = await getAdminAccess();
  if (access.status !== "admin") redirect("/admin/login");
  return access;
}

export const noStore = { "Cache-Control": "private, no-store" };
export const fail = (error: string, status: number) => Response.json({ error }, { status, headers: noStore });

// Route Handlers: returns the admin context, or the error response to send. Changes must come from this site.
export async function adminRequest(request: Request): Promise<Extract<AdminAccess, { status: "admin" }> | Response> {
  if (request.method !== "GET" && request.headers.get("origin") !== new URL(request.url).origin) {
    return fail("Invalid request origin.", 403);
  }
  const access = await checkAccess(request.headers);
  if (access.status === "anonymous") return fail("Please sign in with Google.", 401);
  if (access.status === "forbidden") return fail("Only superadmins can use the admin area.", 403);
  return access;
}

export const parseId = (value: string) => (/^[1-9]\d{0,15}$/.test(value) ? Number(value) : null);

// Database errors a superadmin can fix: a duplicate, a row still in use, or a reference to a missing row.
export function writeFailure(error: { code?: string; message: string }, action: "create" | "update" | "delete") {
  if (error.code === "23505") return fail("A record with this value already exists.", 409);
  // 23001: a restricted reference (a model a chain step runs on, a provider with models); 23503: any other reference.
  if (error.code === "23503" || error.code === "23001") {
    return action === "delete" ? fail("Other records still use this one. Change or delete them first.", 409) : fail("The linked record does not exist.", 400);
  }
  if (error.code === "23514" || error.code === "22P02") return fail("Each field needs a valid value within its length limit.", 400);
  throw new Error(error.message);
}

export async function loadDashboard(client: SupabaseClient, days: number): Promise<DashboardStats> {
  const { data, error } = await client.rpc("admin_dashboard", { p_days: days }).abortSignal(timeout());
  if (error) throw error;
  return data as DashboardStats;
}

export async function loadAccounts(client: SupabaseClient): Promise<AdminAccount[]> {
  const { data, error } = await client.rpc("admin_users").abortSignal(timeout());
  if (error) throw error;
  type Row = Omit<AdminAccount, "avatar_url"> & { avatar_path: string | null; google_url: string | null };
  return ((data ?? []) as Row[]).map(({ avatar_path: path, google_url: googleUrl, ...row }) =>
    ({ ...row, avatar_url: avatarUrl(client, path, googleUrl) ?? null }));
}

export async function loadMedia(client: SupabaseClient): Promise<MediaItem[]> {
  const { data, error } = await client.rpc("admin_media").abortSignal(timeout());
  if (error) throw error;
  return (data ?? []) as MediaItem[];
}

export async function loadRatings(client: SupabaseClient): Promise<AdminRating[]> {
  const { data, error } = await client.rpc("admin_ratings", { p_limit: 1000 }).abortSignal(timeout());
  if (error) throw error;
  return (data ?? []) as AdminRating[];
}

const text = (value: unknown, max: number) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length >= 1 && trimmed.length <= max ? trimmed : null;
};

function localizedText(value: unknown, max: number) {
  if (!value || typeof value !== "object") return null;
  const result: Partial<Record<AudienceId, string>> = {};
  for (const { id } of audiences) {
    const entry = (value as Record<string, unknown>)[id];
    if (entry === undefined || entry === null || entry === "") continue;
    const checked = text(entry, max);
    if (!checked) return null;
    result[id] = checked;
  }
  return Object.keys(result).length > 0 ? result : null;
}

// Validates a superadmin's edit. Commentary needs at least one language; the version's own-language gloss is its body.
export function parseMediaUpdate(input: unknown, audience: AudienceId): MediaUpdate | null {
  if (!input || typeof input !== "object") return null;
  const value = input as Record<string, unknown>;
  const body = text(value.body, mediaLimits.body);
  const gloss = localizedText(value.gloss ?? {}, mediaLimits.gloss) ?? {};
  const punchlineCore = localizedText(value.punchline_core, mediaLimits.punchline_core);
  const notes = localizedText(value.notes, mediaLimits.notes);
  if (!body || !punchlineCore || !notes) return null;
  return { body, gloss: { ...gloss, [audience]: body }, punchline_core: punchlineCore, notes };
}

export async function loadResource<Name extends ResourceName>(client: SupabaseClient, name: Name): Promise<ResourceRows[Name][]> {
  const { table, select, order } = resources[name];
  const [column, direction] = order.split(".");
  const { data, error } = await client.from(table).select(select).order(column, { ascending: direction !== "desc" }).order("id")
    .limit(5000).abortSignal(timeout());
  if (error) throw error;
  return (data ?? []) as unknown as ResourceRows[Name][];
}

export async function loadPromptChains(client: SupabaseClient): Promise<PromptChain[]> {
  const { data, error } = await client.rpc("admin_prompt_chains").abortSignal(timeout());
  if (error) throw error;
  return (data ?? []) as PromptChain[];
}

export async function loadGenerationRequests(client: SupabaseClient): Promise<GenerationRequest[]> {
  const { data, error } = await client.rpc("admin_generation_requests", { p_limit: 1000 }).abortSignal(timeout());
  if (error) throw error;
  return (data ?? []) as GenerationRequest[];
}

export async function loadLlmResponses(client: SupabaseClient): Promise<LlmResponseSummary[]> {
  const { data, error } = await client.rpc("admin_llm_responses", { p_limit: 1000 }).abortSignal(timeout());
  if (error) throw error;
  return (data ?? []) as LlmResponseSummary[];
}

export async function loadImages(client: SupabaseClient): Promise<AdminImage[]> {
  const { data, error } = await client.rpc("admin_images").abortSignal(timeout());
  if (error) throw error;
  return ((data ?? []) as Omit<AdminImage, "url">[]).map((image) => ({ ...image, url: avatarUrl(client, image.path, null)! }));
}

export async function loadAccessSummary(client: SupabaseClient): Promise<AccessSummary> {
  const count = async (table: string) => {
    const { count: rows, error } = await client.from(table).select("id", { count: "exact", head: true }).abortSignal(timeout());
    if (error || rows === null) throw error ?? new Error(`Missing ${table} count.`);
    return rows;
  };
  const [domains, emails] = await Promise.all([count("allowed_signup_domains"), count("whitelisted_emails")]);
  return { domains, emails };
}
