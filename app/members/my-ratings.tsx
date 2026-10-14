"use client";

import { Alert, Button, Card, Chip, EmptyState, Link, Separator, Skeleton, Typography } from "@heroui/react";
import { useEffect, useState } from "react";
import type { MyRating } from "@/lib/jokes";
import { ApiError, apiErrorMessage, errorStatus } from "../api-errors";
import { cultureColors, sourceName } from "../cultures";
import { postedAt } from "../joke-card";
import { audienceNames, htmlLang, useLocale, type Messages } from "../locale";
import { LaughIcon, MehIcon } from "../rating-icons";

const en = {
  title: "Your ratings",
  description: "Every version you rated, newest first.",
  total: (count: number) => `${count} ${count === 1 ? "rating" : "ratings"}`,
  funnyShare: (percent: number) => `${percent}% still funny`,
  stillFunny: "Still funny",
  notFunny: "Not funny",
  version: (language: string) => `${language} version`,
  original: (language: string) => `Original · ${language}`,
  by: (name: string) => `by ${name}`,
  emptyTitle: "No ratings yet",
  emptyText: "Rate a version on the home page and it will show up here.",
  browse: "Browse jokes",
  loadFailed: "Your ratings could not be loaded. Please try again.",
  retry: "Try again",
};

const messages: Messages<typeof en> = {
  en,
  es: {
    title: "Tus calificaciones",
    description: "Cada versión que calificaste, de la más reciente a la más antigua.",
    total: (count) => `${count} ${count === 1 ? "calificación" : "calificaciones"}`,
    funnyShare: (percent) => `${percent}% sigue siendo gracioso`,
    stillFunny: "Sigue siendo gracioso",
    notFunny: "No tiene gracia",
    version: (language) => `Versión en ${language.toLowerCase()}`,
    original: (language) => `Original · ${language}`,
    by: (name) => `de ${name}`,
    emptyTitle: "Todavía no has calificado nada",
    emptyText: "Califica una versión en la página principal y aparecerá aquí.",
    browse: "Ver chistes",
    loadFailed: "No pudimos cargar tus calificaciones. Inténtalo de nuevo.",
    retry: "Reintentar",
  },
  zh: {
    title: "我的评价",
    description: "你评价过的所有版本，按时间从新到旧排列。",
    total: (count) => `共 ${count} 条评价`,
    funnyShare: (percent) => `${percent}% 认为还好笑`,
    stillFunny: "还好笑",
    notFunny: "不好笑",
    version: (language) => `${language}版本`,
    original: (language) => `原文 · ${language}`,
    by: (name) => `${name} 发布`,
    emptyTitle: "还没有评价",
    emptyText: "在首页给任意版本评分后，就会显示在这里。",
    browse: "去看笑话",
    loadFailed: "无法加载你的评价，请重试。",
    retry: "重试",
  },
};

type State = { revision: number; ratings: MyRating[]; failed: { status: number | null } | null };

export function MyRatings() {
  const locale = useLocale();
  const t = messages[locale];
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<State | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/my-ratings", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new ApiError(response.status);
        const ratings = await response.json() as MyRating[];
        if (!controller.signal.aborted) setState({ revision, ratings, failed: null });
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setState({ revision, ratings: [], failed: { status: errorStatus(reason) } });
      });
    return () => controller.abort();
  }, [revision]);

  const loading = state?.revision !== revision;
  const ratings = state?.ratings ?? [];
  const funny = ratings.filter((rating) => rating.funny).length;

  return (
    <Card aria-labelledby="my-ratings-title" aria-busy={loading}>
      <Card.Header className="gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Card.Title id="my-ratings-title">{t.title}</Card.Title>
          {!loading && ratings.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Chip size="sm" variant="soft" color="accent">{t.total(ratings.length)}</Chip>
              <Chip size="sm" variant="soft" color="success">{t.funnyShare(Math.round((funny / ratings.length) * 100))}</Chip>
            </div>
          )}
        </div>
        <Card.Description>{t.description}</Card.Description>
      </Card.Header>
      <Card.Content className="gap-4">
        {loading ? (
          <div className="flex flex-col gap-3" aria-hidden="true">
            {Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-24 rounded-2xl" />)}
          </div>
        ) : state?.failed ? (
          <Alert status="danger">
            <Alert.Indicator />
            <Alert.Content><Alert.Description>{apiErrorMessage(locale, state.failed.status, t.loadFailed)}</Alert.Description></Alert.Content>
            <Button size="sm" variant="tertiary" onPress={() => setRevision((value) => value + 1)}>{t.retry}</Button>
          </Alert>
        ) : ratings.length === 0 ? (
          <EmptyState className="flex flex-col items-center gap-3 py-10 text-center">
            <Typography.Heading level={5}>{t.emptyTitle}</Typography.Heading>
            <Typography.Paragraph size="sm" color="muted">{t.emptyText}</Typography.Paragraph>
            <Link href="/">{t.browse}</Link>
          </EmptyState>
        ) : (
          <ul className="flex flex-col gap-4">
            {ratings.map((rating, index) => (
              <li key={rating.adaptation_id} className="flex flex-col gap-3">
                {index > 0 && <Separator />}
                <div className="flex flex-wrap items-center gap-2">
                  <Chip size="sm" variant="soft" color={rating.funny ? "success" : "danger"}>
                    {rating.funny ? <LaughIcon width={14} height={14} /> : <MehIcon width={14} height={14} />}
                    {rating.funny ? t.stillFunny : t.notFunny}
                  </Chip>
                  <Chip size="sm" variant="soft" color={cultureColors[rating.audience]}>
                    {t.version(audienceNames[locale][rating.audience])}
                  </Chip>
                  <Typography.Paragraph size="xs" color="muted">
                    <time dateTime={rating.rated_at}>{postedAt(rating.rated_at, locale)}</time>
                  </Typography.Paragraph>
                </div>
                <Typography.Paragraph weight="medium" lang={htmlLang[rating.audience]}>{rating.version}</Typography.Paragraph>
                <div className="flex flex-col gap-1">
                  <Typography.Paragraph size="xs" color="muted">
                    {t.original(audienceNames[locale][rating.joke.source_language])} · {t.by(rating.joke.author_name)}
                    {rating.joke.origin === "import" && rating.joke.source_label ? ` · ${sourceName(rating.joke.source_label, locale)}` : ""}
                  </Typography.Paragraph>
                  {/* The version in the source language is the original itself; repeat the original only for translations. */}
                  {rating.audience !== rating.joke.source_language && (
                    <Typography.Paragraph size="sm" color="muted" lang={htmlLang[rating.joke.source_language]}>{rating.joke.body}</Typography.Paragraph>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card.Content>
    </Card>
  );
}
