"use client";

import { ArrowUpRightFromSquare, Sliders } from "@gravity-ui/icons";
import { Button, buttonVariants, Card, Chip, Disclosure, Link, Typography } from "@heroui/react";
import NextLink from "next/link";
import { studioUrl, type PromptChain, type RequestPurpose, type ResponseKind } from "@/lib/admin-types";
import { useLocale, type Messages } from "../locale";
import { NoResults, PageHeading, plural, TimeText, useFormat } from "./admin-ui";

const purposes: RequestPurpose[] = ["preview", "adaptation", "media"];

type Effort = "low" | "medium" | "high" | "xhigh" | "max";

const en = {
  title: "Prompt chains",
  description: "Every prompt chain and its steps. Chains are built and edited in Punchline Studio, where a live chain's steps are locked; the chain mix decides how often each one runs.",
  adjustMix: "Adjust the mix",
  openStudio: "Open Punchline Studio",
  editInStudio: "Edit in Studio",
  purposes: {
    preview: { title: "Punchline preview", hint: "Explains a joke to its author before it is shared. One chain runs per preview." },
    adaptation: { title: "Adaptation", hint: "Writes the three cultural versions when a member shares or explains a joke, or a superadmin generates one." },
    media: { title: "Media", hint: "Free-form chains that run only in Punchline Studio. The site never uses them." },
  } as Record<RequestPurpose, { title: string; hint: string }>,
  share: (percent: string) => `${percent} of requests`,
  off: "Off",
  studioOnly: "Studio only",
  requests: "Requests",
  succeeded: "Succeeded",
  failed: "Failed",
  lastUsed: "Last used",
  never: "Never",
  steps: (count: string) => plural(count, "step", "steps"),
  stepsLabel: (name: string) => `Steps of ${name}`,
  kinds: { analysis: "Analysis", adaptation: "Adaptation", prompt: "Free-form" } as Record<ResponseKind, string>,
  model: "Model",
  effort: "Effort",
  efforts: { low: "Low", medium: "Medium", high: "High", xhigh: "Extra high", max: "Max" } as Record<Effort, string>,
  maxTokens: "Max tokens",
  showPrompt: "Show prompt",
  previewNote: "Written in the member's interface language, which replaces {{language}} in the prompt below.",
  skippedNote: "Skipped when the author or a community member already explained the joke.",
  adaptationNote: "Glossary entries found in the joke and the ten newest reference adaptations are added to this prompt when there are any.",
  terms: "Terms",
  examples: "Generation examples",
  empty: "No prompt chains yet. Apply the AI configuration migration.",
};

const messages: Messages<typeof en> = {
  en,
  es: {
    title: "Cadenas de prompts",
    description: "Todas las cadenas de prompts y sus pasos. Las cadenas se crean y editan en Punchline Studio, donde los pasos de una cadena activa quedan bloqueados; la mezcla decide con qué frecuencia se ejecuta cada una.",
    adjustMix: "Ajustar la mezcla",
    openStudio: "Abrir Punchline Studio",
    editInStudio: "Editar en Studio",
    purposes: {
      preview: { title: "Vista previa del remate", hint: "Explica un chiste a su autor antes de compartirlo. Cada vista previa ejecuta una cadena." },
      adaptation: { title: "Adaptación", hint: "Escribe las tres versiones culturales cuando un miembro comparte o explica un chiste, o cuando un superadministrador genera uno." },
      media: { title: "Contenido", hint: "Cadenas libres que solo se ejecutan en Punchline Studio. El sitio nunca las usa." },
    },
    share: (percent) => `${percent} de las solicitudes`,
    off: "Desactivada",
    studioOnly: "Solo en Studio",
    requests: "Solicitudes",
    succeeded: "Correctas",
    failed: "Fallidas",
    lastUsed: "Último uso",
    never: "Nunca",
    steps: (count) => plural(count, "paso", "pasos"),
    stepsLabel: (name) => `Pasos de ${name}`,
    kinds: { analysis: "Análisis", adaptation: "Adaptación", prompt: "Libre" },
    model: "Modelo",
    effort: "Esfuerzo",
    efforts: { low: "Bajo", medium: "Medio", high: "Alto", xhigh: "Muy alto", max: "Máximo" },
    maxTokens: "Tokens máximos",
    showPrompt: "Ver el prompt",
    previewNote: "Se escribe en el idioma de la interfaz del miembro, que sustituye a {{language}} en el prompt de abajo.",
    skippedNote: "Se omite cuando el autor o un miembro de la comunidad ya explicó el chiste.",
    adaptationNote: "Cuando existen, se añaden a este prompt las entradas del glosario que aparecen en el chiste y las diez adaptaciones de referencia más recientes.",
    terms: "Términos",
    examples: "Ejemplos de generación",
    empty: "Todavía no hay cadenas de prompts. Aplica la migración de configuración de IA.",
  },
  zh: {
    title: "Prompt 链",
    description: "所有 Prompt 链及其步骤。链在 Punchline Studio 中创建和编辑，已上线链的步骤会被锁定；链路配比决定每条链的运行频率。",
    adjustMix: "调整配比",
    openStudio: "打开 Punchline Studio",
    editInStudio: "在 Studio 中编辑",
    purposes: {
      preview: { title: "笑点预览", hint: "在分享之前向作者解释笑话。每次预览运行一条链。" },
      adaptation: { title: "改编", hint: "在会员分享或解释笑话、或超级管理员生成笑话时，写出三个文化版本。" },
      media: { title: "内容", hint: "只在 Punchline Studio 中运行的自由格式链，网站不会使用。" },
    },
    share: (percent) => `占请求的 ${percent}`,
    off: "已关闭",
    studioOnly: "仅 Studio",
    requests: "请求",
    succeeded: "成功",
    failed: "失败",
    lastUsed: "最近使用",
    never: "从未",
    steps: (count) => `${count} 个步骤`,
    stepsLabel: (name) => `${name}的步骤`,
    kinds: { analysis: "解读", adaptation: "改编", prompt: "自由格式" },
    model: "模型",
    effort: "推理强度",
    efforts: { low: "低", medium: "中", high: "高", xhigh: "很高", max: "最高" },
    maxTokens: "最大 token 数",
    showPrompt: "查看 prompt",
    previewNote: "使用会员的界面语言撰写，它会替换下方 prompt 中的 {{language}}。",
    skippedNote: "如果作者或社区用户已经解释过这个笑话，则跳过此步骤。",
    adaptationNote: "如果有的话，笑话中出现的术语表条目和最新的十个参考改编会附加到这个 prompt 中。",
    terms: "术语",
    examples: "生成示例",
    empty: "还没有 Prompt 链。请先应用 AI 配置迁移。",
  },
};

type Text = typeof en;

export function PromptChains({ chains }: { chains: PromptChain[] }) {
  const t = messages[useLocale()];
  return (
    <div className="flex flex-col gap-6">
      <PageHeading title={t.title} description={t.description} actions={(
        <div className="flex flex-wrap gap-2">
          <NextLink href="/admin/mix" className={buttonVariants({ variant: "secondary" })}>
            <Sliders aria-hidden className="size-4" />
            {t.adjustMix}
          </NextLink>
          <a href={studioUrl} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "secondary" })}>
            <ArrowUpRightFromSquare aria-hidden className="size-4" />
            {t.openStudio}
          </a>
        </div>
      )} />
      {chains.length === 0 && <Card><NoResults>{t.empty}</NoResults></Card>}
      {purposes.map((purpose) => {
        const group = chains.filter((chain) => chain.purpose === purpose);
        if (group.length === 0) return null;
        const total = group.reduce((sum, chain) => sum + chain.weight, 0);
        return (
          <section key={purpose} aria-labelledby={`chains-${purpose}`} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <Typography.Heading level={2} id={`chains-${purpose}`} className="text-lg">{t.purposes[purpose].title}</Typography.Heading>
              <Typography.Paragraph size="sm" color="muted">{t.purposes[purpose].hint}</Typography.Paragraph>
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              {group.map((chain) => <ChainCard key={chain.id} chain={chain} share={total > 0 ? chain.weight / total : 0} t={t} />)}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function ChainCard({ chain, share, t }: { chain: PromptChain; share: number; t: Text }) {
  const format = useFormat();
  const stats: [string, number][] = [[t.requests, chain.requests], [t.succeeded, chain.succeeded], [t.failed, chain.failed]];
  return (
    <Card className="gap-4">
      <Card.Header className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <Card.Title>{chain.name}</Card.Title>
          <Typography.Code className="w-fit text-xs">{chain.slug}</Typography.Code>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`${studioUrl}/chains/${chain.id}`} className="text-sm">{t.editInStudio}</Link>
          {chain.purpose === "media" ? <Chip size="sm" variant="soft">{t.studioOnly}</Chip> : chain.weight > 0
            ? <Chip size="sm" variant="soft" color="success">{t.share(format.percent(share))}</Chip>
            : <Chip size="sm" variant="soft">{t.off}</Chip>}
        </div>
      </Card.Header>
      <Card.Content className="flex flex-col gap-4">
        <Typography.Paragraph size="sm">{chain.description}</Typography.Paragraph>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map(([label, value]) => (
            <div key={label} className="flex flex-col gap-0.5">
              <dt className="text-xs text-muted">{label}</dt>
              <dd className="text-sm font-medium tabular-nums">{format.number(value)}</dd>
            </div>
          ))}
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs text-muted">{t.lastUsed}</dt>
            <dd className="text-sm">{chain.last_used_at ? <TimeText iso={chain.last_used_at} relative /> : <span className="text-muted">{t.never}</span>}</dd>
          </div>
        </dl>
        <div className="flex flex-col gap-2">
          <Typography.Paragraph size="xs" color="muted">{t.steps(format.number(chain.steps.length))}</Typography.Paragraph>
          <ol aria-label={t.stepsLabel(chain.name)} className="flex flex-col gap-3">
            {chain.steps.map((step) => (
              <li key={step.id} className="flex gap-3 rounded-xl bg-default p-3">
                <span aria-hidden className="flex size-6 shrink-0 items-center justify-center rounded-full bg-background text-xs font-semibold tabular-nums">
                  {step.position}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Typography.Paragraph size="sm" weight="medium">{step.name}</Typography.Paragraph>
                    <Chip size="sm" variant="secondary">{t.kinds[step.kind]}</Chip>
                  </div>
                  {step.description && <Typography.Paragraph size="sm" color="muted">{step.description}</Typography.Paragraph>}
                  <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
                    <div className="flex flex-wrap items-center gap-1">
                      <dt className="text-muted">{t.model}:</dt>
                      <dd className="flex flex-wrap items-center gap-1">
                        {step.model.name} <Typography.Code className="text-xs">{step.model.api_model_id}</Typography.Code> · {step.model.provider}
                      </dd>
                    </div>
                    <div className="flex items-center gap-1">
                      <dt className="text-muted">{t.effort}:</dt>
                      <dd>{t.efforts[step.effort as Effort] ?? step.effort}</dd>
                    </div>
                    <div className="flex items-center gap-1">
                      <dt className="text-muted">{t.maxTokens}:</dt>
                      <dd className="tabular-nums">{format.number(step.max_tokens)}</dd>
                    </div>
                  </dl>
                  <StepNote chain={chain} kind={step.kind} t={t} />
                  <Disclosure>
                    <Disclosure.Heading>
                      <Button slot="trigger" size="sm" variant="tertiary">
                        {t.showPrompt}
                        <Disclosure.Indicator />
                      </Button>
                    </Disclosure.Heading>
                    <Disclosure.Content>
                      <Disclosure.Body className="pt-2">
                        <pre lang="en" className="max-h-80 overflow-auto rounded-lg bg-background p-3 font-mono text-xs whitespace-pre-wrap">
                          {step.prompt}
                        </pre>
                      </Disclosure.Body>
                    </Disclosure.Content>
                  </Disclosure>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </Card.Content>
    </Card>
  );
}

function StepNote({ chain, kind, t }: { chain: PromptChain; kind: ResponseKind; t: Text }) {
  if (kind === "prompt") return null;
  if (kind === "adaptation") {
    return (
      <Typography.Paragraph size="xs" color="muted">
        {t.adaptationNote} <Link href="/admin/terms">{t.terms}</Link> · <Link href="/admin/examples">{t.examples}</Link>
      </Typography.Paragraph>
    );
  }
  return <Typography.Paragraph size="xs" color="muted">{chain.purpose === "preview" ? t.previewNote : t.skippedNote}</Typography.Paragraph>;
}
