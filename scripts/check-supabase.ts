import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import nextConfig from "../next.config";
import { categories, filterHumor, loadHumor } from "../lib/humor";

// Match Next.js build-time aliases when running the standalone integration check.
for (const [name, value] of Object.entries(nextConfig.env ?? {})) {
  if (value !== undefined) process.env[name] = value;
}

const anonKey = `header.${Buffer.from(JSON.stringify({ role: "anon" })).toString("base64url")}.signature`;
const serviceKey = `header.${Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url")}.signature`;
const configCheck = `
  import assert from "node:assert/strict";
  import config from "./next.config.ts";
  assert.deepEqual(Object.keys(config.env).sort(), ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_URL"]);
  assert.equal(config.env.NEXT_PUBLIC_SUPABASE_URL, "https://example.supabase.co");
  assert.equal(config.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, process.env.EXPECTED_KEY);
`;
for (const keyName of ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY"]) {
  const key = keyName.endsWith("ANON_KEY") ? anonKey : "sb_publishable_example";
  const result = spawnSync(process.execPath, ["--no-env-file", "-e", configCheck], {
    env: {
      NODE_ENV: "test",
      [keyName.startsWith("NEXT_PUBLIC") ? "NEXT_PUBLIC_SUPABASE_URL" : "SUPABASE_URL"]: "https://example.supabase.co",
      [keyName]: key, EXPECTED_KEY: key, SUPABASE_SERVICE_ROLE_KEY: serviceKey,
    },
    encoding: "utf8",
  });
  assert.equal(result.status, 0, `${keyName}: ${result.stderr}`);
}
for (const key of ["sb_secret_example", serviceKey, "invalid-key"]) {
  const result = spawnSync(process.execPath, ["--no-env-file", "-e", 'import "./next.config.ts";'], {
    env: { NODE_ENV: "test", SUPABASE_PUBLISHABLE_KEY: key }, encoding: "utf8",
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Only a Supabase publishable or anon key/);
}

// Live, read-only integration check; run with bun run check:supabase.
const entries = await loadHumor();
assert(entries.length >= 9, "Seed the nine demo entries before running this check.");
assert.equal(new Set(entries.map((entry) => entry.id)).size, entries.length);
assert(entries.every((entry) =>
  entry.title && entry.setup && entry.punchline && entry.author &&
  categories.includes(entry.category) && Number.isInteger(entry.likes) && entry.likes >= 0 &&
  Number.isFinite(Date.parse(entry.created_at)),
));
const first = entries[0];
assert(filterHumor(entries, first.category, `  ${first.title.toUpperCase()}  `).some((entry) => entry.id === first.id));
assert(filterHumor(entries, "Code", "").every((entry) => entry.category === "Code"));
assert.equal(filterHumor(entries, "All", "__no_matching_humor__").length, 0);
assert.equal(filterHumor([], "All", "").length, 0);
await assert.rejects(loadHumor(AbortSignal.abort()), /could not load/);
console.log(`PASS: Environment aliases and private-key rejection verified; Supabase returned ${entries.length} valid entries; filters and cancellation verified.`);
