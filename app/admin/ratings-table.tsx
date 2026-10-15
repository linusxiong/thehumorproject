"use client";

import { Chip, ListBox, SearchField, Select, Table, type SortDescriptor } from "@heroui/react";
import { useMemo, useState } from "react";
import type { AdminRating } from "@/lib/admin-types";
import { audiences, isAudienceId, type AudienceId } from "@/lib/jokes";
import { audienceNames, htmlLang, useLocale, type Messages } from "../locale";
import { LaughIcon, MehIcon } from "../rating-icons";
import { CultureLabel, NoResults, PageHeading, plural, shortId, StatTile, TablePager, TimeText, useAdminMessages, useFormat, useHydrated, usePaged } from "./admin-ui";

type Answer = "all" | "funny" | "not";

const en = {
  title: "Ratings",
  description: "Readers' “Still funny?” answers on each AI version, newest first (up to 1,000). Read-only.",
  ratings: "Ratings",
  stillFunny: "Still funny",
  notFunny: "Not funny",
  raters: "Raters",
  ratingsCaption: (versions: string) => `Across ${plural(versions, "version", "versions")}`,
  funnyCaption: (count: string) => plural(count, "answer", "answers"),
  notFunnyCaption: (share: string) => `${share} of all answers`,
  ratersCaption: (average: string) => `${plural(average, "rating", "ratings")} per rater`,
  search: "Search ratings",
  searchPlaceholder: "Rater, version, or joke",
  answer: "Answer",
  answers: { all: "All answers", funny: "Still funny", not: "Not funny" } as Record<Answer, string>,
  culture: "Culture",
  allCultures: "All cultures",
  table: "Ratings",
  rated: "Rated",
  rater: "Rater",
  version: "Version",
  original: "Original joke",
  changed: "Changed answer",
};

const messages: Messages<typeof en> = {
  en,
  es: {
    title: "Calificaciones",
    description: "Respuestas de los lectores a «¿Sigue siendo gracioso?» en cada versión de IA, de la más reciente a la más antigua (hasta 1000). Solo lectura.",
    ratings: "Calificaciones",
    stillFunny: "Sigue siendo gracioso",
    notFunny: "No es gracioso",
    raters: "Evaluadores",
    ratingsCaption: (versions) => `En ${plural(versions, "versión", "versiones")}`,
    funnyCaption: (count) => plural(count, "respuesta", "respuestas"),
    notFunnyCaption: (share) => `${share} de todas las respuestas`,
    ratersCaption: (average) => `${plural(average, "calificación", "calificaciones")} por evaluador`,
    search: "Buscar calificaciones",
    searchPlaceholder: "Evaluador, versión o chiste",
    answer: "Respuesta",
    answers: { all: "Todas las respuestas", funny: "Sigue siendo gracioso", not: "No es gracioso" },
    culture: "Cultura",
    allCultures: "Todas las culturas",
    table: "Calificaciones",
    rated: "Fecha",
    rater: "Evaluador",
    version: "Versión",
    original: "Chiste original",
    changed: "Respuesta cambiada",
  },
  zh: {
    title: "评价",
    description: "读者对每个 AI 版本“依然好笑？”的回答，按时间倒序（最多 1000 条）。仅可查看。",
    ratings: "评价",
    stillFunny: "依然好笑",
    notFunny: "不好笑",
    raters: "评价者",
    ratingsCaption: (versions) => `涉及 ${versions} 个版本`,
    funnyCaption: (count) => `${count} 条回答`,
    notFunnyCaption: (share) => `占全部回答的 ${share}`,
    ratersCaption: (average) => `人均 ${average} 条评价`,
    search: "搜索评价",
    searchPlaceholder: "评价者、版本或笑话",
    answer: "回答",
    answers: { all: "全部回答", funny: "依然好笑", not: "不好笑" },
    culture: "文化",
    allCultures: "全部文化",
    table: "评价",
    rated: "评价时间",
    rater: "评价者",
    version: "版本",
    original: "原文",
    changed: "改过答案",
  },
};

// A rating counts as changed when it was updated well after it was first given.
const changed = (rating: AdminRating) => Math.abs(new Date(rating.updated_at).getTime() - new Date(rating.created_at).getTime()) > 5_000;

export function RatingsTable({ ratings }: { ratings: AdminRating[] }) {
  const locale = useLocale();
  const t = messages[locale];
  const shared = useAdminMessages();
  const format = useFormat();
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState<Answer>("all");
  const [culture, setCulture] = useState<AudienceId | "all">("all");
  const [sort, setSort] = useState<SortDescriptor>({ column: "created_at", direction: "descending" });
  // React Aria renders aria-sort differently on the server; sorting only works after hydration anyway.
  const hydrated = useHydrated();

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = ratings.filter((rating) => (answer === "all" || rating.funny === (answer === "funny"))
      && (culture === "all" || rating.audience === culture)
      && (!needle || [rating.rater_name, rating.rater_email, rating.user_id, rating.version, rating.joke].some((value) => value?.toLowerCase().includes(needle))));
    return sort.direction === "ascending" ? filtered.reverse() : filtered;
  }, [ratings, query, answer, culture, sort]);
  const paged = usePaged(rows);

  const funny = ratings.filter((rating) => rating.funny).length;
  const raters = new Set(ratings.map((rating) => rating.user_id)).size;
  const versions = new Set(ratings.map((rating) => rating.adaptation_id)).size;
  const share = (count: number) => format.percent(ratings.length > 0 ? count / ratings.length : 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeading title={t.title} description={t.description} />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label={t.ratings} value={format.number(ratings.length)} caption={t.ratingsCaption(format.number(versions))} />
        <StatTile label={t.stillFunny} value={share(funny)} caption={t.funnyCaption(format.number(funny))} />
        <StatTile label={t.notFunny} value={format.number(ratings.length - funny)} caption={t.notFunnyCaption(share(ratings.length - funny))} />
        <StatTile label={t.raters} value={format.number(raters)}
          caption={t.ratersCaption(format.number(raters > 0 ? Math.round((ratings.length / raters) * 10) / 10 : 0))} />
      </section>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchField aria-label={t.search} value={query} onChange={setQuery} className="lg:w-80">
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder={t.searchPlaceholder} />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>
        <div className="flex flex-wrap gap-3">
          <Select aria-label={t.answer} className="w-48" value={answer} onChange={(value) => setAnswer((value as Answer) ?? "all")}>
            <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
            <Select.Popover>
              <ListBox>
                {(Object.keys(t.answers) as Answer[]).map((option) => (
                  <ListBox.Item key={option} id={option} textValue={t.answers[option]}>{t.answers[option]}<ListBox.ItemIndicator /></ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
          <Select aria-label={t.culture} className="w-44" value={culture} onChange={(value) => setCulture(isAudienceId(value) ? value : "all")}>
            <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
            <Select.Popover>
              <ListBox>
                <ListBox.Item id="all" textValue={t.allCultures}>{t.allCultures}<ListBox.ItemIndicator /></ListBox.Item>
                {audiences.map(({ id }) => (
                  <ListBox.Item key={id} id={id} textValue={audienceNames[locale][id]}>{audienceNames[locale][id]}<ListBox.ItemIndicator /></ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        </div>
      </div>

      <Table>
        <Table.ScrollContainer>
          <Table.Content aria-label={t.table} className="min-w-[900px]" sortDescriptor={sort} onSortChange={setSort}>
            <Table.Header>
              <Table.Column id="created_at" allowsSorting={hydrated}>
                {({ sortDirection }) => <Table.SortableColumnHeader sortDirection={sortDirection}>{t.rated}</Table.SortableColumnHeader>}
              </Table.Column>
              <Table.Column isRowHeader>{t.rater}</Table.Column>
              <Table.Column>{t.answer}</Table.Column>
              <Table.Column className="min-w-80">{t.version}</Table.Column>
              <Table.Column className="min-w-64">{t.original}</Table.Column>
            </Table.Header>
            <Table.Body items={paged.rows} renderEmptyState={() => <NoResults />}>
              {(rating) => (
                <Table.Row id={`${rating.adaptation_id}-${rating.user_id}`}>
                  <Table.Cell className="whitespace-nowrap"><TimeText iso={rating.created_at} relative /></Table.Cell>
                  <Table.Cell>
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-medium">{rating.rater_name ?? shared.account(shortId(rating.user_id))}</span>
                      {rating.rater_email && <span className="truncate text-xs text-muted">{rating.rater_email}</span>}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex flex-col items-start gap-1">
                      <Chip size="sm" variant="soft" color={rating.funny ? "success" : "danger"}>
                        {rating.funny ? <LaughIcon className="size-3.5" /> : <MehIcon className="size-3.5" />}
                        {rating.funny ? t.stillFunny : t.notFunny}
                      </Chip>
                      {changed(rating) && <span className="text-xs text-muted">{t.changed}</span>}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex max-w-md flex-col gap-1">
                      <CultureLabel audience={rating.audience} className="text-xs" />
                      <span lang={htmlLang[rating.audience]} className="line-clamp-2 text-sm">{rating.version}</span>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <span lang={htmlLang[rating.source_language]} className="line-clamp-2 max-w-xs text-xs text-muted">{rating.joke}</span>
                  </Table.Cell>
                </Table.Row>
              )}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
        <Table.Footer>
          <TablePager paged={paged} />
        </Table.Footer>
      </Table>
    </div>
  );
}
