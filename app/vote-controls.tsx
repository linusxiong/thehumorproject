"use client";

import { Chip, Spinner, ToggleButton } from "@heroui/react";
import { useEffect, useRef, useState } from "react";
import { authClient } from "./auth-controls";

// The server only sends totals after this account has voted, so they cannot bias the rating.
type Votes = { user_vote: number | null; upvotes?: number; downvotes?: number };

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
      .catch(() => { if (!controller.signal.aborted) setError("Votes could not be loaded. Refresh to retry."); });
    return () => controller.abort();
  }, [captionId, userId, isPending, busy]);

  async function vote(value: 1 | -1) {
    if (!session || !votes || (votes.user_vote !== null && votes.user_vote !== value) || loadedFor !== userId || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    const previous = votes;
    const withdraw = votes.user_vote === value;
    // Fresh totals arrive with the reconciling fetch after the vote is saved.
    setVotes({ user_vote: withdraw ? null : value });
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
  const voted = votes?.user_vote != null;
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Rate this caption" aria-busy={busy}
      title={!session ? "Sign in to vote" : voted ? "Click your selected arrow to withdraw your vote" : "Vote to see how others rated this caption"}>
      {([1, -1] as const).map((value) => (
        <ToggleButton key={value} size="sm" variant="ghost" isIconOnly={!voted} isSelected={votes?.user_vote === value}
          isDisabled={disabled || (voted && votes.user_vote !== value)} onChange={() => vote(value)}
          aria-label={votes?.user_vote === value ? (value === 1 ? "Withdraw upvote" : "Withdraw downvote") : (value === 1 ? "Upvote" : "Downvote")}>
          <span aria-hidden="true">{value === 1 ? "↑" : "↓"}</span>
          {voted && (votes.upvotes === undefined ? <Spinner size="sm" color="current" /> : value === 1 ? votes.upvotes : votes.downvotes)}
        </ToggleButton>
      ))}
      <span className="sr-only" aria-live="polite">
        {voted && votes.upvotes !== undefined ? `${votes.upvotes} upvotes, ${votes.downvotes} downvotes` : ""}
      </span>
      {error && <Chip role="alert" size="sm" color="danger" variant="soft" title={error} aria-label={error}>!</Chip>}
    </div>
  );
}
