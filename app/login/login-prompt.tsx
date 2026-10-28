"use client";

import { Alert, Typography } from "@heroui/react";
import { AuthControls } from "../auth-controls";
import { useLocale, type Messages } from "../locale";

const en = {
  heading: "A little more humor.",
  intro: "Sign in with Google to share jokes and rate how they travel across cultures. Reading is always open to everyone.",
  failedTitle: "Sign-in was not completed",
  failedDescription: "We could not complete your Google sign-in. Please try again.",
  notAllowedTitle: "This account can't sign in",
  notAllowedDescription: "Sign-in is limited to approved email domains and addresses. Use another Google account, or ask the site's administrators for access. You can still read every joke.",
};

const messages: Messages<typeof en> = {
  en,
  es: {
    heading: "Un poco más de humor.",
    intro: "Inicia sesión con Google para compartir chistes y valorar cómo viajan entre culturas. La lectura siempre está abierta a todos.",
    failedTitle: "No se completó el inicio de sesión",
    failedDescription: "No pudimos completar tu inicio de sesión con Google. Inténtalo de nuevo.",
    notAllowedTitle: "Esta cuenta no puede iniciar sesión",
    notAllowedDescription: "El inicio de sesión está limitado a dominios y direcciones de correo aprobados. Usa otra cuenta de Google o pide acceso a los administradores del sitio. Puedes seguir leyendo todos los chistes.",
  },
  zh: {
    heading: "多一点幽默。",
    intro: "使用 Google 登录，即可分享笑话，并评价它们跨越文化后是否依然好笑。浏览始终对所有人开放。",
    failedTitle: "登录未完成",
    failedDescription: "未能完成 Google 登录，请重试。",
    notAllowedTitle: "该账户无法登录",
    notAllowedDescription: "登录仅限已批准的邮箱域名和邮箱地址。请换一个 Google 账户，或联系网站管理员申请权限。你仍然可以浏览所有笑话。",
  },
};

export function LoginPrompt({ failed }: { failed: "failed" | "not_allowed" | null }) {
  const t = messages[useLocale()];
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-start gap-6">
      <div className="flex flex-col gap-2">
        <Typography.Heading level={1}>{t.heading}</Typography.Heading>
        <Typography.Paragraph color="muted">{t.intro}</Typography.Paragraph>
      </div>
      {failed && (
        <Alert status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{failed === "not_allowed" ? t.notAllowedTitle : t.failedTitle}</Alert.Title>
            <Alert.Description>{failed === "not_allowed" ? t.notAllowedDescription : t.failedDescription}</Alert.Description>
          </Alert.Content>
        </Alert>
      )}
      <AuthControls />
    </div>
  );
}
