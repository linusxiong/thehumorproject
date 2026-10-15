import type { Metadata } from "next";
import { loadRatings, requireAdmin } from "@/lib/admin";
import { RatingsTable } from "../../ratings-table";

export const metadata: Metadata = { title: "Ratings | Admin | Punchline Passport" };

export default async function AdminRatingsPage() {
  const { client } = await requireAdmin();
  return <RatingsTable ratings={await loadRatings(client)} />;
}
