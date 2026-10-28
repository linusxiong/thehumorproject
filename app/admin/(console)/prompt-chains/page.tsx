import type { Metadata } from "next";
import { loadPromptChains, requireAdmin } from "@/lib/admin";
import { stepPrompts } from "@/lib/claude";
import { PromptChains } from "../../prompt-chains";

export const metadata: Metadata = { title: "Prompt chains | Admin | Punchline Passport" };

export default async function AdminPromptChainsPage() {
  const { client } = await requireAdmin();
  return <PromptChains chains={await loadPromptChains(client)} prompts={{ analysis: stepPrompts.analysis, adaptation: stepPrompts.adaptation }} />;
}
