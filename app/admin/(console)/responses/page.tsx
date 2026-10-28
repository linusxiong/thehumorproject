import type { Metadata } from "next";
import { loadLlmResponses, requireAdmin } from "@/lib/admin";
import { LlmResponses } from "../../llm-responses";

export const metadata: Metadata = { title: "LLM responses | Admin | Punchline Passport" };

export default async function AdminResponsesPage() {
  const { client } = await requireAdmin();
  return <LlmResponses responses={await loadLlmResponses(client)} />;
}
