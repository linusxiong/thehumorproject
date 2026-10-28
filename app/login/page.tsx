import { PageShell } from "../page-shell";
import { LoginPrompt } from "./login-prompt";

export default async function Login({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  return (
    <PageShell account={false}>
      <LoginPrompt failed={error ? (error === "signup_not_allowed" ? "not_allowed" : "failed") : null} />
    </PageShell>
  );
}
