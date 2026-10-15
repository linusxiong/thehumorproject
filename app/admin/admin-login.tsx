"use client";

import { ArrowRightFromSquare, Lock } from "@gravity-ui/icons";
import { Alert, Button, Card, Link, Spinner, Typography, toast } from "@heroui/react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AdminUser } from "@/lib/admin-types";
import { authClient } from "../auth-controls";
import { localizedBrandName, useLocale, type Messages } from "../locale";

const en = {
  title: "Admin console",
  intro: "Sign in with a Google account that has superadmin access to manage accounts, AI-generated versions, and ratings.",
  continueWithGoogle: "Continue with Google",
  signInFailed: "Sign in failed. Please try again.",
  failedTitle: "Sign-in was not completed",
  failedDescription: "We could not complete your Google sign-in. Please try again.",
  deniedTitle: "This account is not a superadmin",
  deniedDescription: (email: string) => `You are signed in as ${email}, which cannot open the admin area. Access is granted by the project owner on the server, never from the site.`,
  switchAccount: "Sign out and switch account",
  signOutFailed: "Sign out failed. Please try again.",
  backToSite: "Back to the site",
};

const messages: Messages<typeof en> = {
  en,
  es: {
    title: "Consola de administración",
    intro: "Inicia sesión con una cuenta de Google con acceso de superadministrador para gestionar cuentas, versiones generadas por IA y calificaciones.",
    continueWithGoogle: "Continuar con Google",
    signInFailed: "No se pudo iniciar sesión. Inténtalo de nuevo.",
    failedTitle: "No se completó el inicio de sesión",
    failedDescription: "No pudimos completar tu inicio de sesión con Google. Inténtalo de nuevo.",
    deniedTitle: "Esta cuenta no es de superadministrador",
    deniedDescription: (email) => `Iniciaste sesión como ${email}, que no puede abrir la administración. El acceso lo concede el responsable del proyecto en el servidor, nunca desde el sitio.`,
    switchAccount: "Cerrar sesión y cambiar de cuenta",
    signOutFailed: "No se pudo cerrar sesión. Inténtalo de nuevo.",
    backToSite: "Volver al sitio",
  },
  zh: {
    title: "管理后台",
    intro: "请使用拥有超级管理员权限的 Google 账户登录，以管理账户、AI 生成的版本和评价。",
    continueWithGoogle: "使用 Google 继续",
    signInFailed: "登录失败，请重试。",
    failedTitle: "登录未完成",
    failedDescription: "未能完成 Google 登录，请重试。",
    deniedTitle: "该账户不是超级管理员",
    deniedDescription: (email) => `你当前以 ${email} 登录，该账户无法进入管理后台。权限只能由项目负责人在服务器端授予，网站上无法申请。`,
    switchAccount: "退出并切换账户",
    signOutFailed: "退出登录失败，请重试。",
    backToSite: "返回网站",
  },
};

export function AdminLogin({ failed, denied }: { failed: boolean; denied: AdminUser | null }) {
  const locale = useLocale();
  const t = messages[locale];
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signIn() {
    setBusy(true);
    try {
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: new URL("/admin", window.location.origin).href,
        errorCallbackURL: new URL("/admin/login?error=1", window.location.origin).href,
      });
      if (result.error) throw new Error();
    } catch {
      toast.danger(t.signInFailed);
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    const result = await authClient.signOut().catch(() => null);
    setBusy(false);
    if (!result || result.error) {
      toast.danger(t.signOutFailed);
      return;
    }
    router.refresh();
  }

  return (
    <main id="main" className="flex min-h-screen items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md gap-6 p-6">
        <Card.Header className="flex flex-col items-start gap-4">
          <div className="flex items-center gap-2 font-semibold">
            <Image src="/brand/logo-mark.png" alt="" width={32} height={32} loading="eager" className="size-8" />
            {localizedBrandName[locale]}
          </div>
          <div className="flex flex-col gap-1">
            <Card.Title className="flex items-center gap-2 text-xl">
              <Lock aria-hidden className="size-5" />
              {t.title}
            </Card.Title>
            <Card.Description>{t.intro}</Card.Description>
          </div>
        </Card.Header>
        <Card.Content className="flex flex-col gap-4">
          {failed && !denied && (
            <Alert status="danger">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>{t.failedTitle}</Alert.Title>
                <Alert.Description>{t.failedDescription}</Alert.Description>
              </Alert.Content>
            </Alert>
          )}
          {denied ? (
            <>
              <Alert status="warning">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>{t.deniedTitle}</Alert.Title>
                  <Alert.Description>{t.deniedDescription(denied.email)}</Alert.Description>
                </Alert.Content>
              </Alert>
              <Button fullWidth variant="secondary" onPress={signOut} isPending={busy}>
                {({ isPending }) => (
                  <>
                    {isPending ? <Spinner size="sm" color="current" /> : <ArrowRightFromSquare aria-hidden className="size-4" />}
                    {t.switchAccount}
                  </>
                )}
              </Button>
            </>
          ) : (
            <Button fullWidth onPress={signIn} isPending={busy}>
              {({ isPending }) => (
                <>
                  {isPending && <Spinner size="sm" color="current" />}
                  {t.continueWithGoogle}
                </>
              )}
            </Button>
          )}
        </Card.Content>
        <Card.Footer>
          <Typography.Paragraph size="sm">
            <Link href="/">{t.backToSite}</Link>
          </Typography.Paragraph>
        </Card.Footer>
      </Card>
    </main>
  );
}
