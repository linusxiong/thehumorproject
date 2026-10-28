import type { Metadata } from "next";
import { loadResource, requireAdmin } from "@/lib/admin";
import { TermsManager } from "../../terms-manager";

export const metadata: Metadata = { title: "Terms | Admin | Punchline Passport" };

export default async function AdminTermsPage() {
  const { client } = await requireAdmin();
  return <TermsManager rows={await loadResource(client, "terms")} />;
}
