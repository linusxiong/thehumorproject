"use client";

import { Alert, Button, Card, Chip, Disclosure, EmptyState, Label, Link, Meter, Separator, Skeleton, Surface, Typography } from "@heroui/react";
import { useEffect, useState } from "react";
import { audiences, type AudienceId, type MyJoke } from "@/lib/jokes";
import { ApiError, apiErrorMessage, errorStatus } from "../api-errors";
import { cultureColors } from "../cultures";
import { postedAt } from "../joke-card";
import { audienceNames, htmlLang, useLocale, type Messages } from "../locale";

const en = {
  title: "Your jokes",
  description: "Every joke you shared and how each culture rated it.",
  shared: "Jokes shared",
  received: "Ratings received",
  stillFunny: "Still funny overall",
  bestCulture: "Travels best to",
  noData: "—",
  byCulture: "Still funny by culture",
  meter: (language: string, total: number) => `${language} · ${total} ${total === 1 ? "rating" : "ratings"}`,
  split: (funny: number, notFunny: number) => `${funny} still funny · ${notFunny} not funny`,
  noRatings: (language: string) => `${language} · no ratings yet`,
  original: (language: string) => `Original · ${language}`,
  total: (count: number) => `${count} ${count === 1 ? "rating" : "ratings"}`,
  versions: "See the versions",
  emptyTitle: "You haven't shared a joke yet",
  emptyText: "Share one on the home page and see how it travels.",
  share: "Share a joke",
  loadFailed: "Your jokes could not be loaded. Please try again.",
  retry: "Try again",
};

const messages: Messages<typeof en> = {
  en,
  es: {
    title: "Tus chistes",
    description: "Todos los chistes que compartiste y cómo los calificó cada cultura.",
    shared: "Chistes compartidos",
    received: "Calificaciones recibidas",
    stillFunny: "Siguen siendo graciosos",
    bestCulture: "Viaja mejor a",
    noData: "—",
    byCulture: "Siguen siendo graciosos por cultura",
    meter: (language, total) => `${language} · ${total} ${total === 1 ? "calificación" : "calificaciones"}`,
    split: (funny, notFunny) => `${funny} siguen siendo graciosos · ${notFunny} no tienen gracia`,
    noRatings: (language) => `${language} · aún sin calificaciones`,
    original: (language) => `Original · ${language}`,
    total: (count) => `${count} ${count === 1 ? "calificación" : "calificaciones"}`,
    versions: "Ver las versiones",
    emptyTitle: "Todavía no has compartido ningún chiste",
    emptyText: "Comparte uno en la página principal y mira cómo viaja.",
    share: "Compartir un chiste",
    loadFailed: "No pudimos cargar tus chistes. Inténtalo de nuevo.",
    retry: "Reintentar",
  },
  zh: {
    title: "我分享的笑话",
    description: "你分享过的所有笑话，以及每种文化的读者如何评价它们。",
    shared: "已分享笑话",
    received: "收到的评分",
    stillFunny: "总体还好笑比例",
    bestCulture: "最受欢迎的文化",
    noData: "—",
    byCulture: "各文化的还好笑比例",
    meter: (language, total) => `${language} · ${total} 个评分`,
    split: (funny, notFunny) => `${funny} 人觉得还好笑 · ${notFunny} 人觉得不好笑`,
    noRatings: (language) => `${language} · 暂无评分`,
    original: (language) => `原文 · ${language}`,
    total: (count) => `共 ${count} 个评分`,
    versions: "查看各版本",
    emptyTitle: "你还没有分享过笑话",
    emptyText: "去首页分享一个，看看它在各文化里的表现。",
    share: "去分享笑话",
    loadFailed: "无法加载你的笑话，请重试。",
    retry: "重试",
  },
};

type State = { revision: number; jokes: MyJoke[]; failed: { status: number | null } | null };
type Tally = { funny: number; notFunny: number };

const percent = ({ funny, notFunny }: Tally) => Math.round((funny / (funny + notFunny)) * 100);

function CultureMeter({ audience, tally, label }: { audience: AudienceId; tally: Tally; label: string }) {
  return (
    <Meter value={percent(tally)} size="sm" color={cultureColors[audience]} className="w-full">
      <Label>{label}</Label>
      <Meter.Output />
      <Meter.Track>
        <Meter.Fill />
      </Meter.Track>
    </Meter>
  );
}

export function MyJokes() {
  const locale = useLocale();
  const t = messages[locale];
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<State | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/my-jokes", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new ApiError(response.status);
        const jokes = await response.json() as MyJoke[];
        if (!controller.signal.aborted) setState({ revision, jokes, failed: null });
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setState({ revision, jokes: [], failed: { status: errorStatus(reason) } });
      });
    return () => controller.abort();
  }, [revision]);

  const loading = state?.revision !== revision;
  const jokes = state?.jokes ?? [];

  // Totals per culture across every joke the member shared.
  const byCulture = Object.fromEntries(audiences.map(({ id }) => [id, { funny: 0, notFunny: 0 }])) as Record<AudienceId, Tally>;
  for (const joke of jokes) {
    for (const version of joke.adaptations) {
      byCulture[version.audience].funny += version.funny;
      byCulture[version.audience].notFunny += version.not_funny;
    }
  }
  const overall = audiences.reduce<Tally>((sum, { id }) => ({ funny: sum.funny + byCulture[id].funny, notFunny: sum.notFunny + byCulture[id].notFunny }), { funny: 0, notFunny: 0 });
  const received = overall.funny + overall.notFunny;
  const rated = audiences.filter(({ id }) => byCulture[id].funny + byCulture[id].notFunny > 0);
  // Highest still-funny share wins; on a tie, the culture with more ratings is the stronger signal.
  const strength = (id: AudienceId) => [percent(byCulture[id]), byCulture[id].funny + byCulture[id].notFunny];
  const best = rated.length > 0 ? rated.reduce((top, item) => {
    const [share, count] = strength(item.id);
    const [topShare, topCount] = strength(top.id);
    return share > topShare || (share === topShare && count > topCount) ? item : top;
  }) : null;

  const stats = [
    { label: t.shared, value: String(jokes.length) },
    { label: t.received, value: String(received) },
    { label: t.stillFunny, value: received > 0 ? `${percent(overall)}%` : t.noData },
    { label: t.bestCulture, value: best ? audienceNames[locale][best.id] : t.noData },
  ];

  return (
    <Card aria-labelledby="my-jokes-title" aria-busy={loading}>
      <Card.Header>
        <Card.Title id="my-jokes-title">{t.title}</Card.Title>
        <Card.Description>{t.description}</Card.Description>
      </Card.Header>
      <Card.Content className="gap-5">
        {loading ? (
          <div className="flex flex-col gap-3" aria-hidden="true">
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-40 rounded-2xl" />
          </div>
        ) : state?.failed ? (
          <Alert status="danger">
            <Alert.Indicator />
            <Alert.Content><Alert.Description>{apiErrorMessage(locale, state.failed.status, t.loadFailed)}</Alert.Description></Alert.Content>
            <Button size="sm" variant="tertiary" onPress={() => setRevision((value) => value + 1)}>{t.retry}</Button>
          </Alert>
        ) : jokes.length === 0 ? (
          <EmptyState className="flex flex-col items-center gap-3 py-10 text-center">
            <Typography.Heading level={5}>{t.emptyTitle}</Typography.Heading>
            <Typography.Paragraph size="sm" color="muted">{t.emptyText}</Typography.Paragraph>
            <Link href="/#share">{t.share}</Link>
          </EmptyState>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {stats.map((stat) => (
                <Surface key={stat.label} variant="secondary" className="flex flex-col-reverse gap-1 rounded-2xl p-4">
                  <dt><Typography.Paragraph size="xs" color="muted">{stat.label}</Typography.Paragraph></dt>
                  <dd><Typography.Paragraph weight="semibold" className="text-xl">{stat.value}</Typography.Paragraph></dd>
                </Surface>
              ))}
            </dl>
            <div className="flex flex-col gap-3">
              <Typography.Paragraph size="sm" weight="semibold">{t.byCulture}</Typography.Paragraph>
              {audiences.map(({ id }) => {
                const tally = byCulture[id];
                const total = tally.funny + tally.notFunny;
                return total > 0
                  ? <CultureMeter key={id} audience={id} tally={tally} label={t.meter(audienceNames[locale][id], total)} />
                  : <Typography.Paragraph key={id} size="xs" color="muted">{t.noRatings(audienceNames[locale][id])}</Typography.Paragraph>;
              })}
            </div>
            <ul className="flex flex-col gap-4">
              {jokes.map((joke) => {
                const total = joke.adaptations.reduce((sum, version) => sum + version.funny + version.not_funny, 0);
                return (
                  <li key={joke.id} className="flex flex-col gap-3">
                    <Separator />
                    <div className="flex flex-wrap items-center gap-2">
                      <Chip size="sm" variant="soft" color={cultureColors[joke.source_language]}>{t.original(audienceNames[locale][joke.source_language])}</Chip>
                      <Chip size="sm" variant="soft" color="accent">{t.total(total)}</Chip>
                      <Typography.Paragraph size="xs" color="muted">
                        <time dateTime={joke.created_at}>{postedAt(joke.created_at, locale)}</time>
                      </Typography.Paragraph>
                    </div>
                    <Typography.Paragraph weight="medium" lang={htmlLang[joke.source_language]}>{joke.body}</Typography.Paragraph>
                    <div className="grid gap-3 md:grid-cols-3">
                      {joke.adaptations.map((version) => {
                        const tally = { funny: version.funny, notFunny: version.not_funny };
                        const language = audienceNames[locale][version.audience];
                        return (
                          <div key={version.audience} className="flex flex-col gap-1">
                            {version.funny + version.not_funny > 0 ? (
                              <>
                                <CultureMeter audience={version.audience} tally={tally} label={t.meter(language, version.funny + version.not_funny)} />
                                <Typography.Paragraph size="xs" color="muted">{t.split(version.funny, version.not_funny)}</Typography.Paragraph>
                              </>
                            ) : (
                              <Typography.Paragraph size="xs" color="muted">{t.noRatings(language)}</Typography.Paragraph>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <Disclosure>
                      <Disclosure.Heading>
                        <Button slot="trigger" size="sm" variant="tertiary">
                          {t.versions}
                          <Disclosure.Indicator />
                        </Button>
                      </Disclosure.Heading>
                      <Disclosure.Content>
                        <Disclosure.Body className="flex flex-col gap-3 pt-2">
                          {joke.adaptations.map((version) => (
                            <div key={version.audience} className="flex flex-col gap-1">
                              <Chip size="sm" variant="soft" color={cultureColors[version.audience]} className="w-fit">{audienceNames[locale][version.audience]}</Chip>
                              <Typography.Paragraph size="sm" lang={htmlLang[version.audience]}>{version.body}</Typography.Paragraph>
                            </div>
                          ))}
                        </Disclosure.Body>
                      </Disclosure.Content>
                    </Disclosure>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Card.Content>
    </Card>
  );
}
