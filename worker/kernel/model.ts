import type { Env } from "../env";
import type { Tool } from "./tools";

export type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };

export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export type Turn = { content: string; toolCalls: ToolCall[]; tokensIn: number; tokensOut: number };

type Block = { type: 'text'; text: string } | { type: 'tool_use'; id: string; name: string; input: unknown } | { type: 'tool_result'; tool_use_id: string; content: string };

function anthropicTranscript(messages: ChatMessage[]) {
  const turns: { role: 'user' | 'assistant'; content: Block[] }[] = [];
  for (const m of messages) {
    if (m.role === 'system') continue;
    const role = m.role === 'assistant' ? 'assistant' : 'user';
    const blocks: Block[] = [];
    if (m.role === 'tool') blocks.push({ type: 'tool_result', tool_use_id: m.tool_call_id, content: m.content });
    else if (m.content) blocks.push({ type: 'text', text: m.content });
    if (m.role === 'assistant') for (const c of m.tool_calls ?? []) {
      blocks.push({ type: 'tool_use', id: c.id, name: c.function.name, input: JSON.parse(c.function.arguments) });
    }
    const last = turns.at(-1);
    if (last?.role === role) last.content.push(...blocks);
    else turns.push({ role, content: blocks });
  }
  return turns;
}

/** Both chat and the run loop pass through this server-only protocol boundary. */
export async function liveTurn(env: Env, messages: ChatMessage[], tools: Tool[], maxTokens = 1200, timeout = 45_000): Promise<Turn> {
  const base = env.LLM_BASE_URL?.trim().replace(/\/+$/, '');
  const key = env.LLM_API_KEY?.trim();
  const protocol = env.LLM_PROTOCOL?.trim() || 'openai';
  if (!base || !key) throw new Error('No model is configured on the worker.');
  if (!['openai', 'anthropic'].includes(protocol)) throw new Error('Unsupported LLM_PROTOCOL.');
  const native = protocol === 'anthropic';
  const model = env.LLM_MODEL?.trim() || (native ? '' : 'gpt-4o-mini');
  if (!model) throw new Error('Set LLM_MODEL to a model offered by the provider.');
  const headers: Record<string, string> = native ? { 'x-api-key': key, 'anthropic-version': '2023-06-01' } : { authorization: `Bearer ${key}` };
  const res = await fetch(`${base}/${native ? 'messages' : 'chat/completions'}`, {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(timeout), headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: maxTokens,
      ...(native ? { system: messages.filter(m => m.role === 'system').map(m => m.content).join('\n'), messages: anthropicTranscript(messages) } : { messages }),
      ...(tools.length ? { tools: tools.map(t => native ? { name: t.name, description: t.description, input_schema: t.parameters } : { type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } }) } : {}),
    }),
  });
  if (!res.ok) throw new Error(`Model request failed (HTTP ${res.status}). Check the endpoint, model ID and credentials.`);
  if (native) {
    const data = await res.json() as { content?: Block[]; usage?: { input_tokens: number; output_tokens: number } };
    if (!Array.isArray(data.content)) throw new Error('Model returned no message.');
    return { content: data.content.flatMap(b => b.type === 'text' ? [b.text] : []).join('\n').trim(),
      toolCalls: data.content.flatMap(b => b.type === 'tool_use' ? [{ type: 'function' as const, id: b.id, function: { name: b.name, arguments: JSON.stringify(b.input) } }] : []),
      tokensIn: data.usage?.input_tokens ?? 0, tokensOut: data.usage?.output_tokens ?? 0 };
  }
  const data = await res.json() as { choices?: { message?: { content?: string | null; tool_calls?: ToolCall[] } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } };
  const message = data.choices?.[0]?.message;
  if (!message) throw new Error('Model returned no message.');
  return { content: typeof message.content === 'string' ? message.content.trim() : '', toolCalls: (message.tool_calls ?? []).filter(c => c?.function?.name).map(c => ({ ...c, id: c.id || `call_${crypto.randomUUID()}` })),
    tokensIn: data.usage?.prompt_tokens ?? 0, tokensOut: data.usage?.completion_tokens ?? 0 };
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
