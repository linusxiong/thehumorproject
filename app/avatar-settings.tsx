"use client";

import { Alert, Button, Card, Description, Radio, RadioGroup, Skeleton, Spinner, toast } from "@heroui/react";
import { useRef, useState, type ChangeEvent } from "react";
import { setAvatarProfile, useAvatarProfile, UserAvatar } from "./avatar";

const photoSize = 512;
const unreadable = "Choose a JPEG, PNG, or WebP image.";

// Crop to the centered square an avatar shows and shrink camera photos far below the upload limit.
async function squarePhoto(file: File) {
  const image = await createImageBitmap(file).catch(() => { throw new Error(unreadable); });
  const side = Math.min(image.width, image.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = Math.min(side, photoSize);
  const context = canvas.getContext("2d");
  if (!context) throw new Error(unreadable);
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, (image.width - side) / 2, (image.height - side) / 2, side, side, 0, 0, canvas.width, canvas.height);
  image.close();
  const photo = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
  if (!photo) throw new Error(unreadable);
  return photo;
}

type Action = "upload" | "source" | "remove";

export function AvatarSettings({ userId, name }: { userId: string; name: string }) {
  const { profile, error, retry } = useAvatarProfile(userId);
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<Action | null>(null);

  async function save(action: Action, request: () => Promise<Response>, success: string) {
    setBusy(action);
    try {
      const response = await request();
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Your profile photo could not be updated. Please try again.");
      setAvatarProfile(userId, result);
      toast.success(success);
    } catch (reason) {
      toast.danger(reason instanceof Error ? reason.message : "Your profile photo could not be updated. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    save("upload", async () => {
      const body = new FormData();
      body.set("file", await squarePhoto(file), "avatar.jpg");
      return fetch("/api/avatar", { method: "POST", body });
    }, "Your uploaded photo is now your avatar.");
  }

  function choose(source: string) {
    save("source", () => fetch("/api/avatar", {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source }),
    }), source === "google" ? "Your Google photo is now your avatar." : "Your uploaded photo is now your avatar.");
  }

  function remove() {
    save("remove", () => fetch("/api/avatar", { method: "DELETE" }), "Your uploaded photo was deleted.");
  }

  if (error) {
    return (
      <Alert status="danger">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>Profile photo unavailable</Alert.Title>
          <Alert.Description>Your profile photo settings could not be loaded.</Alert.Description>
        </Alert.Content>
        <Button size="sm" variant="tertiary" onPress={retry}>Try again</Button>
      </Alert>
    );
  }

  return (
    <Card aria-labelledby="avatar-title" aria-busy={!profile || busy !== null}>
      <Card.Header>
        <Card.Title id="avatar-title">Profile photo</Card.Title>
        <Card.Description>Use the photo from your Google account, or upload one of your own.</Card.Description>
      </Card.Header>
      <Card.Content>
        {profile ? (
          <RadioGroup aria-label="Profile photo" value={profile.source} onChange={choose} isDisabled={busy !== null}>
            <Radio value="google">
              <Radio.Content>
                <Radio.Control><Radio.Indicator /></Radio.Control>
                <UserAvatar name={name} src={profile.googleUrl} size="sm" />
                Google photo
              </Radio.Content>
              <Description>{profile.googleUrl ? "The photo from your Google account." : "Your Google account has no photo, so your initials are shown."}</Description>
            </Radio>
            <Radio value="upload" isDisabled={!profile.uploadUrl}>
              <Radio.Content>
                <Radio.Control><Radio.Indicator /></Radio.Control>
                <UserAvatar name={name} src={profile.uploadUrl} size="sm" />
                Uploaded photo
              </Radio.Content>
              <Description>{profile.uploadUrl ? "The photo you uploaded." : "Upload a photo to choose this option."}</Description>
            </Radio>
          </RadioGroup>
        ) : <Skeleton className="h-28 rounded-xl" />}
      </Card.Content>
      <Card.Footer className="flex-wrap gap-3">
        <Button variant="secondary" isPending={busy === "upload"} isDisabled={!profile || (busy !== null && busy !== "upload")}
          onPress={() => fileInput.current?.click()}>
          {({ isPending }) => (
            <>
              {isPending && <Spinner size="sm" color="current" />}
              {isPending ? "Uploading…" : profile?.uploadUrl ? "Upload a new photo" : "Upload a photo"}
            </>
          )}
        </Button>
        {profile?.uploadUrl && (
          <Button variant="danger-soft" isPending={busy === "remove"} isDisabled={busy !== null && busy !== "remove"} onPress={remove}>
            {({ isPending }) => (
              <>
                {isPending && <Spinner size="sm" color="current" />}
                {isPending ? "Deleting…" : "Delete uploaded photo"}
              </>
            )}
          </Button>
        )}
        <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={upload} />
      </Card.Footer>
    </Card>
  );
}
