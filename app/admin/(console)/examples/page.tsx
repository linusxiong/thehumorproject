import type { Metadata } from "next";
import { loadResource, requireAdmin } from "@/lib/admin";
import { ExamplesManager } from "../../examples-manager";

export const metadata: Metadata = { title: "Generation examples | Admin | Punchline Passport" };

export default async function AdminExamplesPage() {
  const { client } = await requireAdmin();
  return <ExamplesManager rows={await loadResource(client, "generation-examples")} />;
}
