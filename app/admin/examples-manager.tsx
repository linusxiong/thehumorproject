"use client";

import { Chip } from "@heroui/react";
import type { GenerationExample } from "@/lib/admin-resources";
import { audiences, type AudienceId } from "@/lib/jokes";
import { audienceNames, htmlLang, useLocale, type Messages } from "../locale";
import { CultureLabel, plural } from "./admin-ui";
import { ResourceManager } from "./resource-manager";

const en = {
  title: "Generation examples",
  description: "Reference adaptations the AI should match. The ten newest are sent with every adaptation request: the joke in its original language, the versions for the other two cultures, and, when given, why it is funny and why the adaptation works.",
  add: "Add example",
  search: "Search examples",
  searchPlaceholder: "Any version, explanation, or note",
  count: (count: string) => plural(count, "example", "examples"),
  table: "Generation examples",
  createTitle: "Add a generation example",
  editTitle: (label: string) => `Edit example ${label}`,
  deleteTitle: (label: string) => `Delete example ${label}?`,
  deleteBody: (label: string) => `Example ${label} will no longer be sent to the AI. Jokes already adapted keep their versions.`,
  created: "Example added.",
  saved: "Example saved.",
  deleted: "Example deleted.",
  duplicate: "This example already exists.",
  empty: "No examples yet. Add an adaptation you are proud of to show the AI what good looks like.",
  id: "ID",
  original: "Original",
  versions: "Adapted versions",
  sent: "Sent to the AI",
  older: "Not sent (older than the ten newest)",
  status: "Status",
  sourceLanguage: "Original language",
  sourceHint: "The version in this language is the original joke; the other two are its adaptations.",
  body: (language: string) => `Version in ${language}`,
  explanation: "Why it's funny",
  explanationHint: "The reading the adaptation follows, such as a hidden pun.",
  notes: "Why the adaptation works",
  notesHint: "What was changed for each culture, such as a swapped reference.",
};

const messages: Messages<typeof en> = {
  en,
  es: {
    title: "Ejemplos de generación",
    description: "Adaptaciones de referencia que la IA debe igualar. Las diez más recientes se envían con cada solicitud de adaptación: el chiste en su idioma original, las versiones para las otras dos culturas y, si se indica, por qué es gracioso y por qué funciona la adaptación.",
    add: "Añadir ejemplo",
    search: "Buscar ejemplos",
    searchPlaceholder: "Cualquier versión, explicación o nota",
    count: (count) => plural(count, "ejemplo", "ejemplos"),
    table: "Ejemplos de generación",
    createTitle: "Añadir un ejemplo de generación",
    editTitle: (label) => `Editar el ejemplo ${label}`,
    deleteTitle: (label) => `¿Eliminar el ejemplo ${label}?`,
    deleteBody: (label) => `El ejemplo ${label} dejará de enviarse a la IA. Los chistes ya adaptados conservan sus versiones.`,
    created: "Ejemplo añadido.",
    saved: "Ejemplo guardado.",
    deleted: "Ejemplo eliminado.",
    duplicate: "Este ejemplo ya existe.",
    empty: "Aún no hay ejemplos. Añade una adaptación de la que estés orgulloso para mostrarle a la IA cómo se hace.",
    id: "ID",
    original: "Original",
    versions: "Versiones adaptadas",
    sent: "Se envía a la IA",
    older: "No se envía (más antiguo que los diez más recientes)",
    status: "Estado",
    sourceLanguage: "Idioma original",
    sourceHint: "La versión en este idioma es el chiste original; las otras dos son sus adaptaciones.",
    body: (language) => `Versión en ${language.toLocaleLowerCase("es")}`,
    explanation: "Por qué es gracioso",
    explanationHint: "La lectura que sigue la adaptación, como un juego de palabras oculto.",
    notes: "Por qué funciona la adaptación",
    notesHint: "Qué se cambió para cada cultura, como una referencia sustituida.",
  },
  zh: {
    title: "生成示例",
    description: "希望 AI 达到的参考改编。最新的十条会随每次改编请求一起发送：笑话原文、为另外两种文化写的版本，以及（如有）好笑在哪里和改编为什么成功。",
    add: "添加示例",
    search: "搜索示例",
    searchPlaceholder: "任一版本、解释或说明",
    count: (count) => `${count} 条示例`,
    table: "生成示例",
    createTitle: "添加生成示例",
    editTitle: (label) => `编辑示例 ${label}`,
    deleteTitle: (label) => `删除示例 ${label}？`,
    deleteBody: (label) => `示例 ${label} 将不再发送给 AI。已经改编的笑话会保留现有版本。`,
    created: "示例已添加。",
    saved: "示例已保存。",
    deleted: "示例已删除。",
    duplicate: "该示例已存在。",
    empty: "还没有示例。添加一条你满意的改编，让 AI 知道什么是好的改编。",
    id: "ID",
    original: "原文",
    versions: "改编版本",
    sent: "会发送给 AI",
    older: "不发送（不在最新十条之内）",
    status: "状态",
    sourceLanguage: "原文语言",
    sourceHint: "该语言的版本就是笑话原文，另外两个是它的改编。",
    body: (language) => `${language}版本`,
    explanation: "好笑在哪里",
    explanationHint: "改编所依据的理解，例如隐藏的谐音。",
    notes: "改编为什么成功",
    notesHint: "为每种文化做了哪些改动，例如替换了哪个典故。",
  },
};

const bodyField = (id: AudienceId) => `body_${id}` as const;

export function ExamplesManager({ rows }: { rows: GenerationExample[] }) {
  const locale = useLocale();
  const t = messages[locale];
  // The ten newest, matching the order the database sends them in.
  const sent = new Set([...rows].sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id).slice(0, 10).map((row) => row.id));
  return (
    <ResourceManager<GenerationExample> resource="generation-examples" rows={rows} text={t}
      label={(row) => `#${row.id}`}
      searchText={(row) => [row.body_en, row.body_es, row.body_zh, row.explanation, row.notes].filter(Boolean).join(" ")}
      toDraft={(row) => ({
        source_language: row.source_language, body_en: row.body_en, body_es: row.body_es, body_zh: row.body_zh,
        explanation: row.explanation ?? "", notes: row.notes ?? "",
      })}
      emptyDraft={{ source_language: locale, body_en: "", body_es: "", body_zh: "", explanation: "", notes: "" }}
      columns={[
        { id: "id", label: t.id, isRowHeader: true, sortValue: (row) => row.id, className: "font-medium tabular-nums", render: (row) => `#${row.id}` },
        {
          id: "original", label: t.original, className: "min-w-72", render: (row) => (
            <div className="flex max-w-sm flex-col gap-1">
              <CultureLabel audience={row.source_language} className="text-xs" />
              <span lang={htmlLang[row.source_language]} className="line-clamp-2 text-sm">{row[bodyField(row.source_language)]}</span>
            </div>
          ),
        },
        {
          id: "versions", label: t.versions, className: "min-w-72", render: (row) => (
            <div className="flex max-w-sm flex-col gap-1.5">
              {audiences.filter(({ id }) => id !== row.source_language).map(({ id }) => (
                <div key={id} className="flex items-baseline gap-2 text-xs">
                  <CultureLabel audience={id} />
                  <span lang={htmlLang[id]} className="line-clamp-1 text-muted">{row[bodyField(id)]}</span>
                </div>
              ))}
            </div>
          ),
        },
        {
          id: "status", label: t.status, render: (row) => sent.has(row.id)
            ? <Chip size="sm" variant="soft" color="success">{t.sent}</Chip>
            : <Chip size="sm" variant="soft">{t.older}</Chip>,
        },
      ]}
      fields={[
        { name: "source_language", label: t.sourceLanguage, description: t.sourceHint, options: audiences.map(({ id }) => ({ id, label: audienceNames[locale][id] })) },
        ...audiences.map(({ id }) => ({ name: bodyField(id), label: t.body(audienceNames[locale][id]), rows: 3, lang: htmlLang[id] })),
        { name: "explanation", label: t.explanation, description: t.explanationHint, rows: 2 },
        { name: "notes", label: t.notes, description: t.notesHint, rows: 2 },
      ]}
    />
  );
}
