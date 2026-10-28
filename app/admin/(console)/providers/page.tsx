import type { Metadata } from "next";
import { loadResource, requireAdmin } from "@/lib/admin";
import { ProvidersManager } from "../../models-manager";

export const metadata: Metadata = { title: "LLM providers | Admin | Punchline Passport" };

export default async function AdminProvidersPage() {
  const { client } = await requireAdmin();
  return <ProvidersManager rows={await loadResource(client, "llm-providers")} />;
}
