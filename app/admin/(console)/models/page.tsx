import type { Metadata } from "next";
import { loadResource, requireAdmin } from "@/lib/admin";
import { ModelsManager } from "../../models-manager";

export const metadata: Metadata = { title: "LLM models | Admin | Punchline Passport" };

export default async function AdminModelsPage() {
  const { client } = await requireAdmin();
  const [rows, providers] = await Promise.all([loadResource(client, "llm-models"), loadResource(client, "llm-providers")]);
  return <ModelsManager rows={rows} providers={providers.map(({ id, name }) => ({ id, name }))} />;
}
