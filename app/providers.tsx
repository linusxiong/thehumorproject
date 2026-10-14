"use client";

import { RouterProvider, ToastProvider } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { htmlLang, useLocale } from "./locale";

// Let HeroUI links and menu items use Next.js client-side navigation.
export function Providers({ children }: { children: ReactNode }) {
  const router = useRouter();
  const locale = useLocale();
  useEffect(() => {
    document.documentElement.lang = htmlLang[locale];
  }, [locale]);
  return (
    <RouterProvider navigate={(path) => router.push(path)}>
      {children}
      <ToastProvider />
    </RouterProvider>
  );
}
