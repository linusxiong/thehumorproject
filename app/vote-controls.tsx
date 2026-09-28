"use client";

import { Button } from "@heroui/react";
import { useEffect, useRef, useState } from "react";
import { authClient } from "./auth-controls";

type Votes = { upvotes: number; downvotes: number; user_vote: number | null };

export function VoteControls({ captionId }: { captionId: number }) {
  const { data: session, isPending } = authClient.useSession();
  const userId = session?.user.id;
  const submitting = useRef(false);
  const [busy, setBusy] = useState(false);
  const [votes, setVotes] = useState<Votes | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | undefined>();
  const [error, setError] = useState("");

  useEffect(() => {
    if (isPending || busy) return;
    const controller = new AbortController();
    fetch(`/api/caption-votes?captionId=${captionId}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        if (!controller.signal.aborted) {
          setVotes(result);
          setLoadedFor(userId);
          setError("");
        }
      })
      .catch(() => { if (!controller.signal.aborted) setError("Vote counts could not be loaded. Refresh to retry."); });
    return () => controller.abort();
  }, [captionId, userId, isPending, busy]);

  async function vote(value: 1 | -1) {
    if (!session || !votes || (votes.user_vote !== null && votes.user_vote !== value) || loadedFor !== userId || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    const previous = votes;
    const withdraw = votes.user_vote === value;
    const change = withdraw ? -1 : 1;
    setVotes({ upvotes: votes.upvotes + (value === 1 ? change : 0), downvotes: votes.downvotes + (value === -1 ? change : 0), user_vote: withdraw ? null : value });
    try {
      const response = await fetch("/api/caption-votes", {
        method: withdraw ? "DELETE" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ captionId, vote: value }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Your vote could not be saved.");
    } catch (reason) {
      setVotes(previous);
      setError(reason instanceof Error ? reason.message : "Your vote could not be saved.");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  const disabled = isPending || !session || !votes || loadedFor !== userId || busy;
  return (
    <div className="relative flex gap-1" role="group" aria-label="Rate this caption" aria-busy={busy}
      title={!session ? "Sign in to vote" : votes?.user_vote != null ? "Click your selected arrow to withdraw your vote" : "Upvote or downvote"}>
      {([1, -1] as const).map((value) => (
        <Button key={value} size="sm" variant={votes?.user_vote === value ? "secondary" : "ghost"}
          className="min-w-0 gap-1 px-2 tabular-nums" isDisabled={disabled || (votes?.user_vote != null && votes.user_vote !== value)}
          aria-label={votes?.user_vote === value ? (value === 1 ? "Withdraw upvote" : "Withdraw downvote") : (value === 1 ? "Upvote" : "Downvote")} aria-pressed={votes?.user_vote === value}
          onPress={() => vote(value)}>
          <span aria-hidden="true" className="text-lg">{value === 1 ? "↑" : "↓"}</span>
          <span aria-live="polite">{votes ? (value === 1 ? votes.upvotes : votes.downvotes) : "—"}</span>
        </Button>
      ))}
      {error && <span role="alert" className="text-danger" title={error} aria-label={error}>!</span>}
    </div>
  );
}
