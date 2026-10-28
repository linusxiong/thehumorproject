"use client";

import { ArrowRotateLeft, FloppyDisk } from "@gravity-ui/icons";
import { Alert, Button, Card, Meter, NumberField, Spinner, Table, Typography, toast } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { mixWeight, type ChainPurpose, type PromptChain } from "@/lib/admin-types";
import { useLocale, type Messages } from "../locale";
import { NoResults, PageHeading, plural, RatingCounts, TimeText, useFormat } from "./admin-ui";
import { Failure, requestStatus, sendJson } from "./resource-manager";

const purposes: ChainPurpose[] = ["preview", "adaptation"];

const en = {
  title: "Chain mix",
  description: "How often each prompt chain runs. Compare how readers rate each chain's versions, then shift the weights.",
  howTitle: "How the mix works",
  how: [
    "Each AI request picks one chain of its purpose at random, weighted by these numbers.",
    "A weight of 0 turns a chain off. Each purpose needs at least one chain above 0.",
    "A joke's versions count toward the chain of its latest successful adaptation, so the still-funny rates compare chains side by side.",
  ],
  purposes: { preview: "Punchline preview", adaptation: "Adaptation" } as Record<ChainPurpose, string>,
  table: (purpose: string) => `${purpose} chains`,
  chain: "Chain",
  steps: (count: string) => plural(count, "step", "steps"),
  weight: "Weight",
  weightFor: (name: string) => `Weight of ${name}`,
  share: "Share",
  shareOf: (name: string) => `Share of ${name}`,
  off: "Off",
  requests: "Requests",
  lastUsed: "Last used",
  never: "Never",
  jokes: "Jokes adapted",
  versions: "Versions",
  stillFunny: "Still funny",
  noRatings: "—",
  emptyPurpose: (purpose: string) => `${purpose} needs at least one chain with a weight above 0.`,
  invalidWeight: `Use whole numbers from ${mixWeight.min} to ${mixWeight.max}.`,
  lastChanged: "Last changed",
  neverChanged: "Weights not changed since setup",
  reset: "Reset",
  save: "Save mix",
  saving: "Saving…",
  saved: "Mix saved.",
  errors: {
    400: `Give each chain a whole number from ${mixWeight.min} to ${mixWeight.max}.`,
    401: "Your session has expired. Sign in again.",
    403: "Only superadmins can do this.",
    404: "A chain no longer exists. Refresh the page.",
    422: "Each purpose needs at least one chain with a weight above 0.",
  } as Partial<Record<number, string>>,
  genericError: "Something went wrong. Please try again.",
  empty: "No prompt chains yet. Apply the AI configuration migration.",
};

type Text = typeof en;

const messages: Messages<Text> = {
  en,
  es: {
    title: "Mezcla de cadenas",
    description: "Con qué frecuencia se ejecuta cada cadena de prompts. Compara cómo califican los lectores las versiones de cada cadena y ajusta los pesos.",
    howTitle: "Cómo funciona la mezcla",
    how: [
      "Cada solicitud de IA elige al azar una cadena de su propósito, ponderada por estos números.",
      "Un peso de 0 desactiva la cadena. Cada propósito necesita al menos una cadena por encima de 0.",
      "Las versiones de un chiste cuentan para la cadena de su última adaptación correcta, así que los porcentajes de «sigue siendo gracioso» comparan las cadenas entre sí.",
    ],
    purposes: { preview: "Vista previa del remate", adaptation: "Adaptación" },
    table: (purpose) => `Cadenas de ${purpose.toLocaleLowerCase("es")}`,
    chain: "Cadena",
    steps: (count) => plural(count, "paso", "pasos"),
    weight: "Peso",
    weightFor: (name) => `Peso de ${name}`,
    share: "Proporción",
    shareOf: (name) => `Proporción de ${name}`,
    off: "Desactivada",
    requests: "Solicitudes",
    lastUsed: "Último uso",
    never: "Nunca",
    jokes: "Chistes adaptados",
    versions: "Versiones",
    stillFunny: "Sigue siendo gracioso",
    noRatings: "—",
    emptyPurpose: (purpose) => `${purpose} necesita al menos una cadena con un peso mayor que 0.`,
    invalidWeight: `Usa números enteros de ${mixWeight.min} a ${mixWeight.max}.`,
    lastChanged: "Último cambio",
    neverChanged: "Los pesos no han cambiado desde la configuración inicial",
    reset: "Restablecer",
    save: "Guardar la mezcla",
    saving: "Guardando…",
    saved: "Mezcla guardada.",
    errors: {
      400: `Da a cada cadena un número entero de ${mixWeight.min} a ${mixWeight.max}.`,
      401: "Tu sesión expiró. Vuelve a iniciar sesión.",
      403: "Solo los superadministradores pueden hacer esto.",
      404: "Una cadena ya no existe. Actualiza la página.",
      422: "Cada propósito necesita al menos una cadena con un peso mayor que 0.",
    },
    genericError: "Algo salió mal. Inténtalo de nuevo.",
    empty: "Todavía no hay cadenas de prompts. Aplica la migración de configuración de IA.",
  },
  zh: {
    title: "链路配比",
    description: "每条 Prompt 链的运行频率。比较读者对各条链所写版本的评价，再调整权重。",
    howTitle: "配比如何生效",
    how: [
      "每个 AI 请求会按这些权重，从同一用途的链中随机选择一条。",
      "权重为 0 表示关闭该链。每种用途至少需要一条权重大于 0 的链。",
      "笑话的版本会计入它最近一次成功改编所用的链，因此可以直接比较各条链的“依然好笑”比例。",
    ],
    purposes: { preview: "笑点预览", adaptation: "改编" },
    table: (purpose) => `${purpose}链`,
    chain: "链",
    steps: (count) => `${count} 个步骤`,
    weight: "权重",
    weightFor: (name) => `${name}的权重`,
    share: "占比",
    shareOf: (name) => `${name}的占比`,
    off: "已关闭",
    requests: "请求",
    lastUsed: "最近使用",
    never: "从未",
    jokes: "改编的笑话",
    versions: "版本",
    stillFunny: "依然好笑",
    noRatings: "—",
    emptyPurpose: (purpose) => `“${purpose}”至少需要一条权重大于 0 的链。`,
    invalidWeight: `请输入 ${mixWeight.min} 到 ${mixWeight.max} 之间的整数。`,
    lastChanged: "最近修改",
    neverChanged: "初始配置后尚未修改权重",
    reset: "重置",
    save: "保存配比",
    saving: "正在保存…",
    saved: "配比已保存。",
    errors: {
      400: `请为每条链设置 ${mixWeight.min} 到 ${mixWeight.max} 之间的整数。`,
      401: "登录已过期，请重新登录。",
      403: "只有超级管理员可以执行此操作。",
      404: "某条链已不存在，请刷新页面。",
      422: "每种用途至少需要一条权重大于 0 的链。",
    },
    genericError: "出了点问题，请重试。",
    empty: "还没有 Prompt 链。请先应用 AI 配置迁移。",
  },
};

type Weights = Record<number, number>;

const savedWeights = (chains: PromptChain[]): Weights => Object.fromEntries(chains.map((chain) => [chain.id, chain.weight]));
const validWeight = (value: number) => Number.isInteger(value) && value >= mixWeight.min && value <= mixWeight.max;

export function ChainMix({ chains }: { chains: PromptChain[] }) {
  const t = messages[useLocale()];
  const router = useRouter();
  // Edits reset to the saved weights whenever the server sends new chains (after saving or refreshing).
  const [state, setState] = useState(() => ({ chains, weights: savedWeights(chains) }));
  const weights = state.chains === chains ? state.weights : savedWeights(chains);
  const setWeight = (id: number, value: number) => setState({ chains, weights: { ...weights, [id]: value } });
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const changed = chains.some((chain) => weights[chain.id] !== chain.weight);
  const invalid = chains.some((chain) => !validWeight(weights[chain.id]));
  const total = (purpose: ChainPurpose) => chains.filter((chain) => chain.purpose === purpose)
    .reduce((sum, chain) => sum + (validWeight(weights[chain.id]) ? weights[chain.id] : 0), 0);
  const emptyPurposes = purposes.filter((purpose) => chains.some((chain) => chain.purpose === purpose) && total(purpose) === 0);
  const lastChanged = chains.reduce<string | null>((latest, chain) =>
    (chain.mix_updated_at && (!latest || chain.mix_updated_at > latest) ? chain.mix_updated_at : latest), null);

  async function save() {
    setPending(true);
    setFailure(null);
    try {
      await sendJson("/api/admin/prompt-chain-mix", "PATCH", { weights: chains.map((chain) => ({ chainId: chain.id, weight: weights[chain.id] })) });
      toast.success(t.saved);
      router.refresh();
    } catch (error) {
      const status = requestStatus(error);
      setFailure((status !== null && t.errors[status]) || t.genericError);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeading title={t.title} description={t.description} />
      <Card>
        <Card.Header>
          <Card.Title>{t.howTitle}</Card.Title>
        </Card.Header>
        <Card.Content>
          <ul className="flex list-disc flex-col gap-1 ps-5 text-sm">
            {t.how.map((line) => <li key={line}>{line}</li>)}
          </ul>
        </Card.Content>
      </Card>
      {chains.length === 0 ? <Card><NoResults>{t.empty}</NoResults></Card> : (
        <>
          {purposes.map((purpose) => {
            const group = chains.filter((chain) => chain.purpose === purpose);
            return group.length > 0 && (
              <section key={purpose} aria-labelledby={`mix-${purpose}`} className="flex flex-col gap-3">
                <Typography.Heading level={2} id={`mix-${purpose}`} className="text-lg">{t.purposes[purpose]}</Typography.Heading>
                <MixTable purpose={purpose} chains={group} weights={weights} total={total(purpose)} pending={pending} onChange={setWeight} t={t} />
              </section>
            );
          })}
          {(emptyPurposes.length > 0 || invalid) && (
            <Alert status="warning">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Description>
                  {[...emptyPurposes.map((purpose) => t.emptyPurpose(t.purposes[purpose])), ...(invalid ? [t.invalidWeight] : [])].join(" ")}
                </Alert.Description>
              </Alert.Content>
            </Alert>
          )}
          <Failure message={failure} />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Typography.Paragraph size="xs" color="muted">
              {lastChanged ? <>{t.lastChanged}: <TimeText iso={lastChanged} relative /></> : t.neverChanged}
            </Typography.Paragraph>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="tertiary" isDisabled={!changed || pending} onPress={() => { setFailure(null); setState({ chains, weights: savedWeights(chains) }); }}>
                <ArrowRotateLeft aria-hidden className="size-4" />
                {t.reset}
              </Button>
              <Button isDisabled={!changed || invalid || emptyPurposes.length > 0} isPending={pending} onPress={save}>
                {({ isPending }) => (
                  <>
                    {isPending ? <Spinner size="sm" color="current" /> : <FloppyDisk aria-hidden className="size-4" />}
                    {isPending ? t.saving : t.save}
                  </>
                )}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function MixTable({ purpose, chains, weights, total, pending, onChange, t }: {
  purpose: ChainPurpose; chains: PromptChain[]; weights: Weights; total: number; pending: boolean; onChange: (id: number, value: number) => void; t: Text;
}) {
  const format = useFormat();
  // Preview chains write no versions, so only adaptation chains show reader outcomes.
  const outcomes = purpose === "adaptation";
  return (
    <Table>
      <Table.ScrollContainer>
        <Table.Content aria-label={t.table(t.purposes[purpose])} className={outcomes ? "min-w-[980px]" : "min-w-[640px]"}>
          <Table.Header>
            {[
              <Table.Column key="chain" isRowHeader className="min-w-56">{t.chain}</Table.Column>,
              <Table.Column key="weight">{t.weight}</Table.Column>,
              <Table.Column key="share" className="min-w-36">{t.share}</Table.Column>,
              <Table.Column key="requests">{t.requests}</Table.Column>,
              ...(outcomes
                ? [<Table.Column key="jokes">{t.jokes}</Table.Column>, <Table.Column key="versions">{t.versions}</Table.Column>,
                  <Table.Column key="funny">{t.stillFunny}</Table.Column>]
                : [<Table.Column key="used">{t.lastUsed}</Table.Column>]),
            ]}
          </Table.Header>
          <Table.Body items={chains}>
            {(chain) => {
              const weight = weights[chain.id];
              const share = validWeight(weight) && total > 0 ? weight / total : 0;
              const rated = chain.funny + chain.not_funny;
              return (
                <Table.Row id={chain.id}>
                  {[
                    <Table.Cell key="chain">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium">{chain.name}</span>
                        <span className="text-xs text-muted">{t.steps(format.number(chain.steps.length))}</span>
                      </div>
                    </Table.Cell>,
                    <Table.Cell key="weight">
                      <NumberField aria-label={t.weightFor(chain.name)} className="w-32" value={weight} minValue={mixWeight.min} maxValue={mixWeight.max}
                        step={1} formatOptions={{ maximumFractionDigits: 0 }} isDisabled={pending} isWheelDisabled
                        onChange={(value) => onChange(chain.id, value)}>
                        <NumberField.Group>
                          <NumberField.DecrementButton />
                          <NumberField.Input />
                          <NumberField.IncrementButton />
                        </NumberField.Group>
                      </NumberField>
                    </Table.Cell>,
                    <Table.Cell key="share">
                      {share > 0 ? (
                        <div className="flex items-center gap-2">
                          <Meter aria-label={t.shareOf(chain.name)} value={Math.round(share * 100)} size="sm" className="w-20">
                            <Meter.Track>
                              <Meter.Fill />
                            </Meter.Track>
                          </Meter>
                          <span className="text-sm tabular-nums">{format.percent(share)}</span>
                        </div>
                      ) : <span className="text-sm text-muted">{t.off}</span>}
                    </Table.Cell>,
                    <Table.Cell key="requests" className="tabular-nums">{format.number(chain.requests)}</Table.Cell>,
                    ...(outcomes ? [
                      <Table.Cell key="jokes" className="tabular-nums">{format.number(chain.jokes)}</Table.Cell>,
                      <Table.Cell key="versions" className="tabular-nums">{format.number(chain.versions)}</Table.Cell>,
                      <Table.Cell key="funny">
                        {rated > 0 ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm font-medium tabular-nums">{format.percent(chain.funny / rated)}</span>
                            <RatingCounts funny={chain.funny} notFunny={chain.not_funny} />
                          </div>
                        ) : <span className="text-muted">{t.noRatings}</span>}
                      </Table.Cell>,
                    ] : [
                      <Table.Cell key="used" className="whitespace-nowrap">
                        {chain.last_used_at ? <TimeText iso={chain.last_used_at} relative /> : <span className="text-muted">{t.never}</span>}
                      </Table.Cell>,
                    ]),
                  ]}
                </Table.Row>
              );
            }}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );
}
