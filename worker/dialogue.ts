import { liveTurn } from "./kernel/model";
import type { Env } from "./env";

const NAMES: Record<string, string> = {
  marshal: "Marshal",
  forge: "Forge",
  atlas: "Atlas",
  relay: "Relay",
  beacon: "Beacon",
  keeper: "Keeper",
  nightwatch: "Nightwatch",
  arona: "ARONA",
};

export function agentName(id: string): string {
  return NAMES[id] ?? id;
}

export function demoReply(
  agentId: string,
  prompt: string,
  opts: { shared: boolean; mission: string },
): string {
  const q = prompt.trim().replace(/\s+/g, " ");
  const mem = opts.shared
    ? "Shared memory is on, so this answer can use the vault."
    : "Shared memory is off, so this answer stays inside the thread.";
  switch (agentId) {
    case "marshal":
      return `Filed against “${opts.mission}”.\n\nI’ll treat “${q}” as an operator request. ${mem} Atlas can check the notes, Forge can change the repo, and I will ask again before anyone spends a frontier model.`;
    case "forge":
      return `I can take “${q}” as a patch only after you confirm. The worker build, D1 seed, and /api/health stay the definition of done. ${mem}`;
    case "atlas":
      return `On “${q}”: the current brief is vault/workers-deploy/asset-limits.md. I should not write a fourth copy. Community playbooks are 16 days stale, and the two compat-date notes still disagree (2026-04-01 vs 2026-11-01). ${mem}`;
    case "relay":
      return `Triaged “${q}”. Deploy and repo language routes to Forge. Notes and conflicts route to Keeper. Anything that spends money routes to Marshal first. ${mem}`;
    case "beacon":
      return `Draft only, not scheduled. For “${q}” I would write three short options in KuletXAI’s voice and leave the post for you. Hook Workshop is dormant, so I will not call it. ${mem}`;
    case "keeper":
      return `I can file “${q}” in Archive with a title and a date. Open conflict: workers-deploy/compat-date.md versus agents-platform/compat-date.md. I will not merge those silently. ${mem}`;
    case "nightwatch":
      return `Overnight desk is unchanged. “${q}” does not clear a card by itself. Four cards are open: stale playbooks, frontier tokens on file reads, the brief/changelog pair, and the repeated asset-limit research. ${mem}`;
    case "arona":
      return `Link is stable. I heard “${q}”.\n\nI can open Lobby, Dream, Missions, Craft, Cortex, or Archive, or I can ask Marshal to dispatch. ${mem} This console is in demo mode until a model secret is set on the worker.`;
    default:
      return `Noted: “${q}”. ${mem}`;
  }
}

export async function maybeModelReply(
  env: Env,
  agentId: string,
  prompt: string,
  soul: string,
): Promise<string | null> {
  try {
    const turn = await liveTurn(env, [
      { role: 'system', content: `${soul}\nYou are ${agentName(agentId)} inside KuletXAI. Stay in product scope. Do not invent live account access. If you lack a tool, say the console is answering from the demo vault.` },
      { role: 'user', content: prompt },
    ], [], 420, 12_000);
    return turn.content || null;
  } catch {
    return null;
  }
}
