import type { Metadata } from "next";
import { loadAccounts, loadImages, requireAdmin } from "@/lib/admin";
import type { ImageAccount } from "@/lib/admin-types";
import { ImagesManager } from "../../images-manager";

export const metadata: Metadata = { title: "Images | Admin | Punchline Passport" };

export default async function AdminImagesPage() {
  const { client } = await requireAdmin();
  const [images, accounts] = await Promise.all([loadImages(client), loadAccounts(client)]);
  // Photos can only be uploaded for accounts with a saved profile.
  const owners: ImageAccount[] = accounts.filter((account) => account.has_profile).map(({ id, name, email }) => ({ id, name, email }));
  return <ImagesManager images={images} accounts={owners} />;
}
