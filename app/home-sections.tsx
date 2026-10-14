"use client";

import { Button, Card, Chip, Skeleton, Surface, Typography } from "@heroui/react";
import Image from "next/image";
import { audiences, type Joke } from "@/lib/jokes";
import { cultureColors, laughs } from "./cultures";
import { brandName, htmlLang, localizedBrandName, useLocale, type Messages } from "./locale";

const en = {
  eyebrow: "Jokes with a passport",
  title: "Does your joke survive the trip?",
  intro: `Share a joke in English, Spanish, or Chinese. ${brandName} retells it for the other two cultures, keeping the meaning and the punchline while swapping the wordplay and everyday references. Then readers from each culture vote: is it still funny?`,
  share: "Share a joke",
  read: "Read the jokes",
  laughsLabel: "How each culture laughs",
  statsLabel: "The lab in numbers",
  jokes: "Jokes in the feed",
  cultures: "Cultures",
  versions: "Versions generated",
  ratings: "Ratings you can see",
  ratingsHint: "Rate a joke to reveal its totals.",
  stepsTitle: "How it works",
  steps: [
    { title: "Share it in your language", body: "Post a one-liner, a pun, or a short story joke in English, Spanish, or Chinese. Sign in with Google to submit." },
    { title: "We adapt it for the other two cultures", body: "Your wording stays as the original; the other versions keep the same core punchline but borrow local wordplay, names, and situations." },
    { title: "Readers vote if it still lands", body: "Rate each version “Still funny” or “Not funny”. Totals stay hidden until you vote." },
  ],
};

const messages: Messages<typeof en> = {
  en,
  es: {
    eyebrow: "Chistes con pasaporte",
    title: "¿Tu chiste sobrevive al viaje?",
    intro: `Comparte un chiste en inglés, español o chino. ${localizedBrandName.es} lo vuelve a contar para las otras dos culturas: conserva el sentido y el remate, y cambia los juegos de palabras y las referencias cotidianas. Luego, lectores de cada cultura votan: ¿sigue siendo gracioso?`,
    share: "Compartir un chiste",
    read: "Leer los chistes",
    laughsLabel: "Cómo se ríe cada cultura",
    statsLabel: "El laboratorio en cifras",
    jokes: "Chistes publicados",
    cultures: "Culturas",
    versions: "Versiones generadas",
    ratings: "Votos que puedes ver",
    ratingsHint: "Califica un chiste para ver sus resultados.",
    stepsTitle: "Cómo funciona",
    steps: [
      { title: "Compártelo en tu idioma", body: "Publica un chiste corto, un juego de palabras o una pequeña historia en inglés, español o chino. Inicia sesión con Google para enviarlo." },
      { title: "Nosotros lo adaptamos a las otras dos culturas", body: "Tu texto se queda como original; las otras versiones mantienen el mismo remate, pero usan juegos de palabras, nombres y situaciones locales." },
      { title: "Los lectores votan si sigue funcionando", body: "Califica cada versión como “Sigue siendo gracioso” o “No tiene gracia”. Los resultados se muestran después de votar." },
    ],
  },
  zh: {
    eyebrow: "持护照旅行的笑话",
    title: "你的笑话能挺过这趟旅程吗？",
    intro: `用你的语言分享笑话——英文、西班牙文或中文都可以。${localizedBrandName.zh}会为另外两种文化重新讲述它：保留原意和笑点，替换文字游戏和日常梗。然后，来自各个文化的读者投票：它还好笑吗？`,
    share: "分享笑话",
    read: "看看笑话",
    laughsLabel: "各个文化怎么笑",
    statsLabel: "实验室数据",
    jokes: "笑话总数",
    cultures: "文化",
    versions: "已生成版本",
    ratings: "你可见的评分",
    ratingsHint: "给笑话评分后即可查看统计。",
    stepsTitle: "玩法说明",
    steps: [
      { title: "用你的语言分享", body: "用英文、西班牙文或中文发布一句俏皮话、一个双关语或一个小故事。使用 Google 登录后即可提交。" },
      { title: "我们为另外两种文化改编", body: "你的原文保持不变；其他版本保留相同的核心笑点，但换成当地的文字游戏、人名和生活场景。" },
      { title: "读者投票：还好笑吗？", body: "为每个版本选择“还好笑”或“不好笑”。投票之后才会显示统计结果。" },
    ],
  },
};

export function HomeHero({ onShare, onRead }: { onShare: () => void; onRead: () => void }) {
  const t = messages[useLocale()];
  return (
    <section aria-labelledby="hero-title" className="grid items-center gap-10 lg:grid-cols-2">
      <div className="flex flex-col items-start gap-5">
        <Chip color="accent" variant="soft">{t.eyebrow}</Chip>
        <Typography.Heading id="hero-title" level={1} className="text-4xl sm:text-5xl lg:text-6xl">{t.title}</Typography.Heading>
        <Typography.Paragraph color="muted" className="max-w-xl">{t.intro}</Typography.Paragraph>
        <div className="flex flex-wrap gap-3">
          <Button size="lg" onPress={onShare}>{t.share}</Button>
          <Button size="lg" variant="tertiary" onPress={onRead}>{t.read}</Button>
        </div>
        <ul aria-label={t.laughsLabel} className="flex flex-wrap gap-2">
          {audiences.map((audience) => (
            <li key={audience.id}>
              <Chip size="lg" variant="soft" color={cultureColors[audience.id]} lang={audience.lang}>{laughs[audience.id]}</Chip>
            </li>
          ))}
        </ul>
      </div>
      <Image src="/brand/hero.png" alt="" width={1600} height={1000} loading="eager" fetchPriority="high"
        sizes="(min-width: 1024px) 50vw, 100vw" className="h-auto w-full" />
    </section>
  );
}

export function HomeStats({ jokes, loading }: { jokes: Joke[]; loading: boolean }) {
  const locale = useLocale();
  const t = messages[locale];
  const number = new Intl.NumberFormat(htmlLang[locale]);
  const versions = jokes.reduce((sum, joke) => sum + joke.adaptations.length, 0);
  const ratings = jokes.reduce((sum, joke) => sum + (joke.revealed
    ? joke.adaptations.reduce((total, item) => total + (item.funny ?? 0) + (item.not_funny ?? 0), 0)
    : 0), 0);
  const stats = [
    { label: t.jokes, value: jokes.length, live: true },
    { label: t.cultures, value: audiences.length, live: false },
    { label: t.versions, value: versions, live: true },
    { label: t.ratings, value: ratings, live: true, hint: t.ratingsHint },
  ];

  return (
    <section aria-label={t.statsLabel} aria-busy={loading}>
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat) => (
          <Surface key={stat.label} variant="secondary" className="flex flex-col-reverse justify-end gap-1 rounded-3xl p-5">
            <dt className="flex flex-col">
              <Typography.Paragraph size="sm" weight="medium">{stat.label}</Typography.Paragraph>
              {stat.hint && <Typography.Paragraph size="xs" color="muted">{stat.hint}</Typography.Paragraph>}
            </dt>
            <dd>
              {loading && stat.live
                ? <Skeleton className="h-9 w-16 rounded-xl" />
                : <span className="text-3xl font-semibold tabular-nums">{number.format(stat.value)}</span>}
            </dd>
          </Surface>
        ))}
      </dl>
    </section>
  );
}

export function HowItWorks() {
  const t = messages[useLocale()];
  return (
    <section aria-labelledby="steps-title" className="flex flex-col gap-5">
      <Typography.Heading id="steps-title" level={2}>{t.stepsTitle}</Typography.Heading>
      <ol className="grid gap-4 md:grid-cols-3">
        {audiences.map((audience, index) => (
          <li key={audience.id} className="flex">
            <Card className="w-full">
              <Card.Header className="gap-3">
                <div className="flex items-center justify-between gap-3">
                  <Image src={`/brand/bubble-${audience.id}.png`} alt="" width={96} height={96} className="size-20" />
                  <Chip variant="soft" color={cultureColors[audience.id]}>{index + 1}</Chip>
                </div>
                <Card.Title>{t.steps[index].title}</Card.Title>
                <Card.Description>{t.steps[index].body}</Card.Description>
              </Card.Header>
            </Card>
          </li>
        ))}
      </ol>
    </section>
  );
}
