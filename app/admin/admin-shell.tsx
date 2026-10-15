"use client";

import { ArrowRightFromSquare, ArrowUpRightFromSquare, House, LayoutSideContentLeft, Persons, Sparkles, ThumbsUp } from "@gravity-ui/icons";
import { Button, buttonVariants, Drawer, ListBox, Select, Separator, Typography, toast } from "@heroui/react";
import Image from "next/image";
import NextLink from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ComponentType, type ReactNode, type SVGProps } from "react";
import type { AdminUser } from "@/lib/admin-types";
import { isAudienceId } from "@/lib/jokes";
import { authClient } from "../auth-controls";
import { UserAvatar } from "../avatar";
import { localizedBrandName, nativeNames, setLocale, useLocale, type Locale, type Messages } from "../locale";

const en = {
  console: "Admin",
  superadmin: "Superadmin",
  navigation: "Admin navigation",
  dashboard: "Dashboard",
  users: "Users",
  media: "AI media",
  ratings: "Ratings",
  viewSite: "View site",
  signOut: "Sign out",
  signOutFailed: "Sign out failed. Please try again.",
  toggleSidebar: "Show or hide the sidebar",
  menu: "Admin menu",
  language: "Language",
};

const messages: Messages<typeof en> = {
  en,
  es: {
    console: "Administración",
    superadmin: "Superadministrador",
    navigation: "Navegación de administración",
    dashboard: "Panel",
    users: "Usuarios",
    media: "Contenido IA",
    ratings: "Calificaciones",
    viewSite: "Ver el sitio",
    signOut: "Cerrar sesión",
    signOutFailed: "No se pudo cerrar sesión. Inténtalo de nuevo.",
    toggleSidebar: "Mostrar u ocultar la barra lateral",
    menu: "Menú de administración",
    language: "Idioma",
  },
  zh: {
    console: "管理后台",
    superadmin: "超级管理员",
    navigation: "后台导航",
    dashboard: "仪表盘",
    users: "用户",
    media: "AI 内容",
    ratings: "评价",
    viewSite: "查看网站",
    signOut: "退出登录",
    signOutFailed: "退出登录失败，请重试。",
    toggleSidebar: "显示或隐藏侧边栏",
    menu: "后台菜单",
    language: "语言",
  },
};

type NavItem = { href: string; key: "dashboard" | "users" | "media" | "ratings"; icon: ComponentType<SVGProps<SVGSVGElement>> };

const nav: NavItem[] = [
  { href: "/admin", key: "dashboard", icon: House },
  { href: "/admin/users", key: "users", icon: Persons },
  { href: "/admin/media", key: "media", icon: Sparkles },
  { href: "/admin/ratings", key: "ratings", icon: ThumbsUp },
];

const locales = Object.keys(nativeNames) as Locale[];

function Sidebar({ user, onNavigate }: { user: AdminUser; onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const t = messages[useLocale()];

  async function signOut() {
    const result = await authClient.signOut().catch(() => null);
    if (!result || result.error) {
      toast.danger(t.signOutFailed);
      return;
    }
    router.replace("/admin/login");
    router.refresh();
  }

  const item = (active: boolean) =>
    buttonVariants({ variant: active ? "secondary" : "ghost", fullWidth: true, className: "justify-start gap-2.5 font-normal" });

  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <div className="flex items-center gap-3 px-1">
        <UserAvatar name={user.name} src={user.avatar} />
        <div className="flex min-w-0 flex-col">
          <Typography.Paragraph size="sm" className="truncate font-medium">{user.name}</Typography.Paragraph>
          <Typography.Paragraph size="xs" color="muted" className="truncate">{t.superadmin}</Typography.Paragraph>
        </div>
      </div>
      <nav aria-label={t.navigation}>
        <ul className="flex flex-col gap-1">
          {nav.map(({ href, key, icon: Icon }) => {
            const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
            return (
              <li key={key}>
                <NextLink href={href} aria-current={active ? "page" : undefined} className={item(active)} onClick={onNavigate}>
                  <Icon aria-hidden className="size-4" />
                  {t[key]}
                </NextLink>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="mt-auto flex flex-col gap-1">
        <NextLink href="/" className={item(false)} onClick={onNavigate}>
          <ArrowUpRightFromSquare aria-hidden className="size-4" />
          {t.viewSite}
        </NextLink>
        <Button variant="ghost" fullWidth className="justify-start gap-2.5 font-normal" onPress={signOut}>
          <ArrowRightFromSquare aria-hidden className="size-4" />
          {t.signOut}
        </Button>
      </div>
    </div>
  );
}

// The header and page share one centered column, so wide screens keep the content and header controls aligned.
const column = "mx-auto w-full max-w-[1536px] px-4 sm:px-6";

// Dashboard layout modeled on the HeroUI Pro dashboard template: a sidebar with the account and navigation,
// and a sticky header above the page. Below the lg breakpoint the sidebar opens as a drawer.
export function AdminShell({ user, children }: { user: AdminUser; children: ReactNode }) {
  const locale = useLocale();
  const t = messages[locale];
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  function toggle() {
    if (window.matchMedia("(min-width: 1024px)").matches) setCollapsed((value) => !value);
    else setDrawerOpen(true);
  }

  return (
    <div className="flex min-h-screen w-full">
      {!collapsed && (
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 lg:block">
          <Sidebar user={user} />
        </aside>
      )}
      <Drawer.Backdrop isOpen={drawerOpen} onOpenChange={setDrawerOpen}>
        <Drawer.Content placement="left">
          <Drawer.Dialog aria-label={t.menu} className="w-72 max-w-[85vw] p-0">
            <Drawer.Body className="p-0">
              <Sidebar user={user} onNavigate={() => setDrawerOpen(false)} />
            </Drawer.Body>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 bg-background/85 backdrop-blur">
          <div className={`${column} flex items-center gap-3 py-3`}>
            <Button isIconOnly variant="ghost" size="sm" aria-label={t.toggleSidebar} onPress={toggle}>
              <LayoutSideContentLeft aria-hidden className="size-4" />
            </Button>
            <NextLink href="/admin" className="flex items-center gap-2 font-semibold">
              <Image src="/brand/logo-mark.png" alt="" width={24} height={24} className="size-6" />
              <span className="hidden sm:inline">{localizedBrandName[locale]}</span>
              <span className="font-normal text-muted">{t.console}</span>
            </NextLink>
            <Select aria-label={t.language} className="ml-auto w-32" value={locale}
              onChange={(value) => { if (isAudienceId(value)) setLocale(value); }}>
              <Select.Trigger>
                <Select.Value>{({ defaultChildren, isPlaceholder }) => (isPlaceholder ? defaultChildren : nativeNames[locale])}</Select.Value>
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {locales.map((option) => (
                    <ListBox.Item key={option} id={option} textValue={nativeNames[option]}>
                      {nativeNames[option]}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </div>
        </header>
        <Separator className="lg:hidden" />
        <main id="main" className={`${column} flex flex-1 flex-col gap-6 pt-4 pb-12`}>{children}</main>
      </div>
    </div>
  );
}
