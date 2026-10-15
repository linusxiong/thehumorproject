import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminAccess } from "@/lib/admin";
import { AdminLogin } from "../admin-login";

export const metadata: Metadata = {
  title: "Admin sign-in | Punchline Passport",
  robots: { index: false, follow: false },
};

// The only admin route without the superadmin check: it shows Google sign-in, or explains why a signed-in account is turned away.
export default async function AdminLoginPage({ searchParams }: PageProps<"/admin/login">) {
  const [{ error }, access] = await Promise.all([searchParams, getAdminAccess()]);
  if (access.status === "admin") redirect("/admin");
  return <AdminLogin failed={Boolean(error)} denied={access.status === "forbidden" ? access.user : null} />;
}
