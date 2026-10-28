"use client";

import { Eye } from "@gravity-ui/icons";
import { Button, Chip, Modal, SearchField, Table, Typography, type SortDescriptor } from "@heroui/react";
import { useMemo, useState } from "react";
import type { ChainPurpose, GenerationRequest, GenerationSource, RequestStatus } from "@/lib/admin-types";
import { audienceNames, useLocale, type Messages } from "../locale";
import { FilterSelect, NoResults, PageHeading, plural, shortId, StatTile, TablePager, TimeText, useAdminMessages, useFormat, useHydrated, usePaged } from "./admin-ui";
import { CallDetails, DetailStatus, Field, useDetail, useSeconds, type CallDetail } from "./llm-responses";

type StatusFilter = "all" | RequestStatus;
type PurposeFilter = "all" | ChainPurpose;
type SourceFilter = "all" | GenerationSource;
type SortKey = "id" | "tokens" | "duration" | "created_at";

const statusColor: Record<RequestStatus, "default" | "success" | "warning" | "danger"> = {
  pending: "default", succeeded: "success", unsuitable: "warning", rejected: "warning", failed: "danger",
};

const en = {
  title: "Generation requests",
  description: "Every AI request made for members and superadmins, newest first (up to 1,000): punchline previews, shared jokes, community explanations, and admin generation. Previewed drafts that were never shared are included. Read-only.",
  requests: "Requests",
  requestsCaption: (previews: string, adaptations: string) => `${previews} previews · ${adaptations} adaptations`,
  successRate: "Success rate",
  successCaption: (count: string) => `${plural(count, "request", "requests")} succeeded`,
  failures: "Failures",
  failuresCaption: (count: string) => `${count} more unsuitable or rejected`,
  tokens: "Tokens",
  tokensCaption: (input: string, output: string) => `${input} in · ${output} out`,
  count: (count: string) => plural(count, "request", "requests"),
  search: "Search requests",
  searchPlaceholder: "Input, account, chain, or request/joke ID",
  status: "Status",
  allStatuses: "All statuses",
  statuses: { pending: "Pending", succeeded: "Succeeded", unsuitable: "Unsuitable", rejected: "Explanation rejected", failed: "Failed" } as Record<RequestStatus, string>,
  purpose: "Purpose",
  allPurposes: "All purposes",
  purposes: { preview: "Preview", adaptation: "Adaptation" } as Record<ChainPurpose, string>,
  source: "Source",
  allSources: "All sources",
  sources: { share: "Share", explanation: "Explanation", admin: "Admin" } as Record<GenerationSource, string>,
  table: "Generation requests",
  id: "ID",
  request: "Request",
  type: "Type",
  chain: "Chain",
  usage: "Tokens in / out",
  duration: "Duration",
  created: "Created",
  actions: "Actions",
  unknownAccount: "Unknown account",
  noChain: "Built-in default",
  view: (id: number) => `View request #${id}`,
  viewTitle: (id: number) => `Request #${id}`,
  input: "Input",
  explanation: "Explanation sent with it",
  locale: "Reader's language",
  account: "Account",
  joke: "Joke",
  jokeId: (id: number) => `Joke #${id} (see AI media)`,
  error: "Error",
  completed: "Completed",
  calls: "Model calls",
  noCalls: "No model calls were logged for this request.",
  close: "Close",
};

const messages: Messages<typeof en> = {
  en,
  es: {
    title: "Solicitudes de generación",
    description: "Todas las solicitudes a la IA hechas para miembros y superadministradores, de la más reciente a la más antigua (hasta 1000): vistas previas del remate, chistes compartidos, explicaciones de la comunidad y generación desde administración. Incluye borradores previsualizados que nunca se compartieron. Solo lectura.",
    requests: "Solicitudes",
    requestsCaption: (previews, adaptations) => `${previews} vistas previas · ${adaptations} adaptaciones`,
    successRate: "Tasa de éxito",
    successCaption: (count) => (count === "1" ? "1 solicitud completada" : `${count} solicitudes completadas`),
    failures: "Fallos",
    failuresCaption: (count) => `${count} más no aptas o rechazadas`,
    tokens: "Tokens",
    tokensCaption: (input, output) => `${input} de entrada · ${output} de salida`,
    count: (count) => plural(count, "solicitud", "solicitudes"),
    search: "Buscar solicitudes",
    searchPlaceholder: "Texto, cuenta, cadena o ID de solicitud o chiste",
    status: "Estado",
    allStatuses: "Todos los estados",
    statuses: { pending: "Pendiente", succeeded: "Completada", unsuitable: "No apta", rejected: "Explicación rechazada", failed: "Fallida" },
    purpose: "Propósito",
    allPurposes: "Todos los propósitos",
    purposes: { preview: "Vista previa", adaptation: "Adaptación" },
    source: "Origen",
    allSources: "Todos los orígenes",
    sources: { share: "Compartir", explanation: "Explicación", admin: "Administración" },
    table: "Solicitudes de generación",
    id: "ID",
    request: "Solicitud",
    type: "Tipo",
    chain: "Cadena",
    usage: "Tokens entrada / salida",
    duration: "Duración",
    created: "Creada",
    actions: "Acciones",
    unknownAccount: "Cuenta desconocida",
    noChain: "Predeterminada integrada",
    view: (id) => `Ver la solicitud #${id}`,
    viewTitle: (id) => `Solicitud #${id}`,
    input: "Texto enviado",
    explanation: "Explicación enviada",
    locale: "Idioma del lector",
    account: "Cuenta",
    joke: "Chiste",
    jokeId: (id) => `Chiste #${id} (ver Contenido IA)`,
    error: "Error",
    completed: "Completada",
    calls: "Llamadas al modelo",
    noCalls: "No se registraron llamadas al modelo para esta solicitud.",
    close: "Cerrar",
  },
  zh: {
    title: "生成请求",
    description: "为会员和超级管理员发起的所有 AI 请求，按时间倒序（最多 1000 条）：笑点预览、分享笑话、社区解释和后台生成。包括预览过但从未分享的草稿。只读。",
    requests: "请求",
    requestsCaption: (previews, adaptations) => `预览 ${previews} 次 · 改编 ${adaptations} 次`,
    successRate: "成功率",
    successCaption: (count) => `${count} 个请求成功`,
    failures: "失败",
    failuresCaption: (count) => `另有 ${count} 个不适合或被拒绝`,
    tokens: "Token",
    tokensCaption: (input, output) => `输入 ${input} · 输出 ${output}`,
    count: (count) => `${count} 个请求`,
    search: "搜索请求",
    searchPlaceholder: "输入内容、账户、链路或请求/笑话 ID",
    status: "状态",
    allStatuses: "全部状态",
    statuses: { pending: "进行中", succeeded: "成功", unsuitable: "不适合", rejected: "解释被拒绝", failed: "失败" },
    purpose: "用途",
    allPurposes: "全部用途",
    purposes: { preview: "预览", adaptation: "改编" },
    source: "来源",
    allSources: "全部来源",
    sources: { share: "分享", explanation: "解释", admin: "后台" },
    table: "生成请求",
    id: "ID",
    request: "请求",
    type: "类型",
    chain: "链路",
    usage: "输入 / 输出 token",
    duration: "耗时",
    created: "创建时间",
    actions: "操作",
    unknownAccount: "未知账户",
    noChain: "内置默认",
    view: (id) => `查看请求 #${id}`,
    viewTitle: (id) => `请求 #${id}`,
    input: "输入内容",
    explanation: "随请求发送的解释",
    locale: "读者语言",
    account: "账户",
    joke: "笑话",
    jokeId: (id) => `笑话 #${id}（见 AI 内容）`,
    error: "错误",
    completed: "完成时间",
    calls: "模型调用",
    noCalls: "该请求没有记录模型调用。",
    close: "关闭",
  },
};

// Time from the request's start to its outcome; null while it is still pending.
const elapsed = (request: GenerationRequest) =>
  (request.completed_at ? Math.max(0, new Date(request.completed_at).getTime() - new Date(request.created_at).getTime()) : null);

export function GenerationRequests({ requests }: { requests: GenerationRequest[] }) {
  const locale = useLocale();
  const t = messages[locale];
  const shared = useAdminMessages();
  const format = useFormat();
  const seconds = useSeconds();
  const hydrated = useHydrated();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [purpose, setPurpose] = useState<PurposeFilter>("all");
  const [source, setSource] = useState<SourceFilter>("all");
  const [sort, setSort] = useState<SortDescriptor>({ column: "created_at", direction: "descending" });
  const [viewing, setViewing] = useState<GenerationRequest | null>(null);
  const detail = useDetail<CallDetail[]>();

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const id = needle.replace(/^#/, "");
    const filtered = requests.filter((request) => (status === "all" || request.status === status)
      && (purpose === "all" || request.purpose === purpose) && (source === "all" || request.source === source)
      && (!needle || String(request.id) === id || (request.joke_id !== null && String(request.joke_id) === id)
        || [request.input, request.account_name, request.account_email, request.user_id, request.chain_name].some((value) => value?.toLowerCase().includes(needle))));
    const direction = sort.direction === "descending" ? -1 : 1;
    const value = (request: GenerationRequest) => {
      switch (sort.column as SortKey) {
        case "tokens": return request.input_tokens + request.output_tokens;
        case "duration": return elapsed(request) ?? -1;
        case "id": return request.id;
        default: return 0;
      }
    };
    return filtered.sort((a, b) => direction * (sort.column === "created_at" ? a.created_at.localeCompare(b.created_at) || a.id - b.id : value(a) - value(b)));
  }, [requests, query, status, purpose, source, sort]);
  const paged = usePaged(rows);

  const tally = (wanted: RequestStatus) => requests.filter((request) => request.status === wanted).length;
  const succeeded = tally("succeeded");
  const finished = requests.filter((request) => request.status !== "pending").length;
  const inputTokens = requests.reduce((sum, request) => sum + request.input_tokens, 0);
  const outputTokens = requests.reduce((sum, request) => sum + request.output_tokens, 0);
  const previews = requests.filter((request) => request.purpose === "preview").length;

  const accountName = (request: GenerationRequest) =>
    request.account_name ?? (request.user_id ? shared.account(shortId(request.user_id)) : t.unknownAccount);

  function open(request: GenerationRequest) {
    setViewing(request);
    void detail.load(`/api/admin/generation-requests/${request.id}`);
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
        <StatTile label={t.requests} value={format.number(requests.length)}
          caption={t.requestsCaption(format.number(previews), format.number(requests.length - previews))} />
        <StatTile label={t.successRate} value={format.percent(finished ? succeeded / finished : 0)} caption={t.successCaption(format.number(succeeded))} />
        <StatTile label={t.failures} value={format.number(tally("failed"))} caption={t.failuresCaption(format.number(tally("unsuitable") + tally("rejected")))} />
        <StatTile label={t.tokens} value={format.compact(inputTokens + outputTokens)} caption={t.tokensCaption(format.compact(inputTokens), format.compact(outputTokens))} />
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
            options={[{ id: "all", label: t.allStatuses }, ...(Object.keys(t.statuses) as RequestStatus[]).map((id) => ({ id, label: t.statuses[id] }))]} />
          <FilterSelect label={t.purpose} value={purpose} onChange={(value) => setPurpose(value as PurposeFilter)}
            options={[{ id: "all", label: t.allPurposes }, ...(Object.keys(t.purposes) as ChainPurpose[]).map((id) => ({ id, label: t.purposes[id] }))]} />
          <FilterSelect label={t.source} value={source} onChange={(value) => setSource(value as SourceFilter)}
            options={[{ id: "all", label: t.allSources }, ...(Object.keys(t.sources) as GenerationSource[]).map((id) => ({ id, label: t.sources[id] }))]} />
          <Chip size="sm" variant="soft">{t.count(format.number(rows.length))}</Chip>
        </div>
      </div>

      <Table>
        <Table.ScrollContainer>
          <Table.Content aria-label={t.table} className="min-w-[1080px]" sortDescriptor={sort} onSortChange={setSort}>
            <Table.Header>
              {sortable("id", t.id, true)}
              <Table.Column className="min-w-72">{t.request}</Table.Column>
              <Table.Column>{t.type}</Table.Column>
              <Table.Column>{t.chain}</Table.Column>
              <Table.Column>{t.status}</Table.Column>
              {sortable("tokens", t.usage)}
              {sortable("duration", t.duration)}
              {sortable("created_at", t.created)}
              <Table.Column className="text-end">{t.actions}</Table.Column>
            </Table.Header>
            <Table.Body items={paged.rows} renderEmptyState={() => <NoResults />}>
              {(request) => (
                <Table.Row id={request.id}>
                  <Table.Cell className="font-medium tabular-nums">#{request.id}</Table.Cell>
                  <Table.Cell>
                    <div className="flex max-w-md flex-col gap-1">
                      <span className="line-clamp-2 text-sm">{request.input}</span>
                      <span className="truncate text-xs text-muted">
                        {accountName(request)}{request.account_email ? ` · ${request.account_email}` : ""}
                      </span>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Chip size="sm" variant="secondary">{t.purposes[request.purpose]}</Chip>
                      <Chip size="sm" variant="soft">{t.sources[request.source]}</Chip>
                    </div>
                  </Table.Cell>
                  <Table.Cell><span className="text-sm">{request.chain_name ?? t.noChain}</span></Table.Cell>
                  <Table.Cell><Chip size="sm" variant="soft" color={statusColor[request.status]}>{t.statuses[request.status]}</Chip></Table.Cell>
                  <Table.Cell className="whitespace-nowrap tabular-nums">{format.number(request.input_tokens)} / {format.number(request.output_tokens)}</Table.Cell>
                  <Table.Cell className="whitespace-nowrap tabular-nums">{seconds(elapsed(request))}</Table.Cell>
                  <Table.Cell className="whitespace-nowrap"><TimeText iso={request.created_at} relative /></Table.Cell>
                  <Table.Cell>
                    <div className="flex justify-end">
                      <Button isIconOnly size="sm" variant="tertiary" aria-label={t.view(request.id)} onPress={() => open(request)}>
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
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Chip size="sm" variant="soft" color={statusColor[viewing.status]}>{t.statuses[viewing.status]}</Chip>
                    <Chip size="sm" variant="secondary">{t.purposes[viewing.purpose]}</Chip>
                    <Chip size="sm" variant="soft">{t.sources[viewing.source]}</Chip>
                  </div>
                  <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                    <Field label={t.input} className="col-span-full">{viewing.input}</Field>
                    {viewing.explanation && <Field label={t.explanation} className="col-span-full">{viewing.explanation}</Field>}
                    {viewing.error && <Field label={t.error} className="col-span-full"><span className="text-danger">{viewing.error}</span></Field>}
                    <Field label={t.account}>
                      {accountName(viewing)}
                      {viewing.account_email && <span className="block text-xs text-muted">{viewing.account_email}</span>}
                    </Field>
                    <Field label={t.chain}>{viewing.chain_name ?? t.noChain}</Field>
                    {viewing.locale && <Field label={t.locale}>{audienceNames[locale][viewing.locale]}</Field>}
                    {viewing.joke_id !== null && <Field label={t.joke}>{t.jokeId(viewing.joke_id)}</Field>}
                    <Field label={t.created}><TimeText iso={viewing.created_at} /></Field>
                    <Field label={t.completed}><TimeText iso={viewing.completed_at} /></Field>
                    <Field label={t.duration}>{seconds(elapsed(viewing))}</Field>
                    <Field label={t.usage}>{format.number(viewing.input_tokens)} / {format.number(viewing.output_tokens)}</Field>
                  </dl>
                  <section className="flex flex-col gap-3">
                    <Typography.Heading level={3} className="text-base">{t.calls}</Typography.Heading>
                    <DetailStatus state={detail.state} onRetry={() => void detail.load(`/api/admin/generation-requests/${viewing.id}`)} />
                    {detail.state.status === "done" && (detail.state.data.length === 0
                      ? <Typography.Paragraph size="sm" color="muted">{t.noCalls}</Typography.Paragraph>
                      : detail.state.data.map((call) => (
                        <div key={call.id} className="rounded-xl border border-border p-3">
                          <CallDetails call={call} />
                        </div>
                      )))}
                  </section>
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
