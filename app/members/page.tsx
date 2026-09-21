import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AuthControls } from "../auth-controls";

export default async function Members() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center gap-6 px-6 py-16">
      <Link href="/" className="text-sm text-accent underline underline-offset-4">Back to the collection</Link>
      <p className="font-mono text-xs tracking-[0.2em] text-accent">MEMBERS ONLY</p>
      <h1 className="text-4xl font-semibold tracking-tight">Welcome, {session.user.name}.</h1>
      <p className="text-muted">You are signed in as {session.user.email}.</p>
      <section className="rounded-2xl border border-border bg-surface p-6" aria-labelledby="member-note">
        <h2 id="member-note" className="text-lg font-semibold">Your members-only moment</h2>
        <p className="mt-3 leading-7">I finally found the key to work-life balance. Unfortunately, it opens the snack drawer.</p>
      </section>
      <AuthControls />
    </main>
  );
}
