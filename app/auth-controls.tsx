"use client";

import { Button, Description, Dropdown, Header, Label, Separator, Skeleton, Spinner, toast } from "@heroui/react";
import { createAuthClient } from "better-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { avatarUrl, useAvatarProfile, UserAvatar } from "./avatar";
import { useLocale, type Messages } from "./locale";

export const authClient = createAuthClient();

const en = {
  sessionError: "Unable to check sign-in. Please try again.",
  signInFailed: "Sign in failed. Please try again.",
  signOutFailed: "Sign out failed. Please try again.",
  continueWithGoogle: "Continue with Google",
  accountMenuFor: (name: string) => `Account menu for ${name}`,
  account: "Account",
  personalCenter: "Personal center",
  personalCenterHint: "Your ratings and profile photo",
  admin: "Admin console",
  adminHint: "Statistics, accounts, AI media, and ratings",
  signOut: "Sign out",
};

const messages: Messages<typeof en> = {
  en,
  es: {
    sessionError: "No se pudo comprobar tu sesión. Inténtalo de nuevo.",
    signInFailed: "No se pudo iniciar sesión. Inténtalo de nuevo.",
    signOutFailed: "No se pudo cerrar sesión. Inténtalo de nuevo.",
    continueWithGoogle: "Continuar con Google",
    accountMenuFor: (name) => `Menú de la cuenta de ${name}`,
    account: "Cuenta",
    personalCenter: "Centro personal",
    personalCenterHint: "Tus calificaciones y foto de perfil",
    admin: "Consola de administración",
    adminHint: "Estadísticas, cuentas, contenido IA y calificaciones",
    signOut: "Cerrar sesión",
  },
  zh: {
    sessionError: "无法检查登录状态，请重试。",
    signInFailed: "登录失败，请重试。",
    signOutFailed: "退出登录失败，请重试。",
    continueWithGoogle: "使用 Google 继续",
    accountMenuFor: (name) => `${name} 的账户菜单`,
    account: "账户",
    personalCenter: "个人中心",
    personalCenterHint: "我的评价与头像",
    admin: "管理后台",
    adminHint: "统计、账户、AI 内容与评价",
    signOut: "退出登录",
  },
};

export function AuthControls() {
  const router = useRouter();
  const { data: session, isPending, error: sessionError } = authClient.useSession();
  const { profile } = useAvatarProfile(session?.user.id);
  const [busy, setBusy] = useState(false);
  const t = messages[useLocale()];

  useEffect(() => {
    if (sessionError) toast.danger(t.sessionError);
  }, [sessionError, t]);

  async function signIn() {
    setBusy(true);
    try {
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: new URL("/", window.location.origin).href,
        errorCallbackURL: new URL("/login", window.location.origin).href,
      });
      if (result.error) throw new Error();
    } catch {
      toast.danger(t.signInFailed);
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    const result = await authClient.signOut().catch(() => null);
    if (!result || result.error) {
      toast.danger(t.signOutFailed);
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
            {t.continueWithGoogle}
          </>
        )}
      </Button>
    );
  }

  return (
    <Dropdown>
      <Dropdown.Trigger className="rounded-full" aria-label={t.accountMenuFor(session.user.name)}>
        <UserAvatar name={session.user.name} src={avatarUrl(profile)} size="sm" />
      </Dropdown.Trigger>
      <Dropdown.Popover placement="bottom end">
        <Dropdown.Menu aria-label={t.account} onAction={(key) => { if (key === "sign-out") signOut(); }}>
          <Dropdown.Section>
            <Header>{session.user.name}</Header>
            <Dropdown.Item id="members" href="/members" textValue={t.personalCenter}>
              <div className="flex flex-col">
                <Label>{t.personalCenter}</Label>
                <Description>{t.personalCenterHint}</Description>
              </div>
            </Dropdown.Item>
            {profile?.isSuperadmin ? (
              <Dropdown.Item id="admin" href="/admin" textValue={t.admin}>
                <div className="flex flex-col">
                  <Label>{t.admin}</Label>
                  <Description>{t.adminHint}</Description>
                </div>
              </Dropdown.Item>
            ) : null}
          </Dropdown.Section>
          <Separator />
          <Dropdown.Item id="sign-out" textValue={t.signOut} variant="danger">
            <Label>{t.signOut}</Label>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
