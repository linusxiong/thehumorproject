"use client";

import { Link, ListBox, Select, Separator, Typography } from "@heroui/react";
import Image from "next/image";
import type { ReactNode } from "react";
import { isAudienceId } from "@/lib/jokes";
import { AuthControls } from "./auth-controls";
import { brandName, localizedBrandName, nativeNames, setLocale, useLocale, type Locale, type Messages } from "./locale";

const en = {
  language: "Language",
  home: `${brandName} home`,
  tagline: "Every joke deserves a passport.",
  credits: `Adapted by ${brandName} · Rated by real readers.`,
  terms: "Terms of Service",
};

const messages: Messages<typeof en> = {
  en,
  es: {
    language: "Idioma",
    home: `Inicio de ${localizedBrandName.es}`,
    tagline: "Todo chiste merece un pasaporte.",
    credits: `Adaptado por ${localizedBrandName.es} · Calificado por lectores reales.`,
    terms: "Términos del servicio",
  },
  zh: {
    language: "语言",
    home: `${localizedBrandName.zh}首页`,
    tagline: "每个笑话都值得一本护照。",
    credits: `由${localizedBrandName.zh}改编 · 由真实读者评分`,
    terms: "服务条款",
  },
};

const locales = Object.keys(nativeNames) as Locale[];

export function PageShell({ children, account = true }: { children: ReactNode; account?: boolean }) {
  const locale = useLocale();
  const t = messages[locale];

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 sm:px-8">
      <header className="flex items-center justify-between gap-4 py-4">
        <Link href="/" aria-label={t.home} className="flex items-center gap-2 font-semibold no-underline">
          <Image src="/brand/logo-mark.png" alt="" width={32} height={32} loading="eager" className="size-8" />
          <span aria-hidden="true">{localizedBrandName[locale]}</span>
        </Link>
        <div className="flex items-center gap-3">
          <Select aria-label={t.language} className="w-32" value={locale}
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
          {account && <AuthControls />}
        </div>
      </header>
      <Separator />
      <main id="main" className="flex flex-1 flex-col gap-10 py-12">{children}</main>
      <Separator />
      <footer className="flex flex-col justify-between gap-2 py-6 sm:flex-row">
        <Typography.Paragraph size="xs" color="muted">{t.tagline}</Typography.Paragraph>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Typography.Paragraph size="xs" color="muted">{t.credits}</Typography.Paragraph>
          <Link href="/terms" className="text-xs">{t.terms}</Link>
        </div>
      </footer>
    </div>
  );
}
