import { createClient } from "@supabase/supabase-js";
import { auth } from "@/lib/auth";

export async function POST(request: Request) {
  // Cookie-authenticated mutations must originate from this app.
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return Response.json({ error: "Please sign in to vote." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!Number.isSafeInteger(body?.captionId) || body.captionId <= 0 || (body.vote !== 1 && body.vote !== -1)) {
    return Response.json({ error: "Choose a valid caption and an upvote or downvote." }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return Response.json({ error: "Voting is not configured yet. Please contact the site owner." }, { status: 503 });
  }

  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.from("caption_votes").insert({
    caption_id: body.captionId,
    user_id: session.user.id,
    vote: body.vote,
  }).abortSignal(AbortSignal.timeout(15_000));

  if (error) {
    if (error.code === "23503") {
      return Response.json({ error: "This caption no longer exists. Please refresh the collection." }, { status: 404 });
    }
    console.error("Failed to save caption vote:", error.code);
    return Response.json({ error: "Your vote could not be saved. Please try again." }, { status: 500 });
  }

  return Response.json({ vote: body.vote }, { status: 201 });
}
