import { adminRequest, fail, loadPromptChains, noStore } from "@/lib/admin";
import { mixWeight } from "@/lib/admin-types";

// The prompt chain mix: GET returns every chain with its weight, PATCH replaces the weights.
// Body: { weights: [{ chainId, weight }] }, each weight a whole number from 0 to 100.
export async function GET(request: Request) {
  try {
    const admin = await adminRequest(request);
    if (admin instanceof Response) return admin;
    const chains = await loadPromptChains(admin.client);
    return Response.json(chains.map(({ id, purpose, name, weight, mix_updated_at: updatedAt }) => ({ chainId: id, purpose, name, weight, updatedAt })),
      { headers: noStore });
  } catch (error) {
    console.error("Failed to load the prompt chain mix:", error instanceof Error ? error.message : error);
    return fail("The mix could not be loaded. Please try again.", 500);
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = await adminRequest(request);
    if (admin instanceof Response) return admin;
    const weights = (await request.json().catch(() => null))?.weights;
    const valid = Array.isArray(weights) && weights.length > 0 && weights.length <= 100 && weights.every((entry) =>
      Number.isSafeInteger(entry?.chainId) && entry.chainId > 0
      && Number.isInteger(entry.weight) && entry.weight >= mixWeight.min && entry.weight <= mixWeight.max)
      && new Set(weights.map((entry: { chainId: number }) => entry.chainId)).size === weights.length;
    if (!valid) return fail(`Give each chain a whole-number weight from ${mixWeight.min} to ${mixWeight.max}.`, 400);
    const { error } = await admin.client.rpc("set_prompt_chain_mix", {
      p_weights: weights.map((entry: { chainId: number; weight: number }) => ({ chain_id: entry.chainId, weight: entry.weight })),
    }).abortSignal(AbortSignal.timeout(15_000));
    if (error?.code === "23503") return fail("Unknown prompt chain.", 404);
    if (error?.code === "23514") return fail("Each purpose needs at least one chain with a weight above 0.", 422);
    if (error) throw error;
    return GET(request);
  } catch (error) {
    console.error("Failed to update the prompt chain mix:", error instanceof Error ? error.message : error);
    return fail("The mix could not be saved. Please try again.", 500);
  }
}
