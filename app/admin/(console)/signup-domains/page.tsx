import type { Metadata } from "next";
import { loadAccessSummary, loadResource, requireAdmin } from "@/lib/admin";
import { SignupDomainsManager } from "../../access-managers";

export const metadata: Metadata = { title: "Sign-up domains | Admin | Punchline Passport" };

export default async function AdminSignupDomainsPage() {
  const { client } = await requireAdmin();
  const [rows, summary] = await Promise.all([loadResource(client, "signup-domains"), loadAccessSummary(client)]);
  return <SignupDomainsManager rows={rows} summary={summary} />;
}
