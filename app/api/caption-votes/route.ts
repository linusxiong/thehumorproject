import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@/lib/auth";

async function votingContext(request: Request, captionId: number) {
  const session = await auth.api.getSession({ headers: request.headers });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const client = url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
  // Stateless Better Auth user IDs can change; verified email identifies returning voters.
  const userId = session?.user.emailVerified
    ? createHash("sha256").update(session.user.email.trim().toLowerCase()).digest("hex") : null;
  if (client && userId && session && Number.isSafeInteger(captionId) && captionId > 0) {
    // Bind historical votes to the stable identity while their original session is available.
    const { error } = await client.from("caption_votes").update({ user_id: userId })
      .eq("caption_id", captionId).eq("user_id", session.user.id).abortSignal(AbortSignal.timeout(15_000));
    if (error) throw new Error("Could not identify existing votes.");
  }
  return { client, session, userId };
}

export async function GET(request: Request) {
  const captionId = Number(new URL(request.url).searchParams.get("captionId"));
  if (!Number.isSafeInteger(captionId) || captionId <= 0) {
    return Response.json({ error: "Invalid caption." }, { status: 400 });
  }
  try {
    const { client, userId } = await votingContext(request, captionId);
    if (!client) return Response.json({ error: "Voting is not configured yet." }, { status: 503 });
    const { data, error } = await client.rpc("caption_vote_summary", { p_caption_id: captionId, p_user_id: userId })
      .abortSignal(AbortSignal.timeout(15_000)).single();
    if (error) throw error;
    return Response.json(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ error: "Vote counts could not be loaded. Please try again." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  }
  try {
    const body = await request.json().catch(() => null);
    const { client, session, userId } = await votingContext(request, body?.captionId);
    if (!session) return Response.json({ error: "Please sign in to vote." }, { status: 401 });
    if (!userId) return Response.json({ error: "A verified email is required to vote." }, { status: 403 });
    if (!Number.isSafeInteger(body?.captionId) || body.captionId <= 0 || (body.vote !== 1 && body.vote !== -1)) {
      return Response.json({ error: "Choose a valid caption and an upvote or downvote." }, { status: 400 });
    }
    if (!client) return Response.json({ error: "Voting is not configured yet." }, { status: 503 });
    const { error } = await client.from("caption_votes").insert({
      caption_id: body.captionId, user_id: userId, vote: body.vote,
    }).abortSignal(AbortSignal.timeout(15_000));
    if (error?.code === "23505") return Response.json({ error: "You have already voted on this caption." }, { status: 409 });
    if (error?.code === "23503") return Response.json({ error: "This caption no longer exists." }, { status: 404 });
    if (error) throw error;
    return Response.json({ vote: body.vote }, { status: 201 });
  } catch {
    return Response.json({ error: "Your vote could not be saved. Please try again." }, { status: 500 });
  }
}
