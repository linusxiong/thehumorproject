"use client";

import { Alert, Avatar, Button, Card, Chip, SearchField, Skeleton } from "@heroui/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { categories, filterHumor, loadHumor, type Category, type HumorEntry } from "@/lib/humor";
import { AuthControls } from "./auth-controls";
import { VoteControls } from "./vote-controls";

const categoryColors = { Everyday: "success", Work: "warning", Code: "accent" } as const;

export default function Home() {
  const [entries, setEntries] = useState<HumorEntry[]>([]);
  const [category, setCategory] = useState<Category>("All");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    loadHumor(controller.signal)
      .then((data) => { if (!controller.signal.aborted) setEntries(data); })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : "Something went wrong. Please try again.");
        }
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision]);

  function refresh() {
    setLoading(true);
    setError(null);
    setRevision((value) => value + 1);
  }

  const visible = filterHumor(entries, category, query);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 sm:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border py-6">
        <Link href="/" className="flex items-center gap-3 font-semibold tracking-tight" aria-label="The Humor Project home">
          <span className="flex size-9 items-center justify-center rounded-xl bg-accent text-xl text-accent-foreground" aria-hidden="true">h.</span>
          <span>The Humor Project<span className="text-accent">.</span></span>
        </Link>
        <AuthControls />
      </header>

      <main id="main" className="flex-1 py-12 sm:py-16">
        <section aria-labelledby="page-title" className="mb-12 flex flex-col justify-between gap-8 sm:flex-row sm:items-end">
          <div>
            <p className="mb-4 font-mono text-xs tracking-[0.2em] text-accent">A LITTLE HUMOR, EVERY DAY</p>
            <h1 id="page-title" className="text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">Life is serious.<br /><span className="text-accent">You don’t have to be.</span></h1>
            <p className="mt-5 max-w-lg text-sm leading-7 text-muted">Small observations. Unexpected punchlines.<br />A collection of reasons to take your day a little less seriously.</p>
          </div>
          <Button variant="outline" onPress={refresh} isDisabled={loading} className="w-fit shrink-0">
            <span aria-hidden="true">↻</span>{loading ? "Loading…" : "Refresh collection"}
          </Button>
        </section>

        <section aria-labelledby="collection-title">
          <div className="mb-5 flex items-center gap-3">
            <h2 id="collection-title" className="text-lg font-semibold">The collection</h2>
            {!loading && !error && <Chip size="sm" variant="soft">{entries.length} {entries.length === 1 ? "story" : "stories"}</Chip>}
          </div>
          <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
              {categories.map((item) => (
                <Button key={item} size="sm" variant={category === item ? "primary" : "ghost"} aria-pressed={category === item} onPress={() => setCategory(item)}>{item}</Button>
              ))}
            </div>
            <SearchField aria-label="Search the collection" value={query} onChange={setQuery} className="w-full sm:w-72">
              <SearchField.Group>
                <SearchField.SearchIcon />
                <SearchField.Input placeholder="Search a story or an author…" />
                <SearchField.ClearButton aria-label="Clear search" />
              </SearchField.Group>
            </SearchField>
          </div>

          <div aria-live="polite" aria-atomic="true" className="sr-only">
            {loading ? "Loading stories" : error ? error : `${visible.length} ${visible.length === 1 ? "story" : "stories"} found`}
          </div>
          {error ? (
            <Alert status="danger">
              <Alert.Indicator />
              <Alert.Content><Alert.Title>A little interruption</Alert.Title><Alert.Description>{error}</Alert.Description></Alert.Content>
              <Button size="sm" variant="tertiary" onPress={refresh}>Try again</Button>
            </Alert>
          ) : loading ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
              {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-72 rounded-2xl" />)}
            </div>
          ) : visible.length === 0 ? (
            <Card className="items-center border border-dashed border-border bg-transparent py-14 text-center shadow-none">
              <Card.Title>{entries.length === 0 ? "The first laugh is on its way" : "That one is still out there"}</Card.Title>
              <Card.Description>{entries.length === 0 ? "There are no stories in the collection yet. Check back soon." : "Try another search, or explore the full collection."}</Card.Description>
              {entries.length > 0 && <Button variant="secondary" onPress={() => { setCategory("All"); setQuery(""); }}>Show all stories</Button>}
            </Card>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((entry) => (
                <Card key={entry.id} className="h-full gap-5 border border-border bg-surface p-6 shadow-none">
                  <Card.Header className="gap-4">
                    <div className="flex items-center justify-between gap-2">
                      <Chip size="sm" variant="soft" color={categoryColors[entry.category]}>{entry.category}</Chip>
                      <span className="font-mono text-xs text-muted">{String(entry.id).padStart(2, "0")}</span>
                    </div>
                    <Card.Title className="text-lg">{entry.title}</Card.Title>
                  </Card.Header>
                  <Card.Content className="flex-1 space-y-3 text-sm leading-7">
                    <p className="text-muted">{entry.setup}</p>
                    <p className="font-medium">{entry.punchline}</p>
                  </Card.Content>
                  <Card.Footer className="justify-between border-t border-border pt-4 text-xs text-muted">
                    <div className="flex items-center gap-2">
                      <Avatar size="sm" className="size-7"><Avatar.Fallback>{entry.author.slice(0, 1)}</Avatar.Fallback></Avatar>
                      <span>{entry.author}</span>
                    </div>
                    <span aria-label={`${entry.likes} likes, demo data`}><span aria-hidden="true">♡ </span>{entry.likes}</span>
                  </Card.Footer>
                  <VoteControls captionId={entry.id} />
                </Card>
              ))}
            </div>
          )}
        </section>
      </main>
      <footer className="flex flex-col justify-between gap-2 border-t border-border py-6 text-xs leading-6 text-muted sm:flex-row">
        <p>Stay curious. Stay a little ridiculous.</p>
        <p>Demo collection · Fictional authors and randomized likes.</p>
      </footer>
    </div>
  );
}
