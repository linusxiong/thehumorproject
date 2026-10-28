"use client";

import { Eye } from "@gravity-ui/icons";
import { Button, Chip, Disclosure, Modal, SearchField, Spinner, Table, type SortDescriptor } from "@heroui/react";
import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import type { LlmResponseDetail, LlmResponseSummary, ResponseStatus, StepKind } from "@/lib/admin-types";
import { htmlLang, useLocale, type Messages } from "../locale";
import { FilterSelect, NoResults, PageHeading, plural, StatTile, TablePager, TimeText, useFormat, useHydrated, usePaged } from "./admin-ui";
import { Failure, requestStatus, sendJson } from "./resource-manager";

// Shared by the LLM responses and generation requests pages: one model call's details, prompt, and answer.

type Effort = "low" | "medium" | "high" | "xhigh" | "max";

const callEn = {
  step: "Step",
  kind: "Kind",
  kinds: { analysis: "Punchline reading", adaptation: "Adaptation" } as Record<StepKind, string>,
  model: "Model",
  effort: "Effort",
  efforts: { low: "Low", medium: "Medium", high: "High", xhigh: "Extra high", max: "Max" } as Record<Effort, string>,
  status: "Status",
  statuses: { succeeded: "Succeeded", refused: "Refused", failed: "Failed" } as Record<ResponseStatus, string>,
  httpStatus: "HTTP status",
  stopReason: "Stop reason",
  inputTokens: "Input tokens",
  outputTokens: "Output tokens",
  cacheRead: "Cache read",
  cacheWrite: "Cache write",
  duration: "Duration",
  created: "Created",
  error: "Error",
  sent: "What was sent",
  sentHint: "Everything after the system prompt: the joke, any explanation, and glossary entries.",
  answer: "Answer",
  noAnswer: "No answer was recorded.",
  seconds: (value: string) => `${value} s`,
  loadFailed: "The details could not be loaded. Please try again.",
  retry: "Try again",
  loading: "Loading…",
  errors: {
    401: "Your session has expired. Sign in again.",
    403: "Only superadmins can do this.",
    404: "This record no longer exists. Refresh the list.",
  } as Partial<Record<number, string>>,
};

const callMessages: Messages<typeof callEn> = {
  en: callEn,
  es: {
    step: "Paso",
    kind: "Tipo",
    kinds: { analysis: "Lectura del remate", adaptation: "Adaptación" },
    model: "Modelo",
    effort: "Esfuerzo",
    efforts: { low: "Bajo", medium: "Medio", high: "Alto", xhigh: "Muy alto", max: "Máximo" },
    status: "Estado",
    statuses: { succeeded: "Completada", refused: "Rechazada por el modelo", failed: "Fallida" },
    httpStatus: "Estado HTTP",
    stopReason: "Motivo de parada",
    inputTokens: "Tokens de entrada",
    outputTokens: "Tokens de salida",
    cacheRead: "Lectura de caché",
    cacheWrite: "Escritura de caché",
    duration: "Duración",
    created: "Creada",
    error: "Error",
    sent: "Lo que se envió",
    sentHint: "Todo lo que va después del prompt del sistema: el chiste, la explicación si la hay y las entradas del glosario.",
    answer: "Respuesta",
    noAnswer: "No se registró ninguna respuesta.",
    seconds: (value) => `${value} s`,
    loadFailed: "No se pudieron cargar los detalles. Inténtalo de nuevo.",
    retry: "Reintentar",
    loading: "Cargando…",
    errors: {
      401: "Tu sesión expiró. Vuelve a iniciar sesión.",
      403: "Solo los superadministradores pueden hacer esto.",
      404: "Este registro ya no existe. Actualiza la lista.",
    },
  },
  zh: {
    step: "步骤",
    kind: "类型",
    kinds: { analysis: "笑点解读", adaptation: "改编" },
    model: "模型",
    effort: "推理强度",
    efforts: { low: "低", medium: "中", high: "高", xhigh: "很高", max: "最高" },
    status: "状态",
    statuses: { succeeded: "成功", refused: "模型拒绝", failed: "失败" },
    httpStatus: "HTTP 状态",
    stopReason: "停止原因",
    inputTokens: "输入 token",
    outputTokens: "输出 token",
    cacheRead: "缓存读取",
    cacheWrite: "缓存写入",
    duration: "耗时",
    created: "创建时间",
    error: "错误",
    sent: "发送的内容",
    sentHint: "系统提示词之后的全部内容：笑话、解释（如有）以及术语表条目。",
    answer: "回答",
    noAnswer: "没有记录到回答。",
    seconds: (value) => `${value} 秒`,
    loadFailed: "无法加载详情，请重试。",
    retry: "重试",
    loading: "正在加载…",
    errors: {
      401: "登录已过期，请重新登录。",
      403: "只有超级管理员可以执行此操作。",
      404: "该记录已不存在，请刷新列表。",
    },
  },
};

// A model call as the detail APIs return it; the request detail adds the step it ran.
export type CallDetail = LlmResponseDetail & { step?: { name: string; position: number } | null };

export const responseColor: Record<ResponseStatus, "success" | "warning" | "danger"> = { succeeded: "success", refused: "warning", failed: "danger" };

// Seconds with one decimal in the interface language, or a dash when unknown.
export function useSeconds() {
  const locale = useLocale();
  return useMemo(() => {
    const number = new Intl.NumberFormat(htmlLang[locale], { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    return (ms: number | null) => (ms === null ? "—" : callMessages[locale].seconds(number.format(ms / 1000)));
  }, [locale]);
}

type Detail<T> = { status: "idle" } | { status: "loading" } | { status: "error"; error: unknown } | { status: "done"; data: T };

// Loads a detail view when it opens; answers to earlier requests are ignored once another one starts.
export function useDetail<T>() {
  const [state, setState] = useState<Detail<T>>({ status: "idle" });
  const latest = useRef(0);
  const load = useCallback(async (url: string) => {
    const ticket = ++latest.current;
    setState({ status: "loading" });
    try {
      const data = await sendJson(url, "GET") as T;
      if (ticket === latest.current) setState({ status: "done", data });
    } catch (error) {
      if (ticket === latest.current) setState({ status: "error", error });
    }
  }, []);
  const reset = useCallback(() => {
    latest.current++;
    setState({ status: "idle" });
  }, []);
  return { state, load, reset };
}

// The loading spinner or the failure (with a retry) of a detail view; nothing once it has loaded.
export function DetailStatus({ state, onRetry }: { state: Detail<unknown>; onRetry: () => void }) {
  const t = callMessages[useLocale()];
  if (state.status === "loading") {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-muted" role="status">
        <Spinner size="sm" color="current" />
        {t.loading}
      </div>
    );
  }
  if (state.status !== "error") return null;
  const status = requestStatus(state.error);
  return (
    <div className="flex flex-col items-start gap-2">
      <Failure message={(status !== null && t.errors[status]) || t.loadFailed} />
      <Button size="sm" variant="tertiary" onPress={onRetry}>{t.retry}</Button>
    </div>
  );
}

export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={`flex min-w-0 flex-col gap-1 ${className ?? ""}`}>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-sm break-words whitespace-pre-line">{children}</dd>
    </div>
  );
}

export function CodeBlock({ children }: { children: string }) {
  return <pre className="max-h-80 overflow-auto rounded-xl bg-default p-3 font-mono text-xs break-words whitespace-pre-wrap">{children}</pre>;
}

function Expandable({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Disclosure>
      <Disclosure.Heading>
        <Button slot="trigger" size="sm" variant="tertiary">
          {label}
          <Disclosure.Indicator />
        </Button>
      </Disclosure.Heading>
      <Disclosure.Content>
        <Disclosure.Body className="flex flex-col gap-2 pt-2">{children}</Disclosure.Body>
      </Disclosure.Content>
    </Disclosure>
  );
}

const answerText = (answer: unknown) => (typeof answer === "string" ? answer : JSON.stringify(answer, null, 2));

// Everything recorded about one model call: model and step, outcome, usage, timing, and the prompt and answer.
export function CallDetails({ call }: { call: CallDetail }) {
  const t = callMessages[useLocale()];
  const format = useFormat();
  const seconds = useSeconds();
  const count = (value: number | null) => (value === null ? "—" : format.number(value));
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <Chip size="sm" variant="soft" color={responseColor[call.status]}>{t.statuses[call.status]}</Chip>
        <Chip size="sm" variant="secondary">{t.kinds[call.kind]}</Chip>
        {call.step && <span className="text-xs text-muted">{t.step} {format.number(call.step.position)} · {call.step.name}</span>}
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
        <Field label={t.model}><span className="font-mono text-xs">{call.model}</span></Field>
        <Field label={t.effort}>{t.efforts[call.effort as Effort] ?? call.effort}</Field>
        <Field label={t.duration}>{seconds(call.duration_ms)}</Field>
        <Field label={t.httpStatus}>{call.http_status ?? "—"}</Field>
        <Field label={t.stopReason}><span className="font-mono text-xs">{call.stop_reason ?? "—"}</span></Field>
        <Field label={t.created}><TimeText iso={call.created_at} /></Field>
        <Field label={t.inputTokens}>{count(call.input_tokens)}</Field>
        <Field label={t.outputTokens}>{count(call.output_tokens)}</Field>
        <Field label={`${t.cacheRead} / ${t.cacheWrite}`}>{count(call.cache_read_input_tokens)} / {count(call.cache_creation_input_tokens)}</Field>
        {call.error && <Field label={t.error} className="col-span-full"><span className="text-danger">{call.error}</span></Field>}
      </dl>
      <Expandable label={t.sent}>
        <span className="text-xs text-muted">{t.sentHint}</span>
        <CodeBlock>{call.prompt}</CodeBlock>
      </Expandable>
      <Expandable label={t.answer}>
        {call.answer === null || call.answer === undefined ? <span className="text-sm text-muted">{t.noAnswer}</span> : <CodeBlock>{answerText(call.answer)}</CodeBlock>}
      </Expandable>
    </div>
  );
}

type StatusFilter = "all" | ResponseStatus;
type KindFilter = "all" | StepKind;
type SortKey = "id" | "tokens" | "duration" | "created_at";

const en = {
  title: "LLM responses",
  description: "One row per model call, newest first (up to 1,000). Open a call to see what was sent and the model's answer. Read-only.",
  calls: "Model calls",
  callsCaption: (requests: string) => `For ${plural(requests, "request", "requests")}`,
  problems: "Failed or refused",
  problemsCaption: (share: string) => `${share} of calls`,
  tokens: "Tokens",
  tokensCaption: (input: string, output: string) => `${input} in · ${output} out`,
  medianDuration: "Median duration",
  medianCaption: "Per model call",
  count: (count: string) => plural(count, "call", "calls"),
  search: "Search model calls",
  searchPlaceholder: "Model, joke text, or call/request ID",
  status: "Status",
  allStatuses: "All statuses",
  kind: "Kind",
  allKinds: "All kinds",
  table: "Model calls",
  id: "ID",
  request: "Request",
  step: "Chain and step",
  model: "Model",
  outcome: "Outcome",
  usage: "Tokens in / out",
  cached: (count: string) => `${count} from cache`,
  duration: "Duration",
  created: "Created",
  actions: "Actions",
  unknownChain: "No chain",
  unknownStep: "Step removed",
  view: (id: number) => `View model call #${id}`,
  viewTitle: (id: number) => `Model call #${id}`,
  requestOf: (id: number) => `Request #${id}`,
  close: "Close",
};

const messages: Messages<typeof en> = {
  en,
  es: {
    title: "Respuestas del LLM",
    description: "Una fila por llamada al modelo, de la más reciente a la más antigua (hasta 1000). Abre una llamada para ver lo que se envió y la respuesta del modelo. Solo lectura.",
    calls: "Llamadas al modelo",
    callsCaption: (requests) => `Para ${plural(requests, "solicitud", "solicitudes")}`,
    problems: "Fallidas o rechazadas",
    problemsCaption: (share) => `${share} de las llamadas`,
    tokens: "Tokens",
    tokensCaption: (input, output) => `${input} de entrada · ${output} de salida`,
    medianDuration: "Duración mediana",
    medianCaption: "Por llamada al modelo",
    count: (count) => plural(count, "llamada", "llamadas"),
    search: "Buscar llamadas al modelo",
    searchPlaceholder: "Modelo, texto del chiste o ID de llamada o solicitud",
    status: "Estado",
    allStatuses: "Todos los estados",
    kind: "Tipo",
    allKinds: "Todos los tipos",
    table: "Llamadas al modelo",
    id: "ID",
    request: "Solicitud",
    step: "Cadena y paso",
    model: "Modelo",
    outcome: "Resultado",
    usage: "Tokens entrada / salida",
    cached: (count) => `${count} desde caché`,
    duration: "Duración",
    created: "Creada",
    actions: "Acciones",
    unknownChain: "Sin cadena",
    unknownStep: "Paso eliminado",
    view: (id) => `Ver la llamada al modelo #${id}`,
    viewTitle: (id) => `Llamada al modelo #${id}`,
    requestOf: (id) => `Solicitud #${id}`,
    close: "Cerrar",
  },
  zh: {
    title: "LLM 响应",
    description: "每次模型调用一行，按时间倒序（最多 1000 条）。打开某次调用可查看发送的内容和模型的回答。只读。",
    calls: "模型调用",
    callsCaption: (requests) => `来自 ${requests} 个请求`,
    problems: "失败或被拒绝",
    problemsCaption: (share) => `占全部调用的 ${share}`,
    tokens: "Token",
    tokensCaption: (input, output) => `输入 ${input} · 输出 ${output}`,
    medianDuration: "耗时中位数",
    medianCaption: "每次模型调用",
    count: (count) => `${count} 次调用`,
    search: "搜索模型调用",
    searchPlaceholder: "模型、笑话文本或调用/请求 ID",
    status: "状态",
    allStatuses: "全部状态",
    kind: "类型",
    allKinds: "全部类型",
    table: "模型调用",
    id: "ID",
    request: "请求",
    step: "链路与步骤",
    model: "模型",
    outcome: "结果",
    usage: "输入 / 输出 token",
    cached: (count) => `${count} 来自缓存`,
    duration: "耗时",
    created: "创建时间",
    actions: "操作",
    unknownChain: "无链路",
    unknownStep: "步骤已删除",
    view: (id) => `查看模型调用 #${id}`,
    viewTitle: (id) => `模型调用 #${id}`,
    requestOf: (id) => `请求 #${id}`,
    close: "关闭",
  },
};

const median = (values: number[]) => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

export function LlmResponses({ responses }: { responses: LlmResponseSummary[] }) {
  const locale = useLocale();
  const t = messages[locale];
  const call = callMessages[locale];
  const format = useFormat();
  const seconds = useSeconds();
  const hydrated = useHydrated();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [kind, setKind] = useState<KindFilter>("all");
  const [sort, setSort] = useState<SortDescriptor>({ column: "created_at", direction: "descending" });
  const [viewing, setViewing] = useState<LlmResponseSummary | null>(null);
  const detail = useDetail<CallDetail>();

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const id = needle.replace(/^#/, "");
    const filtered = responses.filter((response) => (status === "all" || response.status === status) && (kind === "all" || response.kind === kind)
      && (!needle || String(response.id) === id || String(response.request_id) === id
        || [response.model, response.model_name, response.input, response.chain_name, response.step_name].some((value) => value?.toLowerCase().includes(needle))));
    const direction = sort.direction === "descending" ? -1 : 1;
    const value = (response: LlmResponseSummary) => {
      switch (sort.column as SortKey) {
        case "tokens": return (response.input_tokens ?? 0) + (response.output_tokens ?? 0);
        case "duration": return response.duration_ms;
        case "id": return response.id;
        default: return 0;
      }
    };
    return filtered.sort((a, b) => direction * (sort.column === "created_at" ? a.created_at.localeCompare(b.created_at) || a.id - b.id : value(a) - value(b)));
  }, [responses, query, status, kind, sort]);
  const paged = usePaged(rows);

  const problems = responses.filter((response) => response.status !== "succeeded").length;
  const inputTokens = responses.reduce((sum, response) => sum + (response.input_tokens ?? 0), 0);
  const outputTokens = responses.reduce((sum, response) => sum + (response.output_tokens ?? 0), 0);
  const typical = median(responses.map((response) => response.duration_ms));

  function open(response: LlmResponseSummary) {
    setViewing(response);
    void detail.load(`/api/admin/llm-responses/${response.id}`);
  }

  function close() {
    setViewing(null);
    detail.reset();
  }

  const sortable = (id: SortKey, label: string, isRowHeader = false) => (
    <Table.Column id={id} allowsSorting={hydrated} isRowHeader={isRowHeader}>
      {({ sortDirection }) => <Table.SortableColumnHeader sortDirection={sortDirection}>{label}</Table.SortableColumnHeader>}
    </Table.Column>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeading title={t.title} description={t.description} />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label={t.calls} value={format.number(responses.length)}
          caption={t.callsCaption(format.number(new Set(responses.map((response) => response.request_id)).size))} />
        <StatTile label={t.problems} value={format.number(problems)} caption={t.problemsCaption(format.percent(responses.length ? problems / responses.length : 0))} />
        <StatTile label={t.tokens} value={format.compact(inputTokens + outputTokens)} caption={t.tokensCaption(format.compact(inputTokens), format.compact(outputTokens))} />
        <StatTile label={t.medianDuration} value={seconds(typical)} caption={t.medianCaption} />
      </section>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchField aria-label={t.search} value={query} onChange={setQuery} className="lg:w-80">
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder={t.searchPlaceholder} />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>
        <div className="flex flex-wrap items-center gap-3">
          <FilterSelect label={t.status} value={status} onChange={(value) => setStatus(value as StatusFilter)}
            options={[{ id: "all", label: t.allStatuses }, ...(Object.keys(call.statuses) as ResponseStatus[]).map((id) => ({ id, label: call.statuses[id] }))]} />
          <FilterSelect label={t.kind} value={kind} onChange={(value) => setKind(value as KindFilter)}
            options={[{ id: "all", label: t.allKinds }, ...(Object.keys(call.kinds) as StepKind[]).map((id) => ({ id, label: call.kinds[id] }))]} />
          <Chip size="sm" variant="soft">{t.count(format.number(rows.length))}</Chip>
        </div>
      </div>

      <Table>
        <Table.ScrollContainer>
          <Table.Content aria-label={t.table} className="min-w-[1080px]" sortDescriptor={sort} onSortChange={setSort}>
            <Table.Header>
              {sortable("id", t.id, true)}
              <Table.Column className="min-w-56">{t.request}</Table.Column>
              <Table.Column className="min-w-48">{t.step}</Table.Column>
              <Table.Column>{t.model}</Table.Column>
              <Table.Column>{t.outcome}</Table.Column>
              {sortable("tokens", t.usage)}
              {sortable("duration", t.duration)}
              {sortable("created_at", t.created)}
              <Table.Column className="text-end">{t.actions}</Table.Column>
            </Table.Header>
            <Table.Body items={paged.rows} renderEmptyState={() => <NoResults />}>
              {(response) => (
                <Table.Row id={response.id}>
                  <Table.Cell className="font-medium tabular-nums">#{response.id}</Table.Cell>
                  <Table.Cell>
                    <div className="flex max-w-xs flex-col gap-1">
                      <span className="text-xs text-muted tabular-nums">{t.requestOf(response.request_id)}</span>
                      <span className="line-clamp-2 text-sm">{response.input}</span>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex max-w-xs flex-col items-start gap-1">
                      <span className="text-sm">{response.chain_name ?? t.unknownChain}</span>
                      <span className="text-xs text-muted">
                        {response.step_name ? `${format.number(response.step_position ?? 0)} · ${response.step_name}` : t.unknownStep}
                      </span>
                      <Chip size="sm" variant="secondary">{call.kinds[response.kind]}</Chip>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex flex-col">
                      {response.model_name && <span className="text-sm">{response.model_name}</span>}
                      <span className="font-mono text-xs text-muted">{response.model}</span>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex flex-col items-start gap-1">
                      <Chip size="sm" variant="soft" color={responseColor[response.status]}>{call.statuses[response.status]}</Chip>
                      <span className="font-mono text-xs whitespace-nowrap text-muted">
                        {[response.http_status, response.stop_reason].filter((value) => value !== null).join(" · ") || "—"}
                      </span>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex flex-col whitespace-nowrap tabular-nums">
                      <span className="text-sm">{response.input_tokens === null ? "—" : format.number(response.input_tokens)} / {response.output_tokens === null ? "—" : format.number(response.output_tokens)}</span>
                      {(response.cache_read_input_tokens ?? 0) > 0 && <span className="text-xs text-muted">{t.cached(format.number(response.cache_read_input_tokens!))}</span>}
                    </div>
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap tabular-nums">{seconds(response.duration_ms)}</Table.Cell>
                  <Table.Cell className="whitespace-nowrap"><TimeText iso={response.created_at} relative /></Table.Cell>
                  <Table.Cell>
                    <div className="flex justify-end">
                      <Button isIconOnly size="sm" variant="tertiary" aria-label={t.view(response.id)} onPress={() => open(response)}>
                        <Eye aria-hidden className="size-4" />
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

      <Modal.Backdrop isOpen={viewing !== null} onOpenChange={(isOpen) => { if (!isOpen) close(); }} isDismissable>
        <Modal.Container size="lg" scroll="inside">
          <Modal.Dialog>
            <Modal.CloseTrigger aria-label={t.close} />
            {viewing && (
              <>
                <Modal.Header>
                  <Modal.Heading>{t.viewTitle(viewing.id)}</Modal.Heading>
                </Modal.Header>
                <Modal.Body className="flex flex-col gap-4">
                  <dl className="flex flex-col gap-3 rounded-xl bg-default p-3">
                    <Field label={t.requestOf(viewing.request_id)}>{viewing.input}</Field>
                    <Field label={t.step}>
                      {viewing.chain_name ?? t.unknownChain}
                      {" · "}
                      {viewing.step_name ? `${format.number(viewing.step_position ?? 0)} · ${viewing.step_name}` : t.unknownStep}
                    </Field>
                    {viewing.model_name && <Field label={t.model}>{viewing.model_name}</Field>}
                  </dl>
                  <DetailStatus state={detail.state} onRetry={() => void detail.load(`/api/admin/llm-responses/${viewing.id}`)} />
                  {detail.state.status === "done" && <CallDetails call={detail.state.data} />}
                </Modal.Body>
                <Modal.Footer>
                  <Button variant="tertiary" slot="close">{t.close}</Button>
                </Modal.Footer>
              </>
            )}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </div>
  );
}
