import { JokesExplorer } from "./jokes-explorer";
import { PageShell } from "./page-shell";

export default function Home() {
  return (
    <PageShell>
      <JokesExplorer />
    </PageShell>
  );
}
