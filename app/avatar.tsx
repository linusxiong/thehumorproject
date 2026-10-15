"use client";

import { Avatar } from "@heroui/react";
import { useEffect, useSyncExternalStore } from "react";

// isSuperadmin comes only with the initial load; avatar changes keep the flag already known.
export type AvatarProfile = { source: "google" | "upload"; googleUrl: string | null; uploadUrl: string | null; isSuperadmin?: true };
type AvatarState = { userId: string; profile: AvatarProfile | null; error: boolean };

// One shared profile, so the header and the settings card update together after a change.
let state: AvatarState | null = null;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

function update(next: AvatarState) {
  state = next;
  listeners.forEach((listener) => listener());
}

export function setAvatarProfile(userId: string, profile: AvatarProfile) {
  const known = state?.userId === userId ? state.profile?.isSuperadmin : undefined;
  update({ userId, profile: known && !profile.isSuperadmin ? { ...profile, isSuperadmin: known } : profile, error: false });
}

function load(userId: string) {
  update({ userId, profile: null, error: false });
  fetch("/api/avatar", { cache: "no-store" })
    .then(async (response) => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      if (state?.userId === userId && !state.profile) setAvatarProfile(userId, result);
    })
    .catch(() => { if (state?.userId === userId && !state.profile) update({ userId, profile: null, error: true }); });
}

export function useAvatarProfile(userId: string | undefined) {
  const current = useSyncExternalStore(subscribe, () => state, () => null);
  useEffect(() => {
    if (userId && state?.userId !== userId) load(userId);
  }, [userId]);
  const mine = userId && current?.userId === userId ? current : null;
  return { profile: mine?.profile ?? null, error: mine?.error ?? false, retry: () => { if (userId) load(userId); } };
}

export function avatarUrl(profile: AvatarProfile | null) {
  return profile?.source === "upload" ? profile.uploadUrl : profile?.googleUrl ?? null;
}

export function UserAvatar({ name, src, size, label }: { name: string; src: string | null; size?: Avatar["Props"]["size"]; label?: string }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  return (
    <Avatar size={size} aria-hidden={!label || undefined}>
      {src && <Avatar.Image src={src} alt={label ?? ""} referrerPolicy="no-referrer" />}
      <Avatar.Fallback>{initials || "?"}</Avatar.Fallback>
    </Avatar>
  );
}
