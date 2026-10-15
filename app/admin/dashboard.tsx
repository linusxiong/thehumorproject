"use client";

import { ArrowRotateRight } from "@gravity-ui/icons";
import { Button, buttonVariants, Card, Tabs, Typography } from "@heroui/react";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { adminRanges, type AdminRange, type DashboardStats, type Mechanism, type RatedVersion } from "@/lib/admin-types";
import type { JokeOrigin } from "@/lib/jokes";
import { sourceName } from "../cultures";
import { audienceNames, htmlLang, useLocale, type Messages } from "../locale";
import { CultureLabel, cultureColor, PageHeading, plural, RatingCounts, StatTile, TrendChip, useFormat, useHydrated } from "./admin-ui";
import { BarRows, ColumnChart, Legend, Sparkline, StackedBar, type ColumnDatum, type Segment } from "./charts";

const en = {
  welcome: (name: string) => `Welcome back, ${name}`,
  greetings: [(name: string) => `Good morning, ${name}`, (name: string) => `Good afternoon, ${name}`, (name: string) => `Good evening, ${name}`],
  intro: "How jokes are traveling across cultures.",
  range: "Date range",
  ranges: { 7: "7D", 30: "30D", 90: "90D", 365: "12M" } as Record<AdminRange, string>,
  rangeNames: { 7: "Last 7 days", 30: "Last 30 days", 90: "Last 90 days", 365: "Last 12 months" } as Record<AdminRange, string>,
  refresh: "Refresh",
  jokes: "Jokes shared",
  versions: "AI versions generated",
  ratings: "Ratings",
  accounts: "Active accounts",
  totalJokes: (total: string) => `${total} in total`,
  totalVersions: (total: string, edited: string) => `${total} in total · ${edited} edited`,
  funnyShare: (share: string) => `${share} still funny`,
  noRatings: "No ratings in this period",
  totalAccounts: (total: string, admins: string) => `${plural(total, "account", "accounts")} · ${plural(admins, "superadmin", "superadmins")}`,
  activity: "Activity",
  activityHint: (weekly: boolean): string => (weekly ? "Per week (UTC)" : "Per day (UTC)"),
  metric: "Metric",
  metricJokes: "Jokes",
  inPeriod: "In this period",
  average: (weekly: boolean): string => (weekly ? "Weekly average" : "Daily average"),
  busiest: (weekly: boolean): string => (weekly ? "Busiest week" : "Busiest day"),
  weekOf: (label: string) => `Week of ${label}`,
  chartLabel: (metric: string, range: string) => `${metric}, ${range}`,
  survival: "Does the punchline survive?",
  survivalHint: "Share of “Still funny?” answers per culture, all time.",
  stillFunny: "Still funny",
  notFunny: "Not funny",
  overall: (share: string, total: string) => `${share} still funny across ${plural(total, "rating", "ratings")}`,
  noVotes: "No ratings yet",
  segment: (label: string, count: string, share: string) => `${label}: ${count} (${share})`,
  mechanisms: "What makes it funny",
  mechanismsHint: (jokes: string) => `Comic devices named in the punchline notes of ${plural(jokes, "joke", "jokes")}. A joke can use several.`,
  mechanismNames: {
    reversal: "Twist or reveal", deadpan: "Deadpan delivery", literal: "Literal reading", absurd: "Absurd exaggeration",
    wordplay: "Wordplay, puns, homophones", irony: "Irony and parody", self_mockery: "Self-mockery", innuendo: "Innuendo",
  } as Record<Mechanism, string>,
  stretch: "Translation stretch",
  stretchHint: "Median length of an adapted version compared with its original. Chinese packs far more into each character.",
  sameLength: "The line marks the original's length (1×).",
  versionsCount: (count: string) => plural(count, "version", "versions"),
  rewrites: "How much each culture rewrites",
  rewritesHint: "Versions in a language other than the original, classified from the adaptation notes.",
  kept: "Kept close",
  adapted: "Reworded",
  swapped: "Swapped a cultural reference",
  swappedShare: (share: string, total: string) => `${share} swapped · ${plural(total, "version", "versions")}`,
  board: "Crowd board",
  favorites: "Crowd favorites",
  lost: "Lost in translation",
  favoritesEmpty: "No version has been rated still funny yet.",
  lostEmpty: "No version has been rated not funny yet. Nothing lost so far.",
  original: "Original",
  manageMedia: "Manage AI media",
  collection: "Collection",
  collectionHint: "Where the jokes come from.",
  originNames: { member: "Members", demo: "Demo" } as Record<Exclude<JokeOrigin, "import">, string>,
  adultJokes: "18+ jokes",
  explanations: "Explanations accepted",
  editedVersions: "Versions edited by admins",
  languages: "Original languages",
  ofTotal: (count: string, total: string) => `${count} of ${total}`,
};

type Text = typeof en;

const messages: Messages<Text> = {
  en,
  es: {
    welcome: (name) => `Hola de nuevo, ${name}`,
    greetings: [(name) => `Buenos días, ${name}`, (name) => `Buenas tardes, ${name}`, (name) => `Buenas noches, ${name}`],
    intro: "Cómo viajan los chistes entre culturas.",
    range: "Periodo",
    ranges: { 7: "7 d", 30: "30 d", 90: "90 d", 365: "12 m" },
    rangeNames: { 7: "Últimos 7 días", 30: "Últimos 30 días", 90: "Últimos 90 días", 365: "Últimos 12 meses" },
    refresh: "Actualizar",
    jokes: "Chistes compartidos",
    versions: "Versiones generadas por IA",
    ratings: "Calificaciones",
    accounts: "Cuentas activas",
    totalJokes: (total) => `${total} en total`,
    totalVersions: (total, edited) => `${total} en total · ${edited} editadas`,
    funnyShare: (share) => `${share} sigue siendo gracioso`,
    noRatings: "Sin calificaciones en este periodo",
    totalAccounts: (total, admins) => `${plural(total, "cuenta", "cuentas")} · ${plural(admins, "superadministrador", "superadministradores")}`,
    activity: "Actividad",
    activityHint: (weekly) => (weekly ? "Por semana (UTC)" : "Por día (UTC)"),
    metric: "Métrica",
    metricJokes: "Chistes",
    inPeriod: "En este periodo",
    average: (weekly) => (weekly ? "Promedio semanal" : "Promedio diario"),
    busiest: (weekly) => (weekly ? "Semana con más actividad" : "Día con más actividad"),
    weekOf: (label) => `Semana del ${label}`,
    chartLabel: (metric, range) => `${metric}, ${range.toLocaleLowerCase("es")}`,
    survival: "¿Sobrevive el remate?",
    survivalHint: "Proporción de respuestas «¿Sigue siendo gracioso?» por cultura, desde el inicio.",
    stillFunny: "Sigue siendo gracioso",
    notFunny: "No es gracioso",
    overall: (share, total) => `${share} sigue siendo gracioso en ${plural(total, "calificación", "calificaciones")}`,
    noVotes: "Aún no hay calificaciones",
    segment: (label, count, share) => `${label}: ${count} (${share})`,
    mechanisms: "Qué lo hace gracioso",
    mechanismsHint: (jokes) => `Recursos cómicos mencionados en las notas del remate de ${plural(jokes, "chiste", "chistes")}. Un chiste puede usar varios.`,
    mechanismNames: {
      reversal: "Giro o revelación", deadpan: "Humor seco", literal: "Lectura literal", absurd: "Exageración absurda",
      wordplay: "Juegos de palabras y homófonos", irony: "Ironía y parodia", self_mockery: "Autoburla", innuendo: "Doble sentido",
    },
    stretch: "Estiramiento de la traducción",
    stretchHint: "Longitud mediana de una versión adaptada frente a su original. El chino condensa mucho más en cada carácter.",
    sameLength: "La línea marca la longitud del original (1×).",
    versionsCount: (count) => plural(count, "versión", "versiones"),
    rewrites: "Cuánto reescribe cada cultura",
    rewritesHint: "Versiones en un idioma distinto del original, clasificadas a partir de las notas de adaptación.",
    kept: "Casi sin cambios",
    adapted: "Reformulada",
    swapped: "Cambió una referencia cultural",
    swappedShare: (share, total) => `${share} con referencia cambiada · ${plural(total, "versión", "versiones")}`,
    board: "Tablero del público",
    favorites: "Favoritos del público",
    lost: "Perdidos en la traducción",
    favoritesEmpty: "Ninguna versión ha sido calificada como graciosa todavía.",
    lostEmpty: "Ninguna versión ha sido calificada como no graciosa. Nada perdido por ahora.",
    original: "Original",
    manageMedia: "Gestionar contenido IA",
    collection: "Colección",
    collectionHint: "De dónde vienen los chistes.",
    originNames: { member: "Miembros", demo: "Demo" },
    adultJokes: "Chistes +18",
    explanations: "Explicaciones aceptadas",
    editedVersions: "Versiones editadas por administradores",
    languages: "Idiomas originales",
    ofTotal: (count, total) => `${count} de ${total}`,
  },
  zh: {
    welcome: (name) => `欢迎回来，${name}`,
    greetings: [(name) => `早上好，${name}`, (name) => `下午好，${name}`, (name) => `晚上好，${name}`],
    intro: "看看笑话正在如何跨越文化。",
    range: "时间范围",
    ranges: { 7: "7天", 30: "30天", 90: "90天", 365: "12个月" },
    rangeNames: { 7: "最近 7 天", 30: "最近 30 天", 90: "最近 90 天", 365: "最近 12 个月" },
    refresh: "刷新",
    jokes: "分享的笑话",
    versions: "AI 生成的版本",
    ratings: "评价",
    accounts: "活跃账户",
    totalJokes: (total) => `累计 ${total} 个`,
    totalVersions: (total, edited) => `累计 ${total} 个 · ${edited} 个经过编辑`,
    funnyShare: (share) => `${share} 认为依然好笑`,
    noRatings: "此期间暂无评价",
    totalAccounts: (total, admins) => `共 ${total} 个账户 · ${admins} 位超级管理员`,
    activity: "活跃度",
    activityHint: (weekly) => (weekly ? "按周统计（UTC）" : "按天统计（UTC）"),
    metric: "指标",
    metricJokes: "笑话",
    inPeriod: "本期间",
    average: (weekly) => (weekly ? "周平均" : "日平均"),
    busiest: (weekly) => (weekly ? "最活跃的一周" : "最活跃的一天"),
    weekOf: (label) => `${label} 起的一周`,
    chartLabel: (metric, range) => `${metric}，${range}`,
    survival: "笑点还在吗？",
    survivalHint: "各文化版本中“依然好笑？”的回答占比（全部时间）。",
    stillFunny: "依然好笑",
    notFunny: "不好笑",
    overall: (share, total) => `${total} 条评价中 ${share} 认为依然好笑`,
    noVotes: "暂无评价",
    segment: (label, count, share) => `${label}：${count}（${share}）`,
    mechanisms: "笑点从哪里来",
    mechanismsHint: (jokes) => `统计 ${jokes} 个笑话的笑点说明中提到的喜剧手法，一个笑话可能用到多种。`,
    mechanismNames: {
      reversal: "反转与揭晓", deadpan: "冷面幽默", literal: "字面理解", absurd: "荒诞夸张",
      wordplay: "谐音、双关与文字游戏", irony: "讽刺与戏仿", self_mockery: "自嘲", innuendo: "暗示与荤梗",
    },
    stretch: "翻译后的长度变化",
    stretchHint: "改编版本与原文长度之比的中位数。中文每个字承载的信息要多得多。",
    sameLength: "竖线表示原文长度（1×）。",
    versionsCount: (count) => `${count} 个版本`,
    rewrites: "各文化改写了多少",
    rewritesHint: "与原文语言不同的版本，根据改编说明分类。",
    kept: "基本保留",
    adapted: "重新措辞",
    swapped: "替换了文化梗",
    swappedShare: (share, total) => `${share} 替换了文化梗 · 共 ${total} 个版本`,
    board: "读者榜",
    favorites: "最受欢迎",
    lost: "翻译中丢失的笑点",
    favoritesEmpty: "还没有版本被评为依然好笑。",
    lostEmpty: "还没有版本被评为不好笑，目前没有丢失的笑点。",
    original: "原文",
    manageMedia: "管理 AI 内容",
    collection: "内容构成",
    collectionHint: "笑话的来源。",
    originNames: { member: "会员", demo: "示例" },
    adultJokes: "18+ 笑话",
    explanations: "已采纳的解释",
    editedVersions: "管理员编辑过的版本",
    languages: "原文语言",
    ofTotal: (count, total) => `${count} / ${total}`,
  },
};

// Daily counts, or weekly sums ending today for the 12-month range.
function series(daily: DashboardStats["daily"], metric: "jokes" | "ratings", weekly: boolean, label: (iso: string) => string, weekOf: (label: string) => string): ColumnDatum[] {
  if (!weekly) return daily.map((day) => ({ key: day.day, label: label(day.day), value: day[metric] }));
  const weeks: ColumnDatum[] = [];
  for (let end = daily.length; end > 0; end -= 7) {
    const days = daily.slice(Math.max(0, end - 7), end);
    const start = label(days[0].day);
    weeks.unshift({ key: days[0].day, label: start, tooltip: weekOf(start), value: days.reduce((sum, day) => sum + day[metric], 0) });
  }
  return weeks;
}

export function Dashboard({ stats, range, name }: { stats: DashboardStats; range: AdminRange; name: string }) {
  const locale = useLocale();
  const t = messages[locale];
  const format = useFormat();
  const hydrated = useHydrated();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [metric, setMetric] = useState<"jokes" | "ratings">("jokes");
  const weekly = range > 90;
  const firstName = name.trim().split(/\s+/)[0] || name;
  const hour = hydrated ? new Date().getHours() : null;
  const greeting = hour === null ? t.welcome(firstName) : t.greetings[hour < 12 ? 0 : hour < 18 ? 1 : 2](firstName);
  const { totals, period } = stats;
  const jokesSeries = series(stats.daily, "jokes", weekly, format.day, t.weekOf);
  const ratingsSeries = series(stats.daily, "ratings", weekly, format.day, t.weekOf);
  const chartSeries = metric === "jokes" ? jokesSeries : ratingsSeries;
  const busiest = chartSeries.reduce<ColumnDatum | null>((best, datum) => (datum.value > (best?.value ?? 0) ? datum : best), null);
  const share = (count: number, total: number) => format.percent(total > 0 ? count / total : 0);

  return (
    <div className={`flex flex-col gap-6 transition-opacity ${pending ? "opacity-60" : ""}`} aria-busy={pending}>
      <PageHeading title={greeting} description={t.intro} actions={(
        <>
          <Tabs selectedKey={String(range)} onSelectionChange={(key) => startTransition(() => router.push(`/admin?range=${key}`, { scroll: false }))}>
            <Tabs.ListContainer>
              <Tabs.List aria-label={t.range}>
                {adminRanges.map((option) => (
                  <Tabs.Tab key={option} id={String(option)} className="whitespace-nowrap">
                    {t.ranges[option]}
                    <Tabs.Indicator />
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            </Tabs.ListContainer>
          </Tabs>
          <Button isIconOnly variant="tertiary" aria-label={t.refresh} onPress={() => startTransition(() => router.refresh())}>
            <ArrowRotateRight aria-hidden className="size-4" />
          </Button>
        </>
      )} />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label={t.rangeNames[range]}>
        <StatTile label={t.jokes} value={format.compact(period.jokes)} trend={<TrendChip current={period.jokes} previous={period.previous_jokes} />}
          caption={t.totalJokes(format.number(totals.jokes))} chart={<Sparkline values={jokesSeries.map((datum) => datum.value)} color="var(--accent)" />} />
        <StatTile label={t.versions} value={format.compact(period.versions)} trend={<TrendChip current={period.versions} previous={period.previous_versions} />}
          caption={t.totalVersions(format.number(totals.versions), format.number(totals.edited_versions))} />
        <StatTile label={t.ratings} value={format.compact(period.ratings)} trend={<TrendChip current={period.ratings} previous={period.previous_ratings} />}
          caption={period.ratings > 0 ? t.funnyShare(share(period.funny, period.ratings)) : t.noRatings}
          chart={<Sparkline values={ratingsSeries.map((datum) => datum.value)} color="var(--accent)" />} />
        <StatTile label={t.accounts} value={format.compact(period.active_accounts)}
          trend={<TrendChip current={period.active_accounts} previous={period.previous_active_accounts} />}
          caption={t.totalAccounts(format.number(totals.accounts), format.number(totals.superadmins))} />
      </section>

      <div className="grid gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <Card.Header className="flex flex-row flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <Card.Title>{t.activity}</Card.Title>
              <Card.Description>{t.activityHint(weekly)}</Card.Description>
            </div>
            <Tabs selectedKey={metric} onSelectionChange={(key) => setMetric(key === "ratings" ? "ratings" : "jokes")}>
              <Tabs.ListContainer>
                <Tabs.List aria-label={t.metric}>
                  <Tabs.Tab id="jokes" className="whitespace-nowrap">{t.metricJokes}<Tabs.Indicator /></Tabs.Tab>
                  <Tabs.Tab id="ratings" className="whitespace-nowrap">{t.ratings}<Tabs.Indicator /></Tabs.Tab>
                </Tabs.List>
              </Tabs.ListContainer>
            </Tabs>
          </Card.Header>
          <Card.Content className="flex flex-col gap-4">
            <dl className="flex flex-wrap gap-x-8 gap-y-2">
              <div className="flex flex-col">
                <dt className="order-2 text-xs text-muted">{t.inPeriod}</dt>
                <dd className="text-lg font-semibold">{format.number(metric === "jokes" ? period.jokes : period.ratings)}</dd>
              </div>
              <div className="flex flex-col">
                <dt className="order-2 text-xs text-muted">{t.average(weekly)}</dt>
                <dd className="text-lg font-semibold">
                  {format.number(Math.round((chartSeries.reduce((sum, datum) => sum + datum.value, 0) / Math.max(1, chartSeries.length)) * 10) / 10)}
                </dd>
              </div>
              {busiest && (
                <div className="flex flex-col">
                  <dt className="order-2 text-xs text-muted">{t.busiest(weekly)}</dt>
                  <dd className="text-lg font-semibold">{busiest.tooltip ?? busiest.label} · {format.number(busiest.value)}</dd>
                </div>
              )}
            </dl>
            <ColumnChart data={chartSeries} color="var(--accent)" formatValue={format.number}
              ariaLabel={t.chartLabel(metric === "jokes" ? t.jokes : t.ratings, t.rangeNames[range])} />
          </Card.Content>
        </Card>

        <Card className="xl:col-span-2">
          <Card.Header>
            <Card.Title>{t.survival}</Card.Title>
            <Card.Description>{t.survivalHint}</Card.Description>
          </Card.Header>
          <Card.Content className="flex flex-col gap-5">
            <Typography.Paragraph size="sm" className="font-medium">
              {totals.ratings > 0 ? t.overall(share(totals.funny, totals.ratings), format.number(totals.ratings)) : t.noVotes}
            </Typography.Paragraph>
            <Legend items={[{ key: "funny", label: t.stillFunny, color: "var(--success)" }, { key: "not", label: t.notFunny, color: "var(--danger)" }]} />
            <ul className="flex flex-col gap-4">
              {stats.cultures.map((culture) => {
                const total = culture.funny + culture.not_funny;
                const segments: Segment[] = [
                  { key: "funny", label: t.stillFunny, value: culture.funny, color: "var(--success)" },
                  { key: "not", label: t.notFunny, value: culture.not_funny, color: "var(--danger)" },
                ];
                return (
                  <li key={culture.audience} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <CultureLabel audience={culture.audience} />
                      <span className="flex items-center gap-3 tabular-nums">
                        {total > 0 ? (
                          <>
                            <RatingCounts funny={culture.funny} notFunny={culture.not_funny} />
                            <span className="font-medium">{share(culture.funny, total)}</span>
                          </>
                        ) : <span className="text-muted">{t.noVotes}</span>}
                      </span>
                    </div>
                    <StackedBar segments={segments} describe={(segment, part) => t.segment(segment.label, format.number(segment.value), format.percent(part))} />
                  </li>
                );
              })}
            </ul>
          </Card.Content>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Card>
          <Card.Header>
            <Card.Title>{t.mechanisms}</Card.Title>
            <Card.Description>{t.mechanismsHint(format.number(stats.mechanisms.jokes))}</Card.Description>
          </Card.Header>
          <Card.Content>
            <BarRows max={stats.mechanisms.jokes} rows={stats.mechanisms.items.map((item) => ({
              key: item.id,
              label: t.mechanismNames[item.id],
              value: item.jokes,
              display: `${format.number(item.jokes)} · ${share(item.jokes, stats.mechanisms.jokes)}`,
              color: "var(--accent)",
            }))} />
          </Card.Content>
        </Card>

        <Card>
          <Card.Header>
            <Card.Title>{t.stretch}</Card.Title>
            <Card.Description>{t.stretchHint}</Card.Description>
          </Card.Header>
          <Card.Content className="flex flex-col gap-4">
            <BarRows reference={{ value: 1, label: t.sameLength }} rows={stats.stretch.map((row) => ({
              key: `${row.source_language}-${row.audience}`,
              label: (
                <span className="inline-flex items-center gap-1.5">
                  {audienceNames[locale][row.source_language]} → <CultureLabel audience={row.audience} />
                </span>
              ),
              value: row.ratio,
              display: format.ratio(row.ratio),
              color: cultureColor[row.audience],
              detail: t.versionsCount(format.number(row.versions)),
            }))} />
            <Typography.Paragraph size="xs" color="muted">{t.sameLength}</Typography.Paragraph>
          </Card.Content>
        </Card>

        <Card className="lg:col-span-2 xl:col-span-1">
          <Card.Header>
            <Card.Title>{t.rewrites}</Card.Title>
            <Card.Description>{t.rewritesHint}</Card.Description>
          </Card.Header>
          <Card.Content className="flex flex-col gap-4">
            <Legend items={[
              { key: "kept", label: t.kept, color: rewriteColors.kept },
              { key: "adapted", label: t.adapted, color: rewriteColors.adapted },
              { key: "swapped", label: t.swapped, color: rewriteColors.swapped },
            ]} />
            <ul className="flex flex-col gap-3">
              {stats.rewrites.map((row) => {
                const total = row.kept + row.adapted + row.swapped;
                return (
                  <li key={row.audience} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <CultureLabel audience={row.audience} />
                      <span className="text-muted tabular-nums">{t.swappedShare(share(row.swapped, total), format.number(total))}</span>
                    </div>
                    <StackedBar describe={(segment, part) => t.segment(segment.label, format.number(segment.value), format.percent(part))} segments={[
                      { key: "kept", label: t.kept, value: row.kept, color: rewriteColors.kept },
                      { key: "adapted", label: t.adapted, value: row.adapted, color: rewriteColors.adapted },
                      { key: "swapped", label: t.swapped, value: row.swapped, color: rewriteColors.swapped },
                    ]} />
                  </li>
                );
              })}
            </ul>
          </Card.Content>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <Card.Header className="flex flex-row flex-wrap items-start justify-between gap-3">
            <Card.Title>{t.board}</Card.Title>
            <NextLink href="/admin/media" className={buttonVariants({ variant: "tertiary", size: "sm" })}>{t.manageMedia}</NextLink>
          </Card.Header>
          <Card.Content>
            <Tabs>
              <Tabs.ListContainer>
                <Tabs.List aria-label={t.board}>
                  <Tabs.Tab id="favorites">{t.favorites}<Tabs.Indicator /></Tabs.Tab>
                  <Tabs.Tab id="lost">{t.lost}<Tabs.Indicator /></Tabs.Tab>
                </Tabs.List>
              </Tabs.ListContainer>
              <Tabs.Panel id="favorites"><Board items={stats.favorites} empty={t.favoritesEmpty} /></Tabs.Panel>
              <Tabs.Panel id="lost"><Board items={stats.lost} empty={t.lostEmpty} /></Tabs.Panel>
            </Tabs>
          </Card.Content>
        </Card>

        <Card className="xl:col-span-2">
          <Card.Header>
            <Card.Title>{t.collection}</Card.Title>
            <Card.Description>{t.collectionHint}</Card.Description>
          </Card.Header>
          <Card.Content className="flex flex-col gap-5">
            <BarRows max={totals.jokes} rows={stats.origins.map((row) => ({
              key: `${row.origin}-${row.source_label ?? ""}`,
              label: row.origin === "import" ? sourceName(row.source_label ?? "", locale) : t.originNames[row.origin],
              value: row.jokes,
              display: `${format.number(row.jokes)} · ${share(row.jokes, totals.jokes)}`,
              color: "var(--accent)",
            }))} />
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div className="flex flex-col">
                <dt className="text-xs text-muted">{t.languages}</dt>
                <dd>{stats.source_languages.map((row) => `${audienceNames[locale][row.language]} ${format.number(row.jokes)}`).join(" · ")}</dd>
              </div>
              <div className="flex flex-col">
                <dt className="text-xs text-muted">{t.adultJokes}</dt>
                <dd>{format.number(totals.adult_jokes)} · {share(totals.adult_jokes, totals.jokes)}</dd>
              </div>
              <div className="flex flex-col">
                <dt className="text-xs text-muted">{t.explanations}</dt>
                <dd>{t.ofTotal(format.number(totals.accepted_explanations), format.number(totals.explanations))}</dd>
              </div>
              <div className="flex flex-col">
                <dt className="text-xs text-muted">{t.editedVersions}</dt>
                <dd>{t.ofTotal(format.number(totals.edited_versions), format.number(totals.versions))}</dd>
              </div>
            </dl>
          </Card.Content>
        </Card>
      </div>
    </div>
  );
}

// An ordinal ramp of the brand accent, from barely changed to rebuilt.
const rewriteColors = {
  kept: "color-mix(in oklab, var(--accent) 30%, var(--surface))",
  adapted: "color-mix(in oklab, var(--accent) 62%, var(--surface))",
  swapped: "var(--accent)",
};

function Board({ items, empty }: { items: RatedVersion[]; empty: string }) {
  const locale = useLocale();
  const t = messages[locale];
  if (items.length === 0) return <Typography.Paragraph size="sm" color="muted" className="py-6">{empty}</Typography.Paragraph>;
  return (
    <ol className="flex flex-col divide-y divide-separator">
      {items.map((item) => (
        <li key={item.id} className="flex flex-col gap-1 py-3">
          <div className="flex items-center justify-between gap-3 text-sm">
            <CultureLabel audience={item.audience} />
            <RatingCounts funny={item.funny} notFunny={item.not_funny} />
          </div>
          <Typography.Paragraph size="sm" lang={htmlLang[item.audience]} className="line-clamp-2">{item.body}</Typography.Paragraph>
          <Typography.Paragraph size="xs" color="muted" lang={htmlLang[item.source_language]} className="line-clamp-1">
            {t.original}: {item.joke_body}
          </Typography.Paragraph>
        </li>
      ))}
    </ol>
  );
}
