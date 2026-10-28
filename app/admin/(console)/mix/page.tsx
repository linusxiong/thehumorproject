import type { Metadata } from "next";
import { loadPromptChains, requireAdmin } from "@/lib/admin";
import { ChainMix } from "../../chain-mix";

export const metadata: Metadata = { title: "Chain mix | Admin | Punchline Passport" };

export default async function AdminChainMixPage() {
  const { client } = await requireAdmin();
  return <ChainMix chains={await loadPromptChains(client)} />;
}
