"use client";

import { Button, Description, Dropdown, Header, Label, Separator, Skeleton, Spinner, toast } from "@heroui/react";
import { createAuthClient } from "better-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { avatarUrl, useAvatarProfile, UserAvatar } from "./avatar";

export const authClient = createAuthClient();

export function AuthControls() {
  const router = useRouter();
  const { data: session, isPending, error: sessionError } = authClient.useSession();
  const { profile } = useAvatarProfile(session?.user.id);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (sessionError) toast.danger("Unable to check sign-in. Please try again.");
  }, [sessionError]);

  async function signIn() {
    setBusy(true);
    try {
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: new URL("/members", window.location.origin).href,
        errorCallbackURL: new URL("/login", window.location.origin).href,
      });
      if (result.error) throw new Error();
    } catch {
      toast.danger("Sign in failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    const result = await authClient.signOut().catch(() => null);
    if (!result || result.error) {
      toast.danger("Sign out failed. Please try again.");
      return;
    }
    router.replace("/");
    router.refresh();
  }

  if (isPending) return <Skeleton className="size-8 rounded-full" />;

  if (!session) {
    return (
      <Button size="sm" onPress={signIn} isPending={busy}>
        {({ isPending: pending }) => (
          <>
            {pending && <Spinner size="sm" color="current" />}
            Continue with Google
          </>
        )}
      </Button>
    );
  }

  return (
    <Dropdown>
      <Dropdown.Trigger className="rounded-full" aria-label={`Account menu for ${session.user.name}`}>
        <UserAvatar name={session.user.name} src={avatarUrl(profile)} size="sm" />
      </Dropdown.Trigger>
      <Dropdown.Popover placement="bottom end">
        <Dropdown.Menu aria-label="Account" onAction={(key) => { if (key === "sign-out") signOut(); }}>
          <Dropdown.Section>
            <Header>{session.user.name}</Header>
            <Dropdown.Item id="members" href="/members" textValue="Members area">
              <div className="flex flex-col">
                <Label>Members area</Label>
                <Description>Change your profile photo</Description>
              </div>
            </Dropdown.Item>
          </Dropdown.Section>
          <Separator />
          <Dropdown.Item id="sign-out" textValue="Sign out" variant="danger">
            <Label>Sign out</Label>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
