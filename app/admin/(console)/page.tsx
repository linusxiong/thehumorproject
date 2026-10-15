import type { Metadata } from "next";
import { loadDashboard, requireAdmin } from "@/lib/admin";
import { parseRange } from "@/lib/admin-types";
import { Dashboard } from "../dashboard";

export const metadata: Metadata = { title: "Dashboard | Admin | Punchline Passport" };

export default async function AdminDashboardPage({ searchParams }: PageProps<"/admin">) {
  const { client, user } = await requireAdmin();
  const range = parseRange((await searchParams).range);
  const stats = await loadDashboard(client, range);
  return <Dashboard stats={stats} range={range} name={user.name} />;
}
