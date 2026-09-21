import Link from "next/link";
import { AuthControls } from "../auth-controls";

export default async function Login({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center gap-6 px-6 py-16">
      <Link href="/" className="text-sm text-accent underline underline-offset-4">Back to the collection</Link>
      <h1 className="text-4xl font-semibold tracking-tight">A little more humor.</h1>
      <p className="leading-7 text-muted">Sign in with Google to visit the members area. The collection is always open to everyone.</p>
      {error && <p role="alert" className="text-sm text-danger">We could not complete your Google sign-in. Please try again.</p>}
      <AuthControls />
    </main>
  );
}
