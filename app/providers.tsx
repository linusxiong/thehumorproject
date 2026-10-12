"use client";

import { RouterProvider, ToastProvider } from "@heroui/react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

// Let HeroUI links and menu items use Next.js client-side navigation.
export function Providers({ children }: { children: ReactNode }) {
  const router = useRouter();
  return (
    <RouterProvider navigate={(path) => router.push(path)}>
      {children}
      <ToastProvider />
    </RouterProvider>
  );
}
