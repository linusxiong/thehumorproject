// Shared, client-safe contract for the admin area. Never import secrets here.
import type { AudienceId, JokeOrigin, Localized } from "@/lib/jokes";

// Dashboard date ranges in days; the default is 30.
export const adminRanges = [7, 30, 90, 365] as const;
export type AdminRange = (typeof adminRanges)[number];
export const parseRange = (value: unknown): AdminRange =>
  adminRanges.find((range) => String(range) === value) ?? 30;

// The signed-in superadmin. image is the Google photo from the session; avatar is the photo they chose on the site.
export type AdminUser = { name: string; email: string; image: string | null; avatar: string | null };

export type Mechanism = "reversal" | "deadpan" | "literal" | "absurd" | "wordplay" | "irony" | "self_mockery" | "innuendo";

export type RatedVersion = {
  id: number;
  audience: AudienceId;
  body: string;
  funny: number;
  not_funny: number;
  joke_id: number;
  joke_body: string;
  source_language: AudienceId;
};

export type DashboardStats = {
  days: number;
  since: string;
  totals: {
    jokes: number; versions: number; edited_versions: number; ratings: number; funny: number; accounts: number;
    superadmins: number; adult_jokes: number; explanations: number; accepted_explanations: number;
  };
  period: {
    jokes: number; previous_jokes: number; versions: number; previous_versions: number; ratings: number; previous_ratings: number;
    funny: number; previous_funny: number; active_accounts: number; previous_active_accounts: number;
  };
  daily: { day: string; jokes: number; ratings: number }[];
  origins: { origin: JokeOrigin; source_label: string | null; jokes: number }[];
  source_languages: { language: AudienceId; jokes: number }[];
  cultures: { audience: AudienceId; versions: number; funny: number; not_funny: number; median_length: number }[];
  // Median length of a version relative to its original, per source and target language.
  stretch: { source_language: AudienceId; audience: AudienceId; versions: number; ratio: number }[];
  mechanisms: { jokes: number; items: { id: Mechanism; jokes: number }[] };
  // Versions in another language that kept the original close, were reworded, or swapped a cultural reference.
  rewrites: { audience: AudienceId; kept: number; adapted: number; swapped: number }[];
  favorites: RatedVersion[];
  lost: RatedVersion[];
};

export type AdminAccount = {
  // SHA-256 digest of the verified email; the only id the app stores.
  id: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  is_superadmin: boolean;
  has_profile: boolean;
  jokes: number;
  ratings: number;
  funny: number;
  explanations: number;
  accepted_explanations: number;
  first_seen_at: string | null;
  last_active_at: string | null;
};

export type MediaItem = {
  id: number;
  audience: AudienceId;
  body: string;
  gloss: Partial<Localized>;
  punchline_core: Partial<Localized>;
  notes: Partial<Localized>;
  created_at: string;
  updated_at: string | null;
  funny: number;
  not_funny: number;
  joke: {
    id: number;
    body: string;
    source_language: AudienceId;
    origin: JokeOrigin;
    source_label: string | null;
    author_name: string;
    adult: boolean;
    explanation: string | null;
    explanation_source: "author" | "community" | null;
    created_at: string;
  };
};

export type AdminRating = {
  adaptation_id: number;
  user_id: string;
  funny: boolean;
  created_at: string;
  updated_at: string;
  rater_name: string | null;
  rater_email: string | null;
  audience: AudienceId;
  version: string;
  joke_id: number;
  joke: string;
  source_language: AudienceId;
};

// Limits for superadmin edits; they match the database checks and the model's output limits.
export const mediaLimits = { body: 2000, gloss: 2000, punchline_core: 500, notes: 1000 } as const;

// Fields a superadmin may change on a version. The gloss in the version's own language always equals its body.
export type MediaUpdate = Pick<MediaItem, "body" | "gloss" | "punchline_core" | "notes">;
