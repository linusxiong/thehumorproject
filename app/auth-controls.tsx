"use client";

import { Button } from "@heroui/react";
import { createAuthClient } from "better-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const authClient = createAuthClient();

export function AuthControls() {
  const router = useRouter();
  const { data: session, isPending, error: sessionError } = authClient.useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function authenticate() {
    setBusy(true);
    setError(null);
    try {
      if (session) {
        const result = await authClient.signOut();
        if (result.error) throw new Error("Sign out failed. Please try again.");
        router.replace("/");
        router.refresh();
      } else {
        const result = await authClient.signIn.social({
          provider: "google",
          callbackURL: new URL("/members", window.location.origin).href,
          errorCallbackURL: new URL("/login", window.location.origin).href,
        });
        if (result.error) throw new Error("Sign in failed. Please try again.");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (isPending) return <span role="status" className="text-sm text-muted">Checking sign-in…</span>;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {session && <Link href="/members" className="text-sm font-medium underline underline-offset-4">{session.user.name || "Members area"}</Link>}
      <Button size="sm" variant="outline" onPress={authenticate} isDisabled={busy}>
        {busy ? "Please wait…" : session ? "Sign out" : "Continue with Google"}
      </Button>
      {(error || sessionError) && <p role="alert" className="w-full text-sm text-danger">{error || "Unable to check sign-in. Please try again."}</p>}
    </div>
  );
}
