import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { PageShell } from "../page-shell";
import { MemberArea } from "./member-area";

export default async function Members() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  return (
    <PageShell>
      <MemberArea userId={session.user.id} name={session.user.name} email={session.user.email} />
    </PageShell>
  );
}
