// Shared, client-safe contract for cross-cultural jokes. Never import secrets here.

export const audiences = [
  { id: "en", language: "English", culture: "the English-speaking world (US, UK, and beyond)", lang: "en" },
  { id: "es", language: "Spanish", culture: "the Spanish-speaking world (Latin America and Spain)", lang: "es" },
  { id: "zh", language: "Chinese", culture: "Mainland China", lang: "zh-CN" },
] as const;

export type AudienceId = (typeof audiences)[number]["id"];

export const isAudienceId = (value: unknown): value is AudienceId =>
  audiences.some((audience) => audience.id === value);

export const jokeLength = { min: 10, max: 600 } as const;
export const dailyJokeLimit = 10;

// Platform commentary written once per interface language.
export type Localized = Record<AudienceId, string>;

export type Adaptation = {
  id: number;
  audience: AudienceId;
  body: string;
  // Faithful translation of `body` into each interface language (equals `body` for its own language).
  gloss: Partial<Localized>;
  punchline_core: Partial<Localized>;
  notes: Partial<Localized>;
  user_rating: boolean | null;
  // Present only when the joke is revealed to this viewer.
  funny?: number;
  not_funny?: number;
};

export type JokeOrigin = "demo" | "member" | "import";

export type Joke = {
  id: number;
  body: string;
  source_language: AudienceId;
  origin: JokeOrigin;
  // Where an imported joke came from, e.g. "Qiushibaike"; null otherwise.
  source_label: string | null;
  author_name: string;
  created_at: string;
  // True once the signed-in viewer has rated any version of this joke; totals stay hidden until then.
  revealed: boolean;
  adaptations: Adaptation[];
};

// Older rows carry English-only commentary; fall back to English, then any language.
export const localized = (value: Partial<Localized>, locale: AudienceId) =>
  value[locale] ?? value.en ?? Object.values(value)[0] ?? "";
