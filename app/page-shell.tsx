"use client";

import { Link, Separator, Typography } from "@heroui/react";
import type { ReactNode } from "react";
import { AuthControls } from "./auth-controls";

export function PageShell({ children, account = true }: { children: ReactNode; account?: boolean }) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 sm:px-8">
      <header className="flex items-center justify-between gap-4 py-4">
        <Link href="/">The Humor Project</Link>
        {account && <AuthControls />}
      </header>
      <Separator />
      <main id="main" className="flex flex-1 flex-col gap-10 py-12">{children}</main>
      <Separator />
      <footer className="flex flex-col justify-between gap-2 py-6 sm:flex-row">
        <Typography.Paragraph size="xs" color="muted">Stay curious. Stay a little ridiculous.</Typography.Paragraph>
        <Typography.Paragraph size="xs" color="muted">Demo collection · Fictional authors. Real votes.</Typography.Paragraph>
      </footer>
    </div>
  );
}
