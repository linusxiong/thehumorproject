import type { Metadata } from "next";
import { PageShell } from "../page-shell";
import { TermsContent } from "./terms-content";

export const metadata: Metadata = {
  title: "Terms of Service | Punchline Passport",
  description: "The rules for sharing, adapting, and rating jokes on Punchline Passport, and where imported jokes come from.",
};

export default function Terms() {
  return (
    <PageShell>
      <TermsContent />
    </PageShell>
  );
}
