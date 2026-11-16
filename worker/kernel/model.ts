import type { Env } from "../env";
import type { Tool } from "./tools";

export type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };

export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export type Turn = { content: string; toolCalls: ToolCall[]; tokensIn: number; tokensOut: number };

/** One model turn against any OpenAI-compatible chat-completions endpoint. Throws on failure. */
export async function liveTurn(env: Env, messages: ChatMessage[], tools: Tool[]): Promise<Turn> {
  const base = env.LLM_BASE_URL?.trim().replace(/\/$/, "");
  const key = env.LLM_API_KEY?.trim();
  if (!base || !key) throw new Error("No model is configured on the worker.");
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    signal: AbortSignal.timeout(45_000),
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: env.LLM_MODEL?.trim() || "gpt-4o-mini",
      messages,
      tools: tools.map((t) => ({
        type: "function",
        function: { name: t.name, description: t.description, parameters: t.parameters },
      })),
      max_tokens: 1200,
    }),
  });
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300);
    throw new Error(`Model call failed (${res.status}). ${detail}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string | null; tool_calls?: ToolCall[] } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const message = data.choices?.[0]?.message;
  if (!message) throw new Error("Model returned no message.");
  const toolCalls = (message.tool_calls ?? [])
    .filter((c) => c?.function?.name)
    .map((c) => ({
      id: c.id || `call_${crypto.randomUUID().slice(0, 8)}`,
      type: "function" as const,
      function: { name: c.function.name, arguments: c.function.arguments || "{}" },
    }));
  return {
    content: typeof message.content === "string" ? message.content.trim() : "",
    toolCalls,
    tokensIn: data.usage?.prompt_tokens ?? 0,
    tokensOut: data.usage?.completion_tokens ?? 0,
  };
}

const STOP = new Set(["about", "after", "before", "check", "could", "every", "should", "their", "there", "these", "this", "what", "which", "with", "would", "that", "from", "have", "into", "please", "status", "write", "summary", "summarize"]);

function call(name: string, args: Record<string, unknown>): ToolCall {
  return { id: `call_${crypto.randomUUID().slice(0, 8)}`, type: "function", function: { name, arguments: JSON.stringify(args) } };
}

function parse(text: string): Record<string, unknown> {
  try {
    const value = JSON.parse(text) as unknown;
    return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/**
 * Stand-in for a model when no key is set. It follows one fixed plan (read, then propose a
 * write, then report) so the loop, tools, approvals, and trace are all real and only the
 * "thinking" is scripted.
 */
export function demoTurn(messages: ChatMessage[], tools: Tool[]): Turn {
  const goal = messages.find((m) => m.role === "user")?.content ?? "";
  const stage = messages.filter((m) => m.role === "assistant").length;
  const has = (name: string) => tools.some((t) => t.name === name);
  const done = (content: string, toolCalls: ToolCall[] = []): Turn => ({ content, toolCalls, tokensIn: 0, tokensOut: 0 });

  if (stage === 0) {
    const words = goal.toLowerCase().match(/[a-z0-9-]{4,}/g)?.filter((w) => !STOP.has(w)) ?? [];
    const query = [...new Set(words)].sort((a, b) => b.length - a.length).slice(0, 2).join(" ");
    return done("Reading memory and the mission board first.", [
      call("memory_search", { query }),
      call("missions_status", {}),
    ]);
  }

  const results = messages.filter((m) => m.role === "tool").map((m) => parse(m.content));
  const notes = (results.find((r) => Array.isArray(r.notes))?.notes ?? []) as { title: string; path: string; status: string }[];
  const actions = (results.find((r) => Array.isArray(r.actions))?.actions ?? []) as { title: string; owner: string; status: string }[];
  const open = actions.filter((a) => a.status !== "complete");
  const stale = notes.filter((n) => n.status !== "fresh");
  const short = goal.length > 70 ? `${goal.slice(0, 70)}…` : goal;

  if (stage === 1) {
    const lines = [
      `Goal: ${goal}`,
      "",
      `Memory: ${notes.length} matching note${notes.length === 1 ? "" : "s"}${stale.length ? `, ${stale.length} not fresh` : ""}.`,
      ...notes.slice(0, 6).map((n) => `- ${n.title} (${n.path}, ${n.status})`),
      "",
      `Mission board: ${open.length} of ${actions.length} actions still open.`,
      ...open.slice(0, 6).map((a) => `- ${a.title} (${a.owner}, ${a.status})`),
    ];
    const body = lines.join("\n");
    if (has("document_write")) {
      return done("I have what I need. Filing the findings needs your approval.", [
        call("document_write", { title: `Run note: ${short}`, description: "Findings filed by a demo run.", body: `# Run note\n\n${body}` }),
      ]);
    }
    if (has("memory_write")) {
      return done("I have what I need. Saving the findings needs your approval.", [
        call("memory_write", { title: `Run note: ${short}`, summary: body }),
      ]);
    }
    if (has("inbox_post")) {
      return done("I have what I need. Sending you the findings needs your approval.", [
        call("inbox_post", { title: `Run note: ${short}`, preview: `${notes.length} notes matched, ${open.length} of ${actions.length} mission actions open.` }),
      ]);
    }
  }

  const write = results.find((r) => r.saved || r.posted || r.error);
  const outcome = !write
    ? "This agent has no write tools, so nothing was changed."
    : write.error
      ? "The write did not happen, so nothing was changed."
      : "The findings are filed.";
  return done(
    `Read ${notes.length} memory note${notes.length === 1 ? "" : "s"} and ${actions.length} mission actions (${open.length} open). ${outcome}\n\nThis run used the scripted demo planner. Set a model on the worker to have the agent plan for itself.`,
  );
}
