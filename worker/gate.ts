import type { Env } from "./env";

const buckets = new Map<string, { n: number; reset: number }>();

export function tokenMatches(expected: string, presented: string | undefined): boolean {
  if (!presented) return false;
  const a = new TextEncoder().encode(expected);
  const b = new TextEncoder().encode(presented);
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

/** Live model calls require LLM secrets and a matching OPERATOR_TOKEN. */
export function llmMode(env: Env, presented: string | undefined): "demo" | "gated" | "live" {
  const base = env.LLM_BASE_URL?.trim();
  const key = env.LLM_API_KEY?.trim();
  const token = env.OPERATOR_TOKEN?.trim();
  if (!base || !key || !token) return "demo";
  return tokenMatches(token, presented?.trim()) ? "live" : "gated";
}

export function tooMany(ip: string, bucket: string, max = 40, windowMs = 60_000): boolean {
  const now = Date.now();
  const id = `${bucket}:${ip || "unknown"}`;
  const row = buckets.get(id);
  if (!row || now > row.reset) {
    if (buckets.size > 5000) buckets.clear();
    buckets.set(id, { n: 1, reset: now + windowMs });
    return false;
  }
  row.n += 1;
  return row.n > max;
}
