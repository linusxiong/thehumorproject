import type { Metadata } from "next";
import { loadAccounts, requireAdmin } from "@/lib/admin";
import { UsersTable } from "../../users-table";

export const metadata: Metadata = { title: "Users | Admin | Punchline Passport" };

export default async function AdminUsersPage() {
  const { client } = await requireAdmin();
  return <UsersTable accounts={await loadAccounts(client)} />;
}
