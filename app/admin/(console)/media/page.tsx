import type { Metadata } from "next";
import { loadMedia, requireAdmin } from "@/lib/admin";
import { MediaManager } from "../../media-manager";

export const metadata: Metadata = { title: "AI media | Admin | Punchline Passport" };

export default async function AdminMediaPage() {
  const { client } = await requireAdmin();
  return <MediaManager items={await loadMedia(client)} />;
}
