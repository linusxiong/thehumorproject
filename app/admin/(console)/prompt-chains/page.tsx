import type { Metadata } from "next";
import { loadPromptChains, requireAdmin } from "@/lib/admin";
import { PromptChains } from "../../prompt-chains";

export const metadata: Metadata = { title: "Prompt chains | Admin | Punchline Passport" };

export default async function AdminPromptChainsPage() {
  const { client } = await requireAdmin();
  return <PromptChains chains={await loadPromptChains(client)} />;
}
