import type { Metadata } from "next";
import { loadAccessSummary, loadResource, requireAdmin } from "@/lib/admin";
import { WhitelistedEmailsManager } from "../../access-managers";

export const metadata: Metadata = { title: "Whitelisted emails | Admin | Punchline Passport" };

export default async function AdminWhitelistPage() {
  const { client } = await requireAdmin();
  const [rows, summary] = await Promise.all([loadResource(client, "whitelisted-emails"), loadAccessSummary(client)]);
  return <WhitelistedEmailsManager rows={rows} summary={summary} />;
}
