import type { SupabaseClient } from "@supabase/supabase-js";
import {
  adaptationParams, analysisParams, claudeModel, ClaudeError, messageDetails, parseAdaptation, parseAnalysis, sendMessage,
  type AdaptationResult, type AnalysisResult, type Effort, type GlossaryEntry, type ReferenceExample,
} from "@/lib/claude";
import { isAudienceId, type AudienceId } from "@/lib/jokes";

// Server-only runner for the app's AI requests. It picks a prompt chain from the mix configured in the admin area,
// runs its steps with the glossary and reference examples, and logs the request and every model call.
// Without the configuration (no database, or the migration is not applied yet) it runs the built-in defaults,
// and logging never fails a member's request.

export type GenerationSource = "share" | "explanation" | "admin";
type Purpose = "preview" | "adaptation";
type Step = { id: number | null; kind: "analysis" | "adaptation"; modelId: number | null; model: string; effort: Effort; maxTokens: number };
type Chain = { id: number | null; weight: number; steps: Step[] };
type Context = { chain: Chain; glossary: GlossaryEntry[]; examples: ReferenceExample[] };

const efforts: readonly Effort[] = ["low", "medium", "high", "xhigh", "max"];
const defaultSteps: Record<Purpose, Step> = {
  preview: { id: null, kind: "analysis", modelId: null, model: claudeModel, effort: "medium", maxTokens: 8_000 },
  adaptation: { id: null, kind: "adaptation", modelId: null, model: claudeModel, effort: "medium", maxTokens: 16_000 },
};
const fallback = (purpose: Purpose): Context => ({ chain: { id: null, weight: 1, steps: [defaultSteps[purpose]] }, glossary: [], examples: [] });
const logTimeout = () => AbortSignal.timeout(5_000);
const clip = (value: string, max: number) => (value.length > max ? `${value.slice(0, max - 1)}…` : value);
const message = (error: unknown) => clip(error instanceof Error ? error.message : String(error), 500) || "Unknown error.";

function readStep(value: unknown): Step | null {
  const step = value as { id?: unknown; kind?: unknown; model_id?: unknown; model?: unknown; effort?: unknown; max_tokens?: unknown } | null;
  if (!step || (step.kind !== "analysis" && step.kind !== "adaptation") || typeof step.model !== "string" || !step.model) return null;
  if (!efforts.includes(step.effort as Effort) || !Number.isSafeInteger(step.max_tokens)) return null;
  return {
    id: Number.isSafeInteger(step.id) ? step.id as number : null, kind: step.kind, modelId: Number.isSafeInteger(step.model_id) ? step.model_id as number : null,
    model: step.model, effort: step.effort as Effort, maxTokens: step.max_tokens as number,
  };
}

// Picks a chain at random, weighted by the mix; chains with a weight of 0 or without steps never run.
function pickChain(chains: Chain[], random = Math.random()) {
  const active = chains.filter((chain) => chain.weight > 0 && chain.steps.length > 0);
  const total = active.reduce((sum, chain) => sum + chain.weight, 0);
  let point = random * total;
  return active.find((chain) => (point -= chain.weight) < 0) ?? active.at(-1) ?? null;
}

const escapePattern = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// The database matches terms as substrings; English and Spanish terms must also stand as whole words.
export function matchGlossary(text: string, terms: GlossaryEntry[]) {
  const haystack = text.toLowerCase();
  return terms.filter(({ term, language }) => {
    const needle = term.toLowerCase();
    if (language === "zh") return haystack.includes(needle);
    return new RegExp(`(?<![\\p{L}\\p{N}])${escapePattern(needle)}(?![\\p{L}\\p{N}])`, "u").test(haystack);
  }).slice(0, 20);
}

async function loadContext(client: SupabaseClient | null, purpose: Purpose, text: string): Promise<Context> {
  if (!client) return fallback(purpose);
  const { data, error } = await client.rpc("ai_generation_context", { p_purpose: purpose, p_text: text }).abortSignal(logTimeout());
  if (error || !data) {
    console.error("Using the default prompt chain:", error?.message ?? "no configuration");
    return fallback(purpose);
  }
  const raw = data as { chains?: unknown[]; terms?: unknown[]; examples?: unknown[] };
  const chains = (raw.chains ?? []).map((value) => {
    const chain = value as { id?: unknown; weight?: unknown; steps?: unknown[] };
    const steps = (chain.steps ?? []).map(readStep);
    return {
      id: Number.isSafeInteger(chain.id) ? chain.id as number : null,
      // A chain with a step the app cannot run is skipped rather than run partially.
      weight: steps.every(Boolean) && Number.isSafeInteger(chain.weight) ? chain.weight as number : 0,
      steps: steps.filter((step): step is Step => step !== null),
    };
  });
  const chain = pickChain(chains);
  if (!chain) {
    console.error(`No active ${purpose} chain; using the default.`);
    return fallback(purpose);
  }
  const terms = (raw.terms ?? []).filter((entry): entry is GlossaryEntry => {
    const term = entry as Partial<GlossaryEntry> | null;
    return typeof term?.term === "string" && typeof term.definition === "string" && isAudienceId(term.language);
  });
  const examples = (raw.examples ?? []).filter((entry): entry is ReferenceExample => {
    const example = entry as Partial<ReferenceExample> | null;
    return isAudienceId(example?.source_language) && typeof example.en === "string" && typeof example.es === "string" && typeof example.zh === "string";
  });
  return { chain, glossary: matchGlossary(text, terms), examples };
}

type Log = { client: SupabaseClient | null; requestId: number | null };

async function openRequest(client: SupabaseClient | null, row: Record<string, unknown>): Promise<Log> {
  if (!client) return { client, requestId: null };
  const { data, error } = await client.from("generation_requests").insert(row).select("id").abortSignal(logTimeout()).maybeSingle();
  if (error) console.error("Failed to log an AI request:", error.message);
  return { client, requestId: data?.id ?? null };
}

async function closeRequest(log: Log, update: { status: "succeeded" | "unsuitable" | "rejected" | "failed"; error?: string; jokeId?: number }) {
  if (!log.client || log.requestId === null) return;
  const { error } = await log.client.from("generation_requests").update({
    status: update.status, completed_at: new Date().toISOString(),
    ...(update.error ? { error: clip(update.error, 500) } : {}), ...(update.jokeId ? { joke_id: update.jokeId } : {}),
  }).eq("id", log.requestId).abortSignal(logTimeout());
  if (error) console.error("Failed to finish an AI request log:", error.message);
}

// Runs one chain step as one Messages API request and logs it, whether it succeeds or fails.
async function runStep<T extends { suitable: boolean }>(log: Log, step: Step, params: { messages: { content: string }[] }, parse: (message: unknown) => T, signal?: AbortSignal) {
  const started = Date.now();
  let response: unknown = null;
  let outcome: { status: "succeeded" | "refused" | "failed"; error?: string; httpStatus?: number | null };
  try {
    response = await sendMessage(params, signal);
    const result = parse(response);
    outcome = { status: !result.suitable && messageDetails(response).stopReason === "refusal" ? "refused" : "succeeded", httpStatus: 200 };
    return result;
  } catch (error) {
    outcome = { status: "failed", error: message(error), httpStatus: error instanceof ClaudeError ? error.status : response ? 200 : null };
    throw error;
  } finally {
    if (log.client && log.requestId !== null) {
      const details = messageDetails(response);
      const { error } = await log.client.from("llm_responses").insert({
        request_id: log.requestId, step_id: step.id, kind: step.kind, model_id: step.modelId, model: step.model, effort: step.effort,
        prompt: clip(params.messages[0].content, 20_000), status: outcome!.status, http_status: outcome!.httpStatus ?? null,
        stop_reason: details.stopReason, input_tokens: details.inputTokens, output_tokens: details.outputTokens,
        cache_read_input_tokens: details.cacheReadInputTokens, cache_creation_input_tokens: details.cacheCreationInputTokens,
        duration_ms: Date.now() - started, answer: details.answer, error: outcome!.error ?? null,
      }).abortSignal(logTimeout());
      if (error) console.error("Failed to log a model response:", error.message);
    }
  }
}

type Who = { client: SupabaseClient | null; userId: string | null; source: GenerationSource; signal?: AbortSignal };

// The punchline preview a member confirms or corrects before sharing, in their interface language.
export async function previewJoke(who: Who, joke: string, locale: AudienceId): Promise<AnalysisResult> {
  const context = await loadContext(who.client, "preview", joke);
  const step = context.chain.steps.find((candidate) => candidate.kind === "analysis") ?? defaultSteps.preview;
  const log = await openRequest(who.client, { purpose: "preview", source: who.source, chain_id: context.chain.id, user_id: who.userId, input: joke, locale });
  try {
    const params = analysisParams(joke, locale, step.effort, { model: step.model, maxTokens: step.maxTokens, glossary: context.glossary });
    const result = await runStep(log, step, params, parseAnalysis, who.signal);
    await closeRequest(log, { status: result.suitable ? "succeeded" : "unsuitable" });
    return result;
  } catch (error) {
    await closeRequest(log, { status: "failed", error: message(error) });
    throw error;
  }
}

export type Adaptation = { result: AdaptationResult; requestId: number | null; client: SupabaseClient | null };

// The three cultural versions of a joke. A chain may first read the punchline itself; a human explanation
// (from the author or a community member) is authoritative and replaces that reading step.
export async function adaptJoke(who: Who & { jokeId?: number }, joke: string, explanation?: string): Promise<Adaptation> {
  const context = await loadContext(who.client, "adaptation", joke);
  const log = await openRequest(who.client, {
    purpose: "adaptation", source: who.source, chain_id: context.chain.id, user_id: who.userId, joke_id: who.jokeId ?? null,
    input: joke, explanation: explanation || null,
  });
  try {
    let reading = explanation || undefined;
    let ownReading = false;
    let result: AdaptationResult | null = null;
    for (const step of context.chain.steps) {
      const options = { model: step.model, maxTokens: step.maxTokens, glossary: context.glossary };
      if (step.kind === "analysis") {
        if (reading) continue;
        const analysis = await runStep(log, step, analysisParams(joke, "en", step.effort, options), parseAnalysis, who.signal);
        if (!analysis.suitable) {
          result = { suitable: false };
          break;
        }
        reading = analysis.punchline;
        ownReading = true;
        continue;
      }
      result = await runStep(log, step, adaptationParams(joke, step.effort, reading, { ...options, examples: context.examples }), parseAdaptation, who.signal);
      if (!result.suitable) break;
    }
    if (!result) throw new Error("The prompt chain has no adaptation step.");
    // The chain's own reading is not a member's explanation, so it can never be rejected as one.
    if (result.suitable && ownReading) result = { ...result, explanationAccepted: true };
    await closeRequest(log, { status: !result.suitable ? "unsuitable" : result.explanationAccepted ? "succeeded" : "rejected" });
    return { result, requestId: log.requestId, client: log.client };
  } catch (error) {
    await closeRequest(log, { status: "failed", error: message(error) });
    throw error;
  }
}

// After an adaptation: link the stored joke, or record why the route could not use the versions.
export async function settleAdaptation(adaptation: Adaptation, outcome: { jokeId: number } | { error: string }) {
  await closeRequest({ client: adaptation.client, requestId: adaptation.requestId },
    "jokeId" in outcome ? { status: "succeeded", jokeId: outcome.jokeId } : { status: "failed", error: outcome.error });
}
