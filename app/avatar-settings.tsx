"use client";

import { Alert, Button, Card, Description, Radio, RadioGroup, Skeleton, Spinner, toast } from "@heroui/react";
import { useRef, useState, type ChangeEvent } from "react";
import { ApiError, apiErrorMessage, errorStatus } from "./api-errors";
import { setAvatarProfile, useAvatarProfile, UserAvatar } from "./avatar";
import { useLocale, type Messages } from "./locale";

const en = {
  unreadable: "Choose a JPEG, PNG, or WebP image.",
  updateFailed: "Your profile photo could not be updated. Please try again.",
  uploadedActive: "Your uploaded photo is now your avatar.",
  googleActive: "Your Google photo is now your avatar.",
  deleted: "Your uploaded photo was deleted.",
  unavailableTitle: "Profile photo unavailable",
  unavailableDescription: "Your profile photo settings could not be loaded.",
  tryAgain: "Try again",
  title: "Profile photo",
  description: "Use the photo from your Google account, or upload one of your own.",
  googlePhoto: "Google photo",
  googleHint: "The photo from your Google account.",
  googleNone: "Your Google account has no photo, so your initials are shown.",
  uploadedPhoto: "Uploaded photo",
  uploadedHint: "The photo you uploaded.",
  uploadedNone: "Upload a photo to choose this option.",
  uploading: "Uploading…",
  uploadNew: "Upload a new photo",
  upload: "Upload a photo",
  deleting: "Deleting…",
  delete: "Delete uploaded photo",
};

const messages: Messages<typeof en> = {
  en,
  es: {
    unreadable: "Elige una imagen JPEG, PNG o WebP.",
    updateFailed: "No se pudo actualizar tu foto de perfil. Inténtalo de nuevo.",
    uploadedActive: "Tu foto subida ahora es tu avatar.",
    googleActive: "Tu foto de Google ahora es tu avatar.",
    deleted: "Se eliminó tu foto subida.",
    unavailableTitle: "Foto de perfil no disponible",
    unavailableDescription: "No se pudo cargar la configuración de tu foto de perfil.",
    tryAgain: "Reintentar",
    title: "Foto de perfil",
    description: "Usa la foto de tu cuenta de Google o sube una propia.",
    googlePhoto: "Foto de Google",
    googleHint: "La foto de tu cuenta de Google.",
    googleNone: "Tu cuenta de Google no tiene foto, así que se muestran tus iniciales.",
    uploadedPhoto: "Foto subida",
    uploadedHint: "La foto que subiste.",
    uploadedNone: "Sube una foto para elegir esta opción.",
    uploading: "Subiendo…",
    uploadNew: "Subir una foto nueva",
    upload: "Subir una foto",
    deleting: "Eliminando…",
    delete: "Eliminar foto subida",
  },
  zh: {
    unreadable: "请选择 JPEG、PNG 或 WebP 格式的图片。",
    updateFailed: "无法更新头像，请重试。",
    uploadedActive: "已将你上传的照片设为头像。",
    googleActive: "已将你的 Google 照片设为头像。",
    deleted: "已删除你上传的照片。",
    unavailableTitle: "头像暂不可用",
    unavailableDescription: "无法加载头像设置。",
    tryAgain: "重试",
    title: "头像",
    description: "使用你 Google 账户中的照片，或上传你自己的照片。",
    googlePhoto: "Google 照片",
    googleHint: "你 Google 账户中的照片。",
    googleNone: "你的 Google 账户没有照片，因此显示你的姓名首字母。",
    uploadedPhoto: "已上传的照片",
    uploadedHint: "你上传的照片。",
    uploadedNone: "上传照片后即可选择此项。",
    uploading: "正在上传…",
    uploadNew: "上传新照片",
    upload: "上传照片",
    deleting: "正在删除…",
    delete: "删除已上传的照片",
  },
};

class PhotoError extends Error {}

const photoSize = 512;

// Crop to the centered square an avatar shows and shrink camera photos far below the upload limit.
async function squarePhoto(file: File, unreadable: string) {
  const image = await createImageBitmap(file).catch(() => { throw new PhotoError(unreadable); });
  const side = Math.min(image.width, image.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = Math.min(side, photoSize);
  const context = canvas.getContext("2d");
  if (!context) throw new PhotoError(unreadable);
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, (image.width - side) / 2, (image.height - side) / 2, side, side, 0, 0, canvas.width, canvas.height);
  image.close();
  const photo = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
  if (!photo) throw new PhotoError(unreadable);
  return photo;
}

type Action = "upload" | "source" | "remove";

export function AvatarSettings({ userId, name }: { userId: string; name: string }) {
  const { profile, error, retry } = useAvatarProfile(userId);
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<Action | null>(null);
  const locale = useLocale();
  const t = messages[locale];

  async function save(action: Action, request: () => Promise<Response>, success: string) {
    setBusy(action);
    try {
      const response = await request();
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new ApiError(response.status);
      setAvatarProfile(userId, result);
      toast.success(success);
    } catch (reason) {
      toast.danger(reason instanceof PhotoError ? reason.message : apiErrorMessage(locale, errorStatus(reason), t.updateFailed));
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
      body.set("file", await squarePhoto(file, t.unreadable), "avatar.jpg");
      return fetch("/api/avatar", { method: "POST", body });
    }, t.uploadedActive);
  }

  function choose(source: string) {
    save("source", () => fetch("/api/avatar", {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source }),
    }), source === "google" ? t.googleActive : t.uploadedActive);
  }

  function remove() {
    save("remove", () => fetch("/api/avatar", { method: "DELETE" }), t.deleted);
  }

  if (error) {
    return (
      <Alert status="danger">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>{t.unavailableTitle}</Alert.Title>
          <Alert.Description>{t.unavailableDescription}</Alert.Description>
        </Alert.Content>
        <Button size="sm" variant="tertiary" onPress={retry}>{t.tryAgain}</Button>
      </Alert>
    );
  }

  return (
    <Card aria-labelledby="avatar-title" aria-busy={!profile || busy !== null}>
      <Card.Header>
        <Card.Title id="avatar-title">{t.title}</Card.Title>
        <Card.Description>{t.description}</Card.Description>
      </Card.Header>
      <Card.Content>
        {profile ? (
          <RadioGroup aria-label={t.title} value={profile.source} onChange={choose} isDisabled={busy !== null}>
            <Radio value="google">
              <Radio.Content>
                <Radio.Control><Radio.Indicator /></Radio.Control>
                <UserAvatar name={name} src={profile.googleUrl} size="sm" />
                {t.googlePhoto}
              </Radio.Content>
              <Description>{profile.googleUrl ? t.googleHint : t.googleNone}</Description>
            </Radio>
            <Radio value="upload" isDisabled={!profile.uploadUrl}>
              <Radio.Content>
                <Radio.Control><Radio.Indicator /></Radio.Control>
                <UserAvatar name={name} src={profile.uploadUrl} size="sm" />
                {t.uploadedPhoto}
              </Radio.Content>
              <Description>{profile.uploadUrl ? t.uploadedHint : t.uploadedNone}</Description>
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
              {isPending ? t.uploading : profile?.uploadUrl ? t.uploadNew : t.upload}
            </>
          )}
        </Button>
        {profile?.uploadUrl && (
          <Button variant="danger-soft" isPending={busy === "remove"} isDisabled={busy !== null && busy !== "remove"} onPress={remove}>
            {({ isPending }) => (
              <>
                {isPending && <Spinner size="sm" color="current" />}
                {isPending ? t.deleting : t.delete}
              </>
            )}
          </Button>
        )}
        <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={upload} />
      </Card.Footer>
    </Card>
  );
}
