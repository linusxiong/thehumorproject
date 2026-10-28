import type { Metadata } from "next";
import { loadGenerationRequests, requireAdmin } from "@/lib/admin";
import { GenerationRequests } from "../../generation-requests";

export const metadata: Metadata = { title: "Generation requests | Admin | Punchline Passport" };

export default async function AdminRequestsPage() {
  const { client } = await requireAdmin();
  return <GenerationRequests requests={await loadGenerationRequests(client)} />;
}
