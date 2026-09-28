"use client";

import { Button } from "@heroui/react";
import Link from "next/link";
import { useRef, useState } from "react";
import { authClient } from "./auth-controls";

export function VoteControls({ captionId }: { captionId: number }) {
  const { data: session, isPending } = authClient.useSession();
  const submitting = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function vote(value: 1 | -1) {
    if (!session || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/caption-votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ captionId, vote: value }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Your vote could not be saved.");
      setMessage(value === 1 ? "Upvote saved. Thank you!" : "Downvote saved. Thank you!");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Your vote could not be saved. Please try again.");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 border-t border-border pt-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Rate this caption" aria-busy={busy}>
        <Button size="sm" variant="outline" isDisabled={isPending || !session || busy} onPress={() => vote(1)}>↑ Upvote</Button>
        <Button size="sm" variant="outline" isDisabled={isPending || !session || busy} onPress={() => vote(-1)}>↓ Downvote</Button>
      </div>
      {!isPending && !session && <Link href="/login" className="text-xs text-accent underline underline-offset-4">Sign in to rate this caption</Link>}
      <p role="status" className="text-xs text-muted">{busy ? "Saving your vote…" : message}</p>
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
    </div>
  );
}
