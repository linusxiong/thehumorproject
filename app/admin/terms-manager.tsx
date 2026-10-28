"use client";

import { Chip } from "@heroui/react";
import type { Term } from "@/lib/admin-resources";
import { audiences } from "@/lib/jokes";
import { audienceNames, htmlLang, useLocale, type Messages } from "../locale";
import { plural } from "./admin-ui";
import { ResourceManager } from "./resource-manager";

const en = {
  title: "Terms",
  description: "A glossary of culture-specific terms: slang, references, and sound-alikes. When a joke contains a term, its entry is sent to the AI with the joke, for previews and adaptations alike.",
  add: "Add term",
  search: "Search terms",
  searchPlaceholder: "Term, definition, or example",
  count: (count: string) => plural(count, "term", "terms"),
  table: "Glossary terms",
  createTitle: "Add a term",
  editTitle: (label: string) => `Edit “${label}”`,
  deleteTitle: (label: string) => `Delete “${label}”?`,
  deleteBody: (label: string) => `“${label}” will no longer be sent to the AI. Jokes already adapted keep their versions.`,
  created: "Term added.",
  saved: "Term saved.",
  deleted: "Term deleted.",
  duplicate: "This language already has this term.",
  empty: "No terms yet. Add slang, references, or puns the AI tends to miss.",
  term: "Term",
  termHint: "Matched in jokes regardless of case; English and Spanish terms must stand as whole words.",
  language: "Language",
  definition: "Meaning",
  definitionHint: "What a native reader hears, including any double meaning.",
  example: "Example",
};

const messages: Messages<typeof en> = {
  en,
  es: {
    title: "Términos",
    description: "Un glosario de términos culturales: jerga, referencias y palabras que suenan parecido. Cuando un chiste contiene un término, su entrada se envía a la IA junto con el chiste, tanto en las vistas previas como en las adaptaciones.",
    add: "Añadir término",
    search: "Buscar términos",
    searchPlaceholder: "Término, significado o ejemplo",
    count: (count) => plural(count, "término", "términos"),
    table: "Términos del glosario",
    createTitle: "Añadir un término",
    editTitle: (label) => `Editar «${label}»`,
    deleteTitle: (label) => `¿Eliminar «${label}»?`,
    deleteBody: (label) => `«${label}» dejará de enviarse a la IA. Los chistes ya adaptados conservan sus versiones.`,
    created: "Término añadido.",
    saved: "Término guardado.",
    deleted: "Término eliminado.",
    duplicate: "Este idioma ya tiene este término.",
    empty: "Aún no hay términos. Añade jerga, referencias o juegos de palabras que la IA suele pasar por alto.",
    term: "Término",
    termHint: "Se busca en los chistes sin distinguir mayúsculas; en inglés y español debe aparecer como palabra completa.",
    language: "Idioma",
    definition: "Significado",
    definitionHint: "Lo que entiende un hablante nativo, incluido cualquier doble sentido.",
    example: "Ejemplo",
  },
  zh: {
    title: "术语",
    description: "文化相关术语表：俚语、典故和谐音。笑话中出现某个术语时，它的释义会随笑话一起发送给 AI，预览和改编都会用到。",
    add: "添加术语",
    search: "搜索术语",
    searchPlaceholder: "术语、释义或例句",
    count: (count) => `${count} 个术语`,
    table: "术语表",
    createTitle: "添加术语",
    editTitle: (label) => `编辑“${label}”`,
    deleteTitle: (label) => `删除“${label}”？`,
    deleteBody: (label) => `“${label}”将不再发送给 AI。已经改编的笑话会保留现有版本。`,
    created: "术语已添加。",
    saved: "术语已保存。",
    deleted: "术语已删除。",
    duplicate: "该语言中已有这个术语。",
    empty: "还没有术语。可以添加 AI 容易忽略的俚语、典故或双关。",
    term: "术语",
    termHint: "匹配笑话时不区分大小写；英语和西班牙语术语需要作为完整单词出现。",
    language: "语言",
    definition: "释义",
    definitionHint: "母语读者听到的意思，包括任何双关含义。",
    example: "例句",
  },
};

export function TermsManager({ rows }: { rows: Term[] }) {
  const locale = useLocale();
  const t = messages[locale];
  return (
    <ResourceManager<Term> resource="terms" rows={rows} text={t}
      label={(row) => row.term}
      searchText={(row) => `${row.term} ${row.definition} ${row.example ?? ""}`}
      toDraft={(row) => ({ term: row.term, language: row.language, definition: row.definition, example: row.example ?? "" })}
      emptyDraft={{ term: "", language: locale, definition: "", example: "" }}
      columns={[
        { id: "term", label: t.term, isRowHeader: true, sortValue: (row) => row.term, render: (row) => <span lang={htmlLang[row.language]} className="font-medium">{row.term}</span> },
        { id: "language", label: t.language, sortValue: (row) => row.language, render: (row) => <Chip size="sm" variant="secondary">{audienceNames[locale][row.language]}</Chip> },
        {
          id: "definition", label: t.definition, className: "min-w-80", render: (row) => (
            <div className="flex max-w-lg flex-col gap-1">
              <span className="line-clamp-2 text-sm">{row.definition}</span>
              {row.example && <span lang={htmlLang[row.language]} className="line-clamp-1 text-xs text-muted">{row.example}</span>}
            </div>
          ),
        },
      ]}
      fields={[
        { name: "term", label: t.term, description: t.termHint },
        { name: "language", label: t.language, options: audiences.map(({ id }) => ({ id, label: audienceNames[locale][id] })) },
        { name: "definition", label: t.definition, description: t.definitionHint, rows: 3 },
        { name: "example", label: t.example, rows: 2 },
      ]}
    />
  );
}
