"use client";

import {
  Alert, Button, Chip, Description, EmptyState, Label, ListBox, Select, Skeleton, Spinner, ToggleButton, ToggleButtonGroup, Typography,
} from "@heroui/react";
import { useEffect, useState } from "react";
import { audiences, isAudienceId, type Joke } from "@/lib/jokes";
import { ApiError, apiErrorMessage, errorStatus } from "./api-errors";
import { authClient } from "./auth-controls";
import { sourceName } from "./cultures";
import { HomeHero, HomeStats, HowItWorks } from "./home-sections";
import { JokeCard } from "./joke-card";
import { JokeForm } from "./joke-form";
import { audienceCultures, nativeNames, setLocale, useLocale, type Messages } from "./locale";

const en = {
  language: "Your language",
  languageHint: "Sets the interface language and which version of each joke opens first.",
  feedTitle: "Jokes from around the world",
  count: (count: number) => `${count} ${count === 1 ? "joke" : "jokes"}`,
  loaded: (count: number) => `${count} ${count === 1 ? "joke" : "jokes"} loaded`,
  loadingJokes: "Loading jokes",
  loading: "Loading…",
  refresh: "Refresh",
  loadFailed: "The jokes could not be loaded. Please try again.",
  errorTitle: "A little interruption",
  retry: "Try again",
  emptyTitle: "No jokes have crossed a border yet",
  emptyBody: "Be the first: share a joke in English, Spanish, or Chinese and see how it travels.",
  filterLabel: "Show",
  filters: { all: "All", member: "Members", import: sourceName("Qiushibaike", "en"), demo: "Demo" },
  sortLabel: "Sort by",
  sorts: { recommended: "Recommended", newest: "Newest", rated: "Most rated" },
  noMatch: "No jokes match this filter yet.",
};

const messages: Messages<typeof en> = {
  en,
  es: {
    language: "Tu idioma",
    languageHint: "Define el idioma de la interfaz y qué versión de cada chiste se abre primero.",
    feedTitle: "Chistes de todo el mundo",
    count: (count) => `${count} ${count === 1 ? "chiste" : "chistes"}`,
    loaded: (count) => `${count} ${count === 1 ? "chiste cargado" : "chistes cargados"}`,
    loadingJokes: "Cargando chistes",
    loading: "Cargando…",
    refresh: "Actualizar",
    loadFailed: "No se pudieron cargar los chistes. Inténtalo de nuevo.",
    errorTitle: "Una pequeña interrupción",
    retry: "Reintentar",
    emptyTitle: "Ningún chiste ha cruzado la frontera todavía",
    emptyBody: "Sé el primero: comparte un chiste en inglés, español o chino y mira cómo viaja.",
    filterLabel: "Mostrar",
    filters: { all: "Todos", member: "Miembros", import: sourceName("Qiushibaike", "es"), demo: "Demo" },
    sortLabel: "Ordenar por",
    sorts: { recommended: "Recomendados", newest: "Más recientes", rated: "Más votados" },
    noMatch: "Todavía no hay chistes con este filtro.",
  },
  zh: {
    language: "你的语言",
    languageHint: "设置界面语言，以及每个笑话优先显示的版本。",
    feedTitle: "来自世界各地的笑话",
    count: (count) => `${count} 个笑话`,
    loaded: (count) => `已加载 ${count} 个笑话`,
    loadingJokes: "正在加载笑话",
    loading: "加载中…",
    refresh: "刷新",
    loadFailed: "笑话加载失败，请重试。",
    errorTitle: "出了点小状况",
    retry: "重试",
    emptyTitle: "还没有笑话跨出国门",
    emptyBody: "来当第一个吧：用英文、西班牙文或中文分享一个笑话，看看它能走多远。",
    filterLabel: "显示",
    filters: { all: "全部", member: "会员", import: sourceName("Qiushibaike", "zh"), demo: "示例" },
    sortLabel: "排序",
    sorts: { recommended: "推荐", newest: "最新", rated: "评分最多" },
    noMatch: "暂时没有符合筛选条件的笑话。",
  },
};

type Filter = keyof typeof en.filters;
type Sort = keyof typeof en.sorts;
const isSort = (key: unknown): key is Sort => typeof key === "string" && key in en.sorts;
// Random position per joke for the Recommended order; jokes added later (no rank) go first.
type Shuffle = Record<number, number>;
type Feed = { key: string; jokes: Joke[]; shuffle: Shuffle; failed: { status: number | null } | null };

const shuffled = (jokes: Joke[]): Shuffle => Object.fromEntries(jokes.map((joke) => [joke.id, Math.random()]));

// Ratings the viewer can see; hidden totals count as zero so sorting never leaks them.
const visibleRatings = (joke: Joke) => joke.revealed
  ? joke.adaptations.reduce((sum, item) => sum + (item.funny ?? 0) + (item.not_funny ?? 0), 0)
  : 0;

function scrollToSection(id: string) {
  const section = document.getElementById(id);
  section?.scrollIntoView({ behavior: "smooth", block: "start" });
  section?.querySelector<HTMLElement>("textarea, button")?.focus({ preventScroll: true });
}

export function JokesExplorer() {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const userId = session?.user.id;
  const locale = useLocale();
  const t = messages[locale];
  const [feed, setFeed] = useState<Feed | null>(null);
  const [revision, setRevision] = useState(0);
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("recommended");
  const feedKey = `${userId ?? "guest"}:${revision}`;

  // Ratings and revealed totals depend on the viewer, so reload whenever the signed-in user changes.
  useEffect(() => {
    if (sessionPending) return;
    const controller = new AbortController();
    fetch("/api/jokes", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new ApiError(response.status);
        const jokes = await response.json() as Joke[];
        if (!controller.signal.aborted) setFeed({ key: feedKey, jokes, shuffle: shuffled(jokes), failed: null });
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setFeed((current) => ({ key: feedKey, jokes: current?.jokes ?? [], shuffle: current?.shuffle ?? {}, failed: { status: errorStatus(reason) } }));
        }
      });
    return () => controller.abort();
  }, [feedKey, sessionPending]);

  function updateJokes(update: (jokes: Joke[]) => Joke[]) {
    setFeed((current) => (current ? { ...current, jokes: update(current.jokes) } : current));
  }

  function replaceJoke(next: Joke) {
    updateJokes((jokes) => jokes.map((joke) => (joke.id === next.id ? next : joke)));
  }

  const jokes = feed?.jokes ?? [];
  const busy = sessionPending || feed?.key !== feedKey;
  const error = busy || !feed?.failed ? null : apiErrorMessage(locale, feed.failed.status, t.loadFailed);
  const shuffle = feed?.shuffle ?? {};
  const order = (a: Joke, b: Joke) => {
    if (sort === "recommended") return (shuffle[a.id] ?? -1) - (shuffle[b.id] ?? -1);
    return (sort === "rated" ? visibleRatings(b) - visibleRatings(a) : 0) || b.created_at.localeCompare(a.created_at);
  };
  const shown = jokes.filter((joke) => filter === "all" || joke.origin === filter).sort(order);

  // Choosing Recommended again draws a fresh random order.
  function chooseSort(key: Sort) {
    if (key === "recommended") setFeed((current) => (current ? { ...current, shuffle: shuffled(current.jokes) } : current));
    setSort(key);
  }

  return (
    <div className="flex flex-col gap-16">
      <HomeHero onShare={() => scrollToSection("share")} onRead={() => scrollToSection("feed")} />
      <HomeStats jokes={jokes} loading={busy && jokes.length === 0} />
      <HowItWorks />

      <section id="share" className="scroll-mt-6">
        <JokeForm onCreated={(joke) => updateJokes((current) => [joke, ...current.filter((item) => item.id !== joke.id)])} />
      </section>

      <section id="feed" aria-labelledby="feed-title" aria-busy={busy} className="flex scroll-mt-6 flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Typography.Heading id="feed-title" level={2}>{t.feedTitle}</Typography.Heading>
            {!busy && !error && <Chip size="sm" variant="soft" color="accent">{t.count(jokes.length)}</Chip>}
          </div>
          <Button size="sm" variant="tertiary" onPress={() => setRevision((value) => value + 1)} isPending={busy}>
            {({ isPending }) => (
              <>
                {isPending && <Spinner size="sm" color="current" />}
                {isPending ? t.loading : t.refresh}
              </>
            )}
          </Button>
        </div>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <Select className="w-full sm:w-80" value={locale} onChange={(value) => { if (isAudienceId(value)) setLocale(value); }}>
            <Label>{t.language}</Label>
            <Select.Trigger>
              <Select.Value>{({ defaultChildren, isPlaceholder }) => (isPlaceholder ? defaultChildren : nativeNames[locale])}</Select.Value>
              <Select.Indicator />
            </Select.Trigger>
            <Description>{t.languageHint}</Description>
            <Select.Popover>
              <ListBox>
                {audiences.map((audience) => (
                  <ListBox.Item key={audience.id} id={audience.id} textValue={nativeNames[audience.id]}>
                    <div className="flex flex-col">
                      <Label>{nativeNames[audience.id]}</Label>
                      <Description>{audienceCultures[locale][audience.id]}</Description>
                    </div>
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
          <div className="flex flex-wrap items-center gap-3">
            <ToggleButtonGroup aria-label={t.filterLabel} size="sm" selectionMode="single" disallowEmptySelection
              selectedKeys={[filter]} onSelectionChange={(keys) => {
                const [key] = keys;
                if (key === "all" || key === "member" || key === "import" || key === "demo") setFilter(key);
              }}>
              {(Object.keys(t.filters) as Filter[]).map((key) => (
                <ToggleButton key={key} id={key}>{t.filters[key]}</ToggleButton>
              ))}
            </ToggleButtonGroup>
            <ToggleButtonGroup aria-label={t.sortLabel} size="sm" selectionMode="single" disallowEmptySelection
              selectedKeys={[sort]} onSelectionChange={(keys) => {
                const [key] = keys;
                if (isSort(key)) chooseSort(key);
              }}>
              {(Object.keys(t.sorts) as Sort[]).map((key) => (
                <ToggleButton key={key} id={key}>{t.sorts[key]}</ToggleButton>
              ))}
            </ToggleButtonGroup>
          </div>
        </div>

        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {busy ? t.loadingJokes : error ? error : t.loaded(shown.length)}
        </div>
        {error ? (
          <Alert status="danger">
            <Alert.Indicator />
            <Alert.Content><Alert.Title>{t.errorTitle}</Alert.Title><Alert.Description>{error}</Alert.Description></Alert.Content>
            <Button size="sm" variant="tertiary" onPress={() => setRevision((value) => value + 1)}>{t.retry}</Button>
          </Alert>
        ) : busy && jokes.length === 0 ? (
          <div className="flex flex-col gap-5" aria-hidden="true">
            {Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-72 rounded-3xl" />)}
          </div>
        ) : jokes.length === 0 ? (
          <EmptyState className="flex flex-col items-center gap-3 py-16 text-center">
            <Typography.Heading level={3}>{t.emptyTitle}</Typography.Heading>
            <Typography.Paragraph size="sm" color="muted">{t.emptyBody}</Typography.Paragraph>
          </EmptyState>
        ) : shown.length === 0 ? (
          <EmptyState className="flex flex-col items-center gap-3 py-16 text-center">
            <Typography.Paragraph size="sm" color="muted">{t.noMatch}</Typography.Paragraph>
          </EmptyState>
        ) : (
          <div className="flex flex-col gap-5">
            {shown.map((joke) => (
              <JokeCard key={joke.id} joke={joke} signedIn={!!session} onChange={replaceJoke} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
