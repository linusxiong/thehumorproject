import type { AudienceId } from "@/lib/jokes";

// One HeroUI color per culture, so chips, avatars, and meters stay recognizable across the page.
export const cultureColors = { en: "accent", es: "warning", zh: "danger" } as const satisfies Record<AudienceId, string>;

// How each audience laughs in writing; shown as-is in every interface language.
export const laughs: Record<AudienceId, string> = { en: "Haha", es: "¡Jajaja!", zh: "哈哈哈" };

// Known import sources and their names per interface language; unknown labels are shown as stored.
const sourceNames: Record<string, Record<AudienceId, string>> = {
  Qiushibaike: { en: "Qiushibaike", es: "Qiushibaike", zh: "糗事百科" },
};

export const sourceName = (label: string, locale: AudienceId) => sourceNames[label]?.[locale] ?? label;
