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
// Explanations of what makes a joke funny: from the author while sharing, or from any member afterwards.
export const explanationLength = { min: 5, max: 500 } as const;
export const dailyExplanationLimit = 10;

// The model's reading of a joke before it is shared, shown so the author can confirm or correct it.
export type JokeAnalysis = {
  sourceLanguage: AudienceId;
  // Sexual or otherwise adult humor; such jokes are allowed and labeled 18+.
  adult: boolean;
  // What makes the joke funny, in the reader's interface language, including hidden puns, homophones, and innuendo.
  punchline: string;
};

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
  // The member's chosen avatar (uploaded photo or Google photo); null for imported and demo jokes or when unknown.
  author_avatar_url: string | null;
  created_at: string;
  // Sexual or otherwise adult humor, shown with an 18+ label.
  adult: boolean;
  // The accepted explanation of what makes the joke funny, and whether the author or a community member gave it (never who).
  explanation: string | null;
  explanation_source: "author" | "community" | null;
  // True once the signed-in viewer has rated any version of this joke; totals stay hidden until then.
  revealed: boolean;
  adaptations: Adaptation[];
};

// One rating the signed-in account has given, as shown in the personal center.
export type MyRating = {
  adaptation_id: number;
  funny: boolean;
  rated_at: string;
  audience: AudienceId;
  version: string;
  joke: Pick<Joke, "id" | "body" | "source_language" | "origin" | "source_label" | "author_name">;
};

// A joke the signed-in account shared, with full totals per version for the author's analytics.
export type MyJoke = Pick<Joke, "id" | "body" | "source_language" | "created_at"> & {
  adaptations: { audience: AudienceId; body: string; funny: number; not_funny: number }[];
};

// Older rows carry English-only commentary; fall back to English, then any language.
export const localized = (value: Partial<Localized>, locale: AudienceId) =>
  value[locale] ?? value.en ?? Object.values(value)[0] ?? "";
