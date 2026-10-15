import type { Metadata } from "next";
import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/admin";
import { AdminShell } from "../admin-shell";

export const metadata: Metadata = {
  title: "Admin | Punchline Passport",
  robots: { index: false, follow: false },
};

// The shell needs the superadmin's name and photo. Each page still checks access itself, because a layout
// does not re-run on client navigation and does not stop its pages from rendering.
export default async function ConsoleLayout({ children }: { children: ReactNode }) {
  const { user } = await requireAdmin();
  return <AdminShell user={user}>{children}</AdminShell>;
}
