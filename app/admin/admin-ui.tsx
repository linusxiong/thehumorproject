"use client";

import { ArrowDown, ArrowUp } from "@gravity-ui/icons";
import { Card, Chip, EmptyState, ListBox, Pagination, Select, Typography } from "@heroui/react";
import { useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import type { AudienceId } from "@/lib/jokes";
import { audienceNames, htmlLang, useLocale, type Messages } from "../locale";
import { LaughIcon, MehIcon } from "../rating-icons";

// Shared building blocks for the admin pages: formatting, culture labels, stat tiles, and table pagination.

// One chart color per culture (see app/globals.css); always shown next to the culture's name.
export const cultureColor: Record<AudienceId, string> = { en: "var(--chart-en)", es: "var(--chart-es)", zh: "var(--chart-zh)" };

const en = {
  previousPeriod: "vs. previous period",
  newInPeriod: "No earlier activity to compare",
  pageSummary: (start: number, end: number, total: number) => `${start}–${end} of ${total}`,
  previous: "Prev",
  next: "Next",
  noResults: "Nothing matches these filters.",
  account: (id: string) => `Account ${id}`,
  justNow: "just now",
  stillFunny: "Still funny",
  notFunny: "Not funny",
};

const messages: Messages<typeof en> = {
  en,
  es: {
    previousPeriod: "vs. periodo anterior",
    newInPeriod: "Sin actividad previa para comparar",
    pageSummary: (start, end, total) => `${start}–${end} de ${total}`,
    previous: "Anterior",
    next: "Siguiente",
    noResults: "Nada coincide con estos filtros.",
    account: (id) => `Cuenta ${id}`,
    justNow: "ahora mismo",
    stillFunny: "Sigue siendo gracioso",
    notFunny: "No es gracioso",
  },
  zh: {
    previousPeriod: "与上一周期相比",
    newInPeriod: "上一周期没有可比较的数据",
    pageSummary: (start, end, total) => `第 ${start}–${end} 条，共 ${total} 条`,
    previous: "上一页",
    next: "下一页",
    noResults: "没有符合筛选条件的结果。",
    account: (id) => `账户 ${id}`,
    justNow: "刚刚",
    stillFunny: "依然好笑",
    notFunny: "不好笑",
  },
};

export const useAdminMessages = () => messages[useLocale()];

const relativeUnits: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31_536_000_000], ["month", 2_592_000_000], ["week", 604_800_000], ["day", 86_400_000], ["hour", 3_600_000], ["minute", 60_000],
];

const noSubscription = () => () => {};

// False during server rendering and hydration, true afterwards: local times and greetings depend on the viewer's clock.
export const useHydrated = () => useSyncExternalStore(noSubscription, () => true, () => false);

// Number and date formatting in the interface language. Dates use the viewer's time zone.
export function useFormat() {
  const locale = useLocale();
  return useMemo(() => {
    const lang = htmlLang[locale];
    const number = new Intl.NumberFormat(lang);
    const compact = new Intl.NumberFormat(lang, { notation: "compact", maximumFractionDigits: 1 });
    const percent = new Intl.NumberFormat(lang, { style: "percent", maximumFractionDigits: 0 });
    const ratio = new Intl.NumberFormat(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const date = new Intl.DateTimeFormat(lang, { dateStyle: "medium" });
    const dateTime = new Intl.DateTimeFormat(lang, { dateStyle: "medium", timeStyle: "short" });
    const day = new Intl.DateTimeFormat(lang, { month: "short", day: "numeric", timeZone: "UTC" });
    const relative = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });
    return {
      locale,
      number: (value: number) => number.format(value),
      compact: (value: number) => (Math.abs(value) < 10_000 ? number.format(value) : compact.format(value)),
      percent: (value: number) => percent.format(value),
      ratio: (value: number) => `${ratio.format(value)}×`,
      date: (iso: string) => date.format(new Date(iso)),
      dateTime: (iso: string) => dateTime.format(new Date(iso)),
      // Dashboard days are UTC calendar days.
      day: (iso: string) => day.format(new Date(iso)),
      ago: (iso: string, justNow: string) => {
        const elapsed = new Date(iso).getTime() - Date.now();
        for (const [unit, size] of relativeUnits) {
          if (Math.abs(elapsed) >= size) return relative.format(Math.round(elapsed / size), unit);
        }
        return justNow;
      },
    };
  }, [locale]);
}

export function TimeText({ iso, relative = false }: { iso: string | null; relative?: boolean }) {
  const format = useFormat();
  const t = useAdminMessages();
  const hydrated = useHydrated();
  if (!iso) return <span className="text-muted">—</span>;
  return (
    <time dateTime={iso} title={hydrated ? format.dateTime(iso) : undefined}>
      {hydrated ? (relative ? format.ago(iso, t.justNow) : format.date(iso)) : iso.slice(0, 10)}
    </time>
  );
}

// A culture's color dot and name; color is never the only cue.
export function CultureLabel({ audience, className }: { audience: AudienceId; className?: string }) {
  const locale = useLocale();
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap ${className ?? ""}`}>
      <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: cultureColor[audience] }} />
      {audienceNames[locale][audience]}
    </span>
  );
}

export const shortId = (digest: string) => digest.slice(0, 8);

// English and Spanish counts: "1 rating", "2 ratings". Counts arrive already formatted.
export const plural = (count: string, one: string, other: string) => `${count} ${count === "1" ? one : other}`;

// "Still funny" and "Not funny" totals with the same face icons readers see on the site.
export function RatingCounts({ funny, notFunny }: { funny: number; notFunny: number }) {
  const t = useAdminMessages();
  const format = useFormat();
  return (
    <span className="inline-flex items-center gap-3 whitespace-nowrap tabular-nums">
      <span className="inline-flex items-center gap-1"><LaughIcon className="size-4" /><span className="sr-only">{t.stillFunny}</span>{format.number(funny)}</span>
      <span className="inline-flex items-center gap-1"><MehIcon className="size-4" /><span className="sr-only">{t.notFunny}</span>{format.number(notFunny)}</span>
    </span>
  );
}

export function PageHeading({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-1">
        <Typography.Heading level={1} className="text-2xl">{title}</Typography.Heading>
        {description && <Typography.Paragraph size="sm" color="muted">{description}</Typography.Paragraph>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

// Signed change against the previous period; up is good for every metric on the dashboard.
export function TrendChip({ current, previous }: { current: number; previous: number }) {
  const format = useFormat();
  const t = useAdminMessages();
  if (previous === 0) {
    return current > 0 ? <Chip size="sm" variant="soft" color="success" aria-label={t.newInPeriod}><ArrowUp aria-hidden className="size-3" />{format.number(current)}</Chip> : null;
  }
  const change = (current - previous) / previous;
  const Icon = change >= 0 ? ArrowUp : ArrowDown;
  return (
    <Chip size="sm" variant="soft" color={change > 0 ? "success" : change < 0 ? "danger" : "default"} aria-label={`${format.percent(change)} ${t.previousPeriod}`}>
      <Icon aria-hidden className="size-3" />
      {format.percent(Math.abs(change))}
    </Chip>
  );
}

// A KPI tile: label, a large proportional figure, an optional delta, a caption, and an optional sparkline.
export function StatTile({ label, value, trend, caption, chart }: { label: string; value: string; trend?: ReactNode; caption?: ReactNode; chart?: ReactNode }) {
  return (
    <Card className="gap-3">
      <Card.Header>
        <Card.Description>{label}</Card.Description>
      </Card.Header>
      <Card.Content className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-2xl font-semibold">{value}</span>
          {trend}
        </div>
        {caption && <Typography.Paragraph size="xs" color="muted">{caption}</Typography.Paragraph>}
      </Card.Content>
      {chart}
    </Card>
  );
}

export function NoResults({ children }: { children?: ReactNode }) {
  const t = useAdminMessages();
  return (
    <EmptyState className="flex h-full w-full flex-col items-center justify-center gap-2 py-10 text-center">
      <Typography.Paragraph size="sm" color="muted">{children ?? t.noResults}</Typography.Paragraph>
    </EmptyState>
  );
}

export const pageSize = 10;

// Client-side paging for tables whose rows are already loaded; resets to page 1 whenever the filtered rows change.
export function usePaged<T>(items: T[]) {
  const [state, setState] = useState({ items, page: 1 });
  const page = state.items === items ? state.page : 1;
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(page, pages);
  return {
    page: current,
    pages,
    total: items.length,
    rows: items.slice((current - 1) * pageSize, current * pageSize),
    setPage: (next: number) => setState({ items, page: Math.min(Math.max(1, next), pages) }),
  };
}

// Page links around the current page, with gaps marked by null.
function pageList(page: number, pages: number) {
  const wanted = new Set([1, pages, page - 1, page, page + 1].filter((value) => value >= 1 && value <= pages));
  const sorted = [...wanted].sort((a, b) => a - b);
  return sorted.flatMap((value, index) => (index > 0 && value - sorted[index - 1] > 1 ? [null, value] : [value]));
}

export function TablePager({ paged }: { paged: ReturnType<typeof usePaged<unknown>> }) {
  const t = useAdminMessages();
  const format = useFormat();
  if (paged.total === 0) return null;
  const start = (paged.page - 1) * pageSize + 1;
  const end = Math.min(paged.page * pageSize, paged.total);
  return (
    <Pagination size="sm">
      <Pagination.Summary>{t.pageSummary(start, end, paged.total)}</Pagination.Summary>
      <Pagination.Content>
        <Pagination.Item>
          <Pagination.Previous isDisabled={paged.page === 1} onPress={() => paged.setPage(paged.page - 1)}>
            <Pagination.PreviousIcon />
            {t.previous}
          </Pagination.Previous>
        </Pagination.Item>
        {pageList(paged.page, paged.pages).map((value, index) => (
          <Pagination.Item key={value ?? `gap-${index}`}>
            {value === null
              ? <Pagination.Ellipsis />
              : <Pagination.Link isActive={value === paged.page} onPress={() => paged.setPage(value)}>{format.number(value)}</Pagination.Link>}
          </Pagination.Item>
        ))}
        <Pagination.Item>
          <Pagination.Next isDisabled={paged.page === paged.pages} onPress={() => paged.setPage(paged.page + 1)}>
            {t.next}
            <Pagination.NextIcon />
          </Pagination.Next>
        </Pagination.Item>
      </Pagination.Content>
    </Pagination>
  );
}

// A compact select for table filters; clearing it falls back to "all".
export function FilterSelect({ label, value, options, onChange, className = "w-44" }: {
  label: string; value: string; options: { id: string; label: string }[]; onChange: (value: string) => void; className?: string;
}) {
  return (
    <Select aria-label={label} className={className} value={value} onChange={(next) => onChange(next == null ? "all" : String(next))}>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {options.map((option) => (
            <ListBox.Item key={option.id} id={option.id} textValue={option.label}>
              {option.label}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
