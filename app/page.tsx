"use client";

import { Alert, Avatar, Button, Card, Chip, EmptyState, SearchField, Separator, Skeleton, Spinner, ToggleButton, ToggleButtonGroup, Typography } from "@heroui/react";
import { useEffect, useState } from "react";
import { categories, filterHumor, loadHumor, type Category, type HumorEntry } from "@/lib/humor";
import { PageShell } from "./page-shell";
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
    <PageShell>
      <section aria-labelledby="page-title" className="flex flex-col gap-4">
        <Chip color="accent" variant="soft">A little humor, every day</Chip>
        <Typography.Heading id="page-title" level={1}>
          Life is serious.<br /><span className="text-accent">You don’t have to be.</span>
        </Typography.Heading>
        <Typography.Paragraph color="muted" className="max-w-lg">
          Small observations. Unexpected punchlines. A collection of reasons to take your day a little less seriously.
        </Typography.Paragraph>
      </section>

      <section aria-labelledby="collection-title" className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Typography.Heading id="collection-title" level={4}>The collection</Typography.Heading>
            {!loading && !error && <Chip size="sm" variant="soft">{entries.length} {entries.length === 1 ? "story" : "stories"}</Chip>}
          </div>
          <Button size="sm" variant="tertiary" onPress={refresh} isPending={loading}>
            {({ isPending }) => (
              <>
                {isPending && <Spinner size="sm" color="current" />}
                {isPending ? "Loading…" : "Refresh"}
              </>
            )}
          </Button>
        </div>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <ToggleButtonGroup aria-label="Filter by category" size="sm" selectionMode="single" disallowEmptySelection
            selectedKeys={[category]} onSelectionChange={(keys) => setCategory([...keys][0] as Category)}>
            {categories.map((item, index) => (
              <ToggleButton key={item} id={item}>
                {index > 0 && <ToggleButtonGroup.Separator />}
                {item}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
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
            {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-64 rounded-3xl" />)}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState className="flex flex-col items-center gap-3 py-16 text-center">
            <Typography.Heading level={5}>{entries.length === 0 ? "The first laugh is on its way" : "That one is still out there"}</Typography.Heading>
            <Typography.Paragraph size="sm" color="muted">
              {entries.length === 0 ? "There are no stories in the collection yet. Check back soon." : "Try another search, or explore the full collection."}
            </Typography.Paragraph>
            {entries.length > 0 && <Button variant="secondary" onPress={() => { setCategory("All"); setQuery(""); }}>Show all stories</Button>}
          </EmptyState>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((entry) => (
              <Card key={entry.id}>
                <Card.Header className="gap-2">
                  <Chip size="sm" variant="soft" color={categoryColors[entry.category]}>{entry.category}</Chip>
                  <Card.Title>{entry.title}</Card.Title>
                </Card.Header>
                <Card.Content className="gap-3">
                  <Typography.Paragraph size="sm" color="muted">{entry.setup}</Typography.Paragraph>
                  <Typography.Paragraph size="sm" weight="medium">{entry.punchline}</Typography.Paragraph>
                </Card.Content>
                <Separator />
                <Card.Footer className="justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Avatar size="sm"><Avatar.Fallback>{entry.author.slice(0, 1)}</Avatar.Fallback></Avatar>
                    <Typography.Paragraph size="sm" color="muted">{entry.author}</Typography.Paragraph>
                  </div>
                  <VoteControls captionId={entry.id} />
                </Card.Footer>
              </Card>
            ))}
          </div>
        )}
      </section>
    </PageShell>
  );
}
