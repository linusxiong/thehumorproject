"use client";

import { Eye, Pencil, Sparkles, TrashBin } from "@gravity-ui/icons";
import { Alert, AlertDialog, Button, Chip, Description, FieldError, Form, Label, ListBox, Modal, SearchField, Select, Spinner, Table, Tabs, TextArea, TextField, Typography, toast, type SortDescriptor } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { mediaLimits, type MediaItem } from "@/lib/admin-types";
import { audiences, explanationLength, isAudienceId, jokeLength, localized, type AudienceId, type JokeOrigin } from "@/lib/jokes";
import { sourceName } from "../cultures";
import { audienceNames, htmlLang, useLocale, type Messages } from "../locale";
import { CultureLabel, NoResults, PageHeading, plural, RatingCounts, TablePager, TimeText, useFormat, useHydrated, usePaged } from "./admin-ui";

type OriginFilter = "all" | JokeOrigin;
type Draft = { body: string; gloss: Record<AudienceId, string>; punchline_core: Record<AudienceId, string>; notes: Record<AudienceId, string> };

const en = {
  title: "AI media",
  description: "Every version the AI wrote for each joke. Generate new ones, correct them, or remove them.",
  generate: "Generate with AI",
  search: "Search versions",
  searchPlaceholder: "Version text, original joke, or ID",
  culture: "Culture",
  allCultures: "All cultures",
  origin: "Origin",
  origins: { all: "All origins", member: "Members", import: sourceName("Qiushibaike", "en"), demo: "Demo" } as Record<OriginFilter, string>,
  count: (count: string) => plural(count, "version", "versions"),
  table: "AI-generated versions",
  id: "ID",
  version: "Version",
  original: "Original joke",
  ratings: "Ratings",
  created: "Created",
  actions: "Actions",
  edited: "Edited",
  adult: "18+",
  view: (id: number) => `View version #${id}`,
  edit: (id: number) => `Edit version #${id}`,
  remove: (id: number) => `Delete version #${id}`,
  close: "Close",
  cancel: "Cancel",
  versionOf: (id: number, culture: string) => `Version #${id} · ${culture}`,
  gloss: "Translation for readers",
  punchlineCore: "Core punchline",
  notes: "Adaptation notes",
  explanation: "Accepted explanation",
  explanationFrom: { author: "From the author", community: "Added by a community member" },
  by: (name: string) => `Shared by ${name}`,
  updated: "Last edited",
  editTitle: (id: number) => `Edit version #${id}`,
  body: "Version text",
  bodyHint: "Shown to readers of this culture as written.",
  commentary: "Commentary language",
  sameAsBody: "In the version's own language, the translation is the version text itself.",
  optionalLanguage: "Leave a language empty to fall back to English.",
  required: "Required.",
  tooLong: (max: number) => `Use at most ${max} characters.`,
  save: "Save changes",
  saving: "Saving…",
  saved: "Version saved.",
  deleteTitle: (id: number) => `Delete version #${id}?`,
  deleteBody: (culture: string, ratings: string) => `The ${culture} version and its ${plural(ratings, "rating", "ratings")} will be removed for good. The original joke and its other versions stay.`,
  delete: "Delete",
  deleted: "Version deleted.",
  createTitle: "Generate AI media",
  createIntro: "The AI adapts the joke for English-, Spanish-, and Chinese-speaking readers in one request, usually within 15–30 seconds. It is published on the site as a member joke from your account.",
  joke: "Joke",
  jokePlaceholder: "Paste a joke in English, Spanish, or Chinese",
  jokeLength: (count: number) => `${count} / ${jokeLength.max} characters`,
  jokeTooShort: `Write at least ${jokeLength.min} characters.`,
  explanationLabel: "Why it's funny (optional)",
  explanationHint: "Give the AI the authoritative reading, such as a hidden pun.",
  explanationTooShort: `Use at least ${explanationLength.min} characters, or leave it empty.`,
  create: "Generate versions",
  creating: "Generating versions…",
  generated: (count: number) => `Generated ${plural(String(count), "version", "versions")}.`,
  failedTitle: "That didn't work",
  errors: {
    400: "Check the fields and try again.",
    401: "Your session has expired. Sign in again.",
    403: "Only superadmins can do this.",
    404: "This version no longer exists. Refresh the list.",
    422: "The AI judged this not to be a self-contained joke in English, Spanish, or Chinese, or the explanation does not fit it.",
    502: "The AI could not adapt this joke right now. Please try again.",
    503: "AI generation is not configured on this server.",
  } as Partial<Record<number, string>>,
  genericError: "Something went wrong. Please try again.",
};

type Text = typeof en;

const messages: Messages<Text> = {
  en,
  es: {
    title: "Contenido IA",
    description: "Todas las versiones que la IA escribió para cada chiste. Genera nuevas, corrígelas o elimínalas.",
    generate: "Generar con IA",
    search: "Buscar versiones",
    searchPlaceholder: "Texto de la versión, chiste original o ID",
    culture: "Cultura",
    allCultures: "Todas las culturas",
    origin: "Origen",
    origins: { all: "Todos los orígenes", member: "Miembros", import: sourceName("Qiushibaike", "es"), demo: "Demo" },
    count: (count) => plural(count, "versión", "versiones"),
    table: "Versiones generadas por IA",
    id: "ID",
    version: "Versión",
    original: "Chiste original",
    ratings: "Calificaciones",
    created: "Creada",
    actions: "Acciones",
    edited: "Editada",
    adult: "+18",
    view: (id) => `Ver la versión #${id}`,
    edit: (id) => `Editar la versión #${id}`,
    remove: (id) => `Eliminar la versión #${id}`,
    close: "Cerrar",
    cancel: "Cancelar",
    versionOf: (id, culture) => `Versión #${id} · ${culture}`,
    gloss: "Traducción para lectores",
    punchlineCore: "Clave del remate",
    notes: "Notas de adaptación",
    explanation: "Explicación aceptada",
    explanationFrom: { author: "Del autor", community: "Añadida por un miembro de la comunidad" },
    by: (name) => `Compartido por ${name}`,
    updated: "Última edición",
    editTitle: (id) => `Editar la versión #${id}`,
    body: "Texto de la versión",
    bodyHint: "Se muestra tal cual a los lectores de esta cultura.",
    commentary: "Idioma del comentario",
    sameAsBody: "En el idioma propio de la versión, la traducción es el propio texto de la versión.",
    optionalLanguage: "Deja un idioma vacío para usar el inglés.",
    required: "Obligatorio.",
    tooLong: (max) => `Usa como máximo ${max} caracteres.`,
    save: "Guardar cambios",
    saving: "Guardando…",
    saved: "Versión guardada.",
    deleteTitle: (id) => `¿Eliminar la versión #${id}?`,
    deleteBody: (culture, ratings) => `La versión en ${culture.toLocaleLowerCase("es")} y ${ratings === "1" ? "su calificación" : `sus ${ratings} calificaciones`} se eliminarán definitivamente. El chiste original y sus otras versiones se conservan.`,
    delete: "Eliminar",
    deleted: "Versión eliminada.",
    createTitle: "Generar contenido IA",
    createIntro: "La IA adapta el chiste para lectores de habla inglesa, hispana y china en una sola solicitud, normalmente en 15–30 segundos. Se publica en el sitio como chiste de miembro desde tu cuenta.",
    joke: "Chiste",
    jokePlaceholder: "Pega un chiste en inglés, español o chino",
    jokeLength: (count) => `${count} / ${jokeLength.max} caracteres`,
    jokeTooShort: `Escribe al menos ${jokeLength.min} caracteres.`,
    explanationLabel: "Por qué es gracioso (opcional)",
    explanationHint: "Dale a la IA la lectura correcta, como un juego de palabras oculto.",
    explanationTooShort: `Usa al menos ${explanationLength.min} caracteres o déjalo vacío.`,
    create: "Generar versiones",
    creating: "Generando versiones…",
    generated: (count) => (count === 1 ? "Se generó 1 versión." : `Se generaron ${count} versiones.`),
    failedTitle: "No funcionó",
    errors: {
      400: "Revisa los campos e inténtalo de nuevo.",
      401: "Tu sesión expiró. Vuelve a iniciar sesión.",
      403: "Solo los superadministradores pueden hacer esto.",
      404: "Esta versión ya no existe. Actualiza la lista.",
      422: "La IA consideró que no es un chiste completo en inglés, español o chino, o que la explicación no encaja.",
      502: "La IA no pudo adaptar este chiste ahora. Inténtalo de nuevo.",
      503: "La generación con IA no está configurada en este servidor.",
    },
    genericError: "Algo salió mal. Inténtalo de nuevo.",
  },
  zh: {
    title: "AI 内容",
    description: "AI 为每个笑话撰写的所有版本。可以用 AI 生成新内容，也可以修改或删除。",
    generate: "用 AI 生成",
    search: "搜索版本",
    searchPlaceholder: "版本文本、原文或 ID",
    culture: "文化",
    allCultures: "全部文化",
    origin: "来源",
    origins: { all: "全部来源", member: "会员", import: sourceName("Qiushibaike", "zh"), demo: "示例" },
    count: (count) => `${count} 个版本`,
    table: "AI 生成的版本",
    id: "ID",
    version: "版本",
    original: "原文",
    ratings: "评价",
    created: "创建时间",
    actions: "操作",
    edited: "已编辑",
    adult: "18+",
    view: (id) => `查看版本 #${id}`,
    edit: (id) => `编辑版本 #${id}`,
    remove: (id) => `删除版本 #${id}`,
    close: "关闭",
    cancel: "取消",
    versionOf: (id, culture) => `版本 #${id} · ${culture}`,
    gloss: "给读者的译文",
    punchlineCore: "核心笑点",
    notes: "改编说明",
    explanation: "已采纳的解释",
    explanationFrom: { author: "作者说明", community: "社区用户补充" },
    by: (name) => `由 ${name} 分享`,
    updated: "最近编辑",
    editTitle: (id) => `编辑版本 #${id}`,
    body: "版本文本",
    bodyHint: "按原样展示给该文化的读者。",
    commentary: "说明语言",
    sameAsBody: "在版本本身的语言中，译文就是版本文本。",
    optionalLanguage: "某种语言留空时将显示英文。",
    required: "必填。",
    tooLong: (max) => `最多 ${max} 个字符。`,
    save: "保存修改",
    saving: "正在保存…",
    saved: "版本已保存。",
    deleteTitle: (id) => `删除版本 #${id}？`,
    deleteBody: (culture, ratings) => `该${culture}版本及其 ${ratings} 条评价将被永久删除。原文和其他版本会保留。`,
    delete: "删除",
    deleted: "版本已删除。",
    createTitle: "生成 AI 内容",
    createIntro: "AI 会在一次请求中为英语、西班牙语和中文读者改编这个笑话，通常需要 15–30 秒。生成后会以你的账户作为会员笑话发布到网站上。",
    joke: "笑话",
    jokePlaceholder: "粘贴一个英文、西班牙文或中文笑话",
    jokeLength: (count) => `${count} / ${jokeLength.max} 个字符`,
    jokeTooShort: `至少输入 ${jokeLength.min} 个字符。`,
    explanationLabel: "好笑在哪里（可选）",
    explanationHint: "告诉 AI 正确的理解方式，例如隐藏的谐音。",
    explanationTooShort: `至少 ${explanationLength.min} 个字符，或留空。`,
    create: "生成版本",
    creating: "正在生成版本…",
    generated: (count) => `已生成 ${count} 个版本。`,
    failedTitle: "操作未成功",
    errors: {
      400: "请检查各字段后重试。",
      401: "登录已过期，请重新登录。",
      403: "只有超级管理员可以执行此操作。",
      404: "该版本已不存在，请刷新列表。",
      422: "AI 判断这不是完整的英文、西班牙文或中文笑话，或者解释与笑话不符。",
      502: "AI 暂时无法改编这个笑话，请重试。",
      503: "服务器尚未配置 AI 生成。",
    },
    genericError: "出了点问题，请重试。",
  },
};

const emptyLocalized = (): Record<AudienceId, string> => ({ en: "", es: "", zh: "" });
const toDraft = (item: MediaItem): Draft => ({
  body: item.body,
  gloss: { ...emptyLocalized(), ...item.gloss },
  punchline_core: { ...emptyLocalized(), ...item.punchline_core },
  notes: { ...emptyLocalized(), ...item.notes },
});

class RequestError extends Error {
  constructor(readonly status: number | null) {
    super("Request failed");
  }
}

async function send(url: string, method: string, body?: unknown) {
  const response = await fetch(url, {
    method, headers: body === undefined ? undefined : { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body),
  }).catch(() => null);
  if (!response) throw new RequestError(null);
  if (!response.ok) throw new RequestError(response.status);
  return response.json();
}

type SortKey = "id" | "ratings" | "created_at";

export function MediaManager({ items }: { items: MediaItem[] }) {
  const locale = useLocale();
  const t = messages[locale];
  const format = useFormat();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [culture, setCulture] = useState<AudienceId | "all">("all");
  const [origin, setOrigin] = useState<OriginFilter>("all");
  const [sort, setSort] = useState<SortDescriptor>({ column: "created_at", direction: "descending" });
  const [viewing, setViewing] = useState<MediaItem | null>(null);
  const [editing, setEditing] = useState<MediaItem | null>(null);
  const [deleting, setDeleting] = useState<MediaItem | null>(null);
  const [creating, setCreating] = useState(false);
  // React Aria renders aria-sort differently on the server; sorting only works after hydration anyway.
  const hydrated = useHydrated();

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = items.filter((item) => (culture === "all" || item.audience === culture) && (origin === "all" || item.joke.origin === origin)
      && (!needle || `#${item.id}` === needle || String(item.id) === needle || item.body.toLowerCase().includes(needle) || item.joke.body.toLowerCase().includes(needle)));
    const direction = sort.direction === "descending" ? -1 : 1;
    const key = sort.column as SortKey;
    const value = (item: MediaItem) => (key === "ratings" ? item.funny + item.not_funny : key === "id" ? item.id : 0);
    return filtered.sort((a, b) => direction * (key === "created_at" ? a.created_at.localeCompare(b.created_at) || a.id - b.id : value(a) - value(b)));
  }, [items, query, culture, origin, sort]);
  const paged = usePaged(rows);

  const sortable = (id: SortKey, label: string, isRowHeader = false) => (
    <Table.Column id={id} allowsSorting={hydrated} isRowHeader={isRowHeader}>
      {({ sortDirection }) => <Table.SortableColumnHeader sortDirection={sortDirection}>{label}</Table.SortableColumnHeader>}
    </Table.Column>
  );
  const originLabel = (item: MediaItem) => (item.joke.origin === "import" ? sourceName(item.joke.source_label ?? "", locale) : t.origins[item.joke.origin]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeading title={t.title} description={t.description} actions={(
        <Button onPress={() => setCreating(true)}>
          <Sparkles aria-hidden className="size-4" />
          {t.generate}
        </Button>
      )} />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchField aria-label={t.search} value={query} onChange={setQuery} className="lg:w-80">
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder={t.searchPlaceholder} />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>
        <div className="flex flex-wrap items-center gap-3">
          <FilterSelect label={t.culture} value={culture} onChange={(value) => setCulture(isAudienceId(value) ? value : "all")}
            options={[{ id: "all", label: t.allCultures }, ...audiences.map((audience) => ({ id: audience.id, label: audienceNames[locale][audience.id] }))]} />
          <FilterSelect label={t.origin} value={origin} onChange={(value) => setOrigin((value as OriginFilter) ?? "all")}
            options={(Object.keys(t.origins) as OriginFilter[]).map((id) => ({ id, label: t.origins[id] }))} />
          <Chip size="sm" variant="soft">{t.count(format.number(rows.length))}</Chip>
        </div>
      </div>

      <Table>
        <Table.ScrollContainer>
          <Table.Content aria-label={t.table} className="min-w-[980px]" sortDescriptor={sort} onSortChange={setSort}>
            <Table.Header>
              {sortable("id", t.id, true)}
              <Table.Column className="min-w-80">{t.version}</Table.Column>
              <Table.Column className="min-w-64">{t.original}</Table.Column>
              {sortable("ratings", t.ratings)}
              {sortable("created_at", t.created)}
              <Table.Column className="text-end">{t.actions}</Table.Column>
            </Table.Header>
            <Table.Body items={paged.rows} renderEmptyState={() => <NoResults />}>
              {(item) => (
                <Table.Row id={item.id}>
                  <Table.Cell className="font-medium tabular-nums">#{item.id}</Table.Cell>
                  <Table.Cell>
                    <div className="flex max-w-md flex-col gap-1">
                      <div className="flex items-center gap-2 text-xs">
                        <CultureLabel audience={item.audience} />
                        {item.updated_at && <Chip size="sm" variant="soft" color="accent">{t.edited}</Chip>}
                      </div>
                      <span lang={htmlLang[item.audience]} className="line-clamp-2 text-sm">{item.body}</span>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex max-w-xs flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Chip size="sm" variant="secondary">{originLabel(item)}</Chip>
                        {item.joke.adult && <Chip size="sm" variant="soft" color="danger">{t.adult}</Chip>}
                      </div>
                      <span lang={htmlLang[item.joke.source_language]} className="line-clamp-2 text-xs text-muted">{item.joke.body}</span>
                    </div>
                  </Table.Cell>
                  <Table.Cell><RatingCounts funny={item.funny} notFunny={item.not_funny} /></Table.Cell>
                  <Table.Cell className="whitespace-nowrap"><TimeText iso={item.created_at} /></Table.Cell>
                  <Table.Cell>
                    <div className="flex items-center justify-end gap-1">
                      <Button isIconOnly size="sm" variant="tertiary" aria-label={t.view(item.id)} onPress={() => setViewing(item)}>
                        <Eye aria-hidden className="size-4" />
                      </Button>
                      <Button isIconOnly size="sm" variant="tertiary" aria-label={t.edit(item.id)} onPress={() => setEditing(item)}>
                        <Pencil aria-hidden className="size-4" />
                      </Button>
                      <Button isIconOnly size="sm" variant="danger-soft" aria-label={t.remove(item.id)} onPress={() => setDeleting(item)}>
                        <TrashBin aria-hidden className="size-4" />
                      </Button>
                    </div>
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

      <ViewModal item={viewing} onClose={() => setViewing(null)} originLabel={viewing ? originLabel(viewing) : ""}
        onEdit={() => { setEditing(viewing); setViewing(null); }} />
      {editing && <EditModal key={editing.id} item={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); router.refresh(); }} />}
      <DeleteDialog item={deleting} onClose={() => setDeleting(null)} onDeleted={() => { setDeleting(null); router.refresh(); }} />
      {creating && <CreateModal onClose={() => setCreating(false)} onCreated={() => { setCreating(false); router.refresh(); }} />}
    </div>
  );
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: { id: string; label: string }[]; onChange: (value: string) => void }) {
  return (
    <Select aria-label={label} className="w-44" value={value} onChange={(next) => onChange(next == null ? "all" : String(next))}>
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

function Field({ label, children, lang }: { label: string; children: ReactNode; lang?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs text-muted">{label}</dt>
      <dd lang={lang} className="text-sm whitespace-pre-line">{children}</dd>
    </div>
  );
}

function ViewModal({ item, onClose, onEdit, originLabel }: { item: MediaItem | null; onClose: () => void; onEdit: () => void; originLabel: string }) {
  const locale = useLocale();
  const t = messages[locale];
  return (
    <Modal.Backdrop isOpen={item !== null} onOpenChange={(open) => { if (!open) onClose(); }} isDismissable>
      <Modal.Container size="lg" scroll="inside">
        <Modal.Dialog>
          <Modal.CloseTrigger aria-label={t.close} />
          {item && (
            <>
              <Modal.Header>
                <Modal.Heading>{t.versionOf(item.id, audienceNames[locale][item.audience])}</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <dl className="flex flex-col gap-4">
                  <Field label={t.version} lang={htmlLang[item.audience]}>{item.body}</Field>
                  {item.audience !== locale && <Field label={t.gloss}>{localized(item.gloss, locale)}</Field>}
                  <Field label={t.punchlineCore}>{localized(item.punchline_core, locale)}</Field>
                  <Field label={t.notes}>{localized(item.notes, locale)}</Field>
                  <Field label={t.ratings}><RatingCounts funny={item.funny} notFunny={item.not_funny} /></Field>
                  <div className="flex flex-col gap-2 rounded-xl bg-default p-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Chip size="sm" variant="secondary">{originLabel}</Chip>
                      {item.joke.adult && <Chip size="sm" variant="soft" color="danger">{t.adult}</Chip>}
                      <span className="text-xs text-muted">{t.by(item.joke.author_name)} · <TimeText iso={item.joke.created_at} /></span>
                    </div>
                    <Field label={t.original} lang={htmlLang[item.joke.source_language]}>{item.joke.body}</Field>
                    {item.joke.explanation && item.joke.explanation_source && (
                      <Field label={`${t.explanation} · ${t.explanationFrom[item.joke.explanation_source]}`}>{item.joke.explanation}</Field>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted">
                    <span>{t.created}: <TimeText iso={item.created_at} /></span>
                    {item.updated_at && <span>{t.updated}: <TimeText iso={item.updated_at} /></span>}
                  </div>
                </dl>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="tertiary" slot="close">{t.close}</Button>
                <Button variant="secondary" onPress={onEdit}>
                  <Pencil aria-hidden className="size-4" />
                  {t.editTitle(item.id)}
                </Button>
              </Modal.Footer>
            </>
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

function errorText(t: Text, error: unknown) {
  return (error instanceof RequestError && error.status !== null && t.errors[error.status]) || t.genericError;
}

function Failure({ message }: { message: string | null }) {
  const t = messages[useLocale()];
  if (!message) return null;
  return (
    <Alert status="danger">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{t.failedTitle}</Alert.Title>
        <Alert.Description>{message}</Alert.Description>
      </Alert.Content>
    </Alert>
  );
}

function EditModal({ item, onClose, onSaved }: { item: MediaItem; onClose: () => void; onSaved: () => void }) {
  const locale = useLocale();
  const t = messages[locale];
  const [draft, setDraft] = useState(() => toDraft(item));
  const [tab, setTab] = useState<AudienceId>(locale);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const limit = (value: string, max: number, required: boolean) =>
    (required && !value.trim() ? t.required : value.trim().length > max ? t.tooLong(max) : null);
  const setLocalized = (field: "gloss" | "punchline_core" | "notes", language: AudienceId, value: string) =>
    setDraft((current) => ({ ...current, [field]: { ...current[field], [language]: value } }));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFailure(null);
    try {
      await send(`/api/admin/media/${item.id}`, "PATCH", draft);
      toast.success(t.saved);
      onSaved();
    } catch (error) {
      setFailure(errorText(t, error));
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal.Backdrop isOpen onOpenChange={(open) => { if (!open && !pending) onClose(); }} isDismissable={!pending} isKeyboardDismissDisabled={pending}>
      <Modal.Container size="lg" scroll="inside">
        <Modal.Dialog>
          <Modal.CloseTrigger isDisabled={pending} aria-label={t.close} />
          <Modal.Header>
            <Modal.Heading>{t.editTitle(item.id)}</Modal.Heading>
          </Modal.Header>
          <Form className="flex min-h-0 flex-col" onSubmit={submit}>
            <Modal.Body className="flex flex-col gap-4">
              <CultureLabel audience={item.audience} className="text-sm" />
              <TextField name="body" isRequired value={draft.body} onChange={(body) => setDraft((current) => ({ ...current, body }))}
                isDisabled={pending} validate={(value) => limit(value, mediaLimits.body, true)}>
                <Label>{t.body}</Label>
                <TextArea rows={4} lang={htmlLang[item.audience]} />
                <Description>{t.bodyHint}</Description>
                <FieldError />
              </TextField>
              <Tabs selectedKey={tab} onSelectionChange={(key) => { if (isAudienceId(key)) setTab(key); }}>
                <Tabs.ListContainer>
                  <Tabs.List aria-label={t.commentary}>
                    {audiences.map((audience) => (
                      <Tabs.Tab key={audience.id} id={audience.id}>{audienceNames[locale][audience.id]}<Tabs.Indicator /></Tabs.Tab>
                    ))}
                  </Tabs.List>
                </Tabs.ListContainer>
                {audiences.map(({ id }) => (
                  <Tabs.Panel key={id} id={id} className="flex flex-col gap-4 pt-4">
                    {id === item.audience
                      ? <Typography.Paragraph size="xs" color="muted">{t.sameAsBody}</Typography.Paragraph>
                      : (
                        <TextField name={`gloss-${id}`} value={draft.gloss[id]} onChange={(value) => setLocalized("gloss", id, value)} isDisabled={pending}
                          validate={(value) => limit(value, mediaLimits.gloss, false)}>
                          <Label>{t.gloss}</Label>
                          <TextArea rows={3} lang={htmlLang[id]} />
                          <FieldError />
                        </TextField>
                      )}
                    <TextField name={`punchline-${id}`} isRequired={id === "en"} value={draft.punchline_core[id]} onChange={(value) => setLocalized("punchline_core", id, value)}
                      isDisabled={pending} validate={(value) => limit(value, mediaLimits.punchline_core, id === "en")}>
                      <Label>{t.punchlineCore}</Label>
                      <TextArea rows={2} lang={htmlLang[id]} />
                      <FieldError />
                    </TextField>
                    <TextField name={`notes-${id}`} isRequired={id === "en"} value={draft.notes[id]} onChange={(value) => setLocalized("notes", id, value)}
                      isDisabled={pending} validate={(value) => limit(value, mediaLimits.notes, id === "en")}>
                      <Label>{t.notes}</Label>
                      <TextArea rows={3} lang={htmlLang[id]} />
                      <FieldError />
                    </TextField>
                    {id !== "en" && <Typography.Paragraph size="xs" color="muted">{t.optionalLanguage}</Typography.Paragraph>}
                  </Tabs.Panel>
                ))}
              </Tabs>
              <Failure message={failure} />
            </Modal.Body>
            <Modal.Footer>
              <Button variant="tertiary" isDisabled={pending} onPress={onClose}>{t.cancel}</Button>
              <Button type="submit" isPending={pending}>
                {({ isPending }) => (
                  <>
                    {isPending && <Spinner size="sm" color="current" />}
                    {isPending ? t.saving : t.save}
                  </>
                )}
              </Button>
            </Modal.Footer>
          </Form>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

function DeleteDialog({ item, onClose, onDeleted }: { item: MediaItem | null; onClose: () => void; onDeleted: () => void }) {
  const locale = useLocale();
  const t = messages[locale];
  const format = useFormat();
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function confirm() {
    if (!item) return;
    setPending(true);
    setFailure(null);
    try {
      await send(`/api/admin/media/${item.id}`, "DELETE");
      toast.success(t.deleted);
      onDeleted();
    } catch (error) {
      setFailure(errorText(t, error));
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog.Backdrop isOpen={item !== null} onOpenChange={(open) => { if (!open && !pending) { setFailure(null); onClose(); } }}>
      <AlertDialog.Container size="sm">
        <AlertDialog.Dialog>
          {item && (
            <>
              <AlertDialog.Header>
                <AlertDialog.Icon status="danger" />
                <AlertDialog.Heading>{t.deleteTitle(item.id)}</AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body className="flex flex-col gap-3">
                <Typography.Paragraph size="sm">{t.deleteBody(audienceNames[locale][item.audience], format.number(item.funny + item.not_funny))}</Typography.Paragraph>
                <Typography.Paragraph size="sm" color="muted" lang={htmlLang[item.audience]} className="line-clamp-3">{item.body}</Typography.Paragraph>
                <Failure message={failure} />
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button variant="tertiary" isDisabled={pending} onPress={onClose}>{t.cancel}</Button>
                <Button variant="danger" isPending={pending} onPress={confirm}>
                  {({ isPending }) => (
                    <>
                      {isPending ? <Spinner size="sm" color="current" /> : <TrashBin aria-hidden className="size-4" />}
                      {t.delete}
                    </>
                  )}
                </Button>
              </AlertDialog.Footer>
            </>
          )}
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  );
}

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const locale = useLocale();
  const t = messages[locale];
  const [joke, setJoke] = useState("");
  const [explanation, setExplanation] = useState("");
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFailure(null);
    try {
      const result = await send("/api/admin/media", "POST", { body: joke, explanation: explanation.trim() || null });
      toast.success(t.generated(result.versions));
      onCreated();
    } catch (error) {
      setFailure(errorText(t, error));
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal.Backdrop isOpen onOpenChange={(open) => { if (!open && !pending) onClose(); }} isDismissable={!pending} isKeyboardDismissDisabled={pending}>
      <Modal.Container size="md">
        <Modal.Dialog>
          <Modal.CloseTrigger isDisabled={pending} aria-label={t.close} />
          <Modal.Header>
            <Modal.Heading>{t.createTitle}</Modal.Heading>
          </Modal.Header>
          <Form className="flex flex-col" onSubmit={submit}>
            <Modal.Body className="flex flex-col gap-4">
              <Typography.Paragraph size="sm" color="muted">{t.createIntro}</Typography.Paragraph>
              <TextField name="joke" isRequired value={joke} onChange={setJoke} maxLength={jokeLength.max} isDisabled={pending}
                validate={(value) => (value.trim().length < jokeLength.min ? t.jokeTooShort : null)}>
                <Label>{t.joke}</Label>
                <TextArea rows={5} placeholder={t.jokePlaceholder} />
                <Description>{t.jokeLength(joke.trim().length)}</Description>
                <FieldError />
              </TextField>
              <TextField name="explanation" value={explanation} onChange={setExplanation} maxLength={explanationLength.max} isDisabled={pending}
                validate={(value) => (value.trim() && value.trim().length < explanationLength.min ? t.explanationTooShort : null)}>
                <Label>{t.explanationLabel}</Label>
                <TextArea rows={2} />
                <Description>{t.explanationHint}</Description>
                <FieldError />
              </TextField>
              <Failure message={failure} />
            </Modal.Body>
            <Modal.Footer>
              <Button variant="tertiary" isDisabled={pending} onPress={onClose}>{t.cancel}</Button>
              <Button type="submit" isPending={pending}>
                {({ isPending }) => (
                  <>
                    {isPending ? <Spinner size="sm" color="current" /> : <Sparkles aria-hidden className="size-4" />}
                    {isPending ? t.creating : t.create}
                  </>
                )}
              </Button>
            </Modal.Footer>
          </Form>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
