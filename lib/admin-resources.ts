// Shared, client-safe contract for the admin area's simple create/read/update/delete tables. The Route Handlers
// validate with these specs and the forms use the same limits; the database checks match them. Never import secrets here.
import { audiences, type AudienceId } from "@/lib/jokes";

type TextField = { kind: "text"; min: number; max: number; optional?: boolean; pattern?: RegExp; lowercase?: boolean };
type ChoiceField = { kind: "choice"; values: readonly string[] };
// A positive id of a row in another table; the database checks that it exists.
type ReferenceField = { kind: "reference" };
export type FieldSpec = TextField | ChoiceField | ReferenceField;

const text = (min: number, max: number, extra: Partial<TextField> = {}): TextField => ({ kind: "text", min, max, ...extra });
const languages: ChoiceField = { kind: "choice", values: audiences.map((audience) => audience.id) };

export const domainPattern = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
export const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export const modelIdPattern = /^[a-z0-9][a-z0-9._:/-]{0,99}$/;

export const resources = {
  terms: {
    table: "terms",
    select: "id,term,language,definition,example,created_at,updated_at",
    order: "term",
    fields: { term: text(1, 100), language: languages, definition: text(1, 1000), example: text(1, 1000, { optional: true }) },
  },
  "generation-examples": {
    table: "generation_examples",
    select: "id,source_language,body_en,body_es,body_zh,explanation,notes,created_at,updated_at",
    order: "created_at.desc",
    fields: {
      source_language: languages, body_en: text(1, 2000), body_es: text(1, 2000), body_zh: text(1, 2000),
      explanation: text(5, 500, { optional: true }), notes: text(1, 1000, { optional: true }),
    },
  },
  "llm-models": {
    table: "llm_models",
    select: "id,name,api_model_id,provider_id,created_at,updated_at,provider:llm_providers(name),steps:prompt_chain_steps(count)",
    order: "name",
    fields: { name: text(1, 100), api_model_id: text(1, 100, { pattern: modelIdPattern, lowercase: true }), provider_id: { kind: "reference" } },
  },
  "llm-providers": {
    table: "llm_providers",
    select: "id,name,created_at,updated_at,models:llm_models(count)",
    order: "name",
    fields: { name: text(1, 100) },
  },
  "signup-domains": {
    table: "allowed_signup_domains",
    select: "id,domain,created_at,updated_at",
    order: "domain",
    fields: { domain: text(3, 253, { pattern: domainPattern, lowercase: true }) },
  },
  "whitelisted-emails": {
    table: "whitelisted_emails",
    select: "id,email,created_at,updated_at",
    order: "email",
    fields: { email: text(3, 320, { pattern: emailPattern, lowercase: true }) },
  },
} as const satisfies Record<string, { table: string; select: string; order: string; fields: Record<string, FieldSpec> }>;

export type ResourceName = keyof typeof resources;
export const isResourceName = (value: unknown): value is ResourceName => typeof value === "string" && Object.hasOwn(resources, value);

type Timestamps = { id: number; created_at: string; updated_at: string | null };
export type Term = Timestamps & { term: string; language: AudienceId; definition: string; example: string | null };
export type GenerationExample = Timestamps & {
  source_language: AudienceId; body_en: string; body_es: string; body_zh: string; explanation: string | null; notes: string | null;
};
export type LlmModel = Timestamps & { name: string; api_model_id: string; provider_id: number; provider: { name: string } | null; steps: { count: number }[] };
export type LlmProvider = Timestamps & { name: string; models: { count: number }[] };
export type SignupDomain = Timestamps & { domain: string };
export type WhitelistedEmail = Timestamps & { email: string };

export type ResourceRows = {
  terms: Term; "generation-examples": GenerationExample; "llm-models": LlmModel; "llm-providers": LlmProvider;
  "signup-domains": SignupDomain; "whitelisted-emails": WhitelistedEmail;
};

// Normalizes a form value the way the server stores it: trimmed, and lowercased where the field says so.
export function normalize(spec: FieldSpec, value: string) {
  const trimmed = value.trim();
  return spec.kind === "text" && spec.lowercase ? trimmed.toLowerCase() : trimmed;
}

// Returns null when the value fits the field, or why it does not.
export function fieldProblem(spec: FieldSpec, value: string): "required" | "short" | "long" | "format" | null {
  const normalized = normalize(spec, value);
  if (!normalized) return spec.kind === "text" && spec.optional ? null : "required";
  if (spec.kind === "choice") return spec.values.includes(normalized) ? null : "format";
  if (spec.kind === "reference") return /^[1-9]\d{0,15}$/.test(normalized) ? null : "format";
  if (normalized.length < spec.min) return "short";
  if (normalized.length > spec.max) return "long";
  return spec.pattern && !spec.pattern.test(normalized) ? "format" : null;
}

// Validates a whole create or update body. Every field is required in the body; empty optional text becomes null.
export function parseResourceInput(name: ResourceName, input: unknown): Record<string, string | number | null> | null {
  if (!input || typeof input !== "object") return null;
  const row: Record<string, string | number | null> = {};
  for (const [field, spec] of Object.entries(resources[name].fields) as [string, FieldSpec][]) {
    const raw = (input as Record<string, unknown>)[field];
    const value = typeof raw === "number" ? String(raw) : raw ?? "";
    if (typeof value !== "string" || fieldProblem(spec, value)) return null;
    const normalized = normalize(spec, value);
    row[field] = !normalized ? null : spec.kind === "reference" ? Number(normalized) : normalized;
  }
  return row;
}
