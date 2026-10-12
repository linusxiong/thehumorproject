import { auth, stableUserId } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase-server";

type VoteSummary = { upvotes: number; downvotes: number; user_vote: number | null };

async function votingContext(request: Request, captionId: number) {
  const session = await auth.api.getSession({ headers: request.headers });
  const client = createServerSupabase();
  const userId = session ? stableUserId(session.user) : null;
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
      .abortSignal(AbortSignal.timeout(15_000)).single<VoteSummary>();
    if (error) throw error;
    // Counts stay hidden until this account has rated the caption, so totals cannot bias the vote.
    const summary = data.user_vote === null ? { user_vote: null } : data;
    return Response.json(summary, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ error: "Vote counts could not be loaded. Please try again." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return mutateVote(request, false);
}

export async function DELETE(request: Request) {
  return mutateVote(request, true);
}

async function mutateVote(request: Request, withdraw: boolean) {
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
    const mutation = withdraw
      ? client.from("caption_votes").delete().eq("caption_id", body.captionId).eq("user_id", userId).eq("vote", body.vote)
      : client.from("caption_votes").insert({ caption_id: body.captionId, user_id: userId, vote: body.vote });
    const { error } = await mutation.abortSignal(AbortSignal.timeout(15_000));
    if (error?.code === "23505") return Response.json({ error: "You have already voted on this caption." }, { status: 409 });
    if (error?.code === "23503") return Response.json({ error: "This caption no longer exists." }, { status: 404 });
    if (error) throw error;
    return Response.json({ vote: withdraw ? null : body.vote }, { status: withdraw ? 200 : 201 });
  } catch {
    return Response.json({ error: "Your vote could not be updated. Please try again." }, { status: 500 });
  }
}
