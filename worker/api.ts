import { Hono } from "hono";
import { agentName, demoReply, maybeModelReply } from "./dialogue";
import { llmMode, tooMany } from "./gate";
import type { Env } from "./env";
import { OP } from "./env";
import { ensureReady } from "./seed";
import { hoursAgo, manilaHour, nextManila } from "./time";

export const app = new Hono<{ Bindings: Env }>();

app.use("/api/*", async (c, next) => {
  await ensureReady(c.env);
  await next();
});

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: err instanceof Error ? err.message : "request failed" }, 500);
});

function rangeDays(range: string | undefined): number {
  if (range === "1d" || range === "today") return 1;
  if (range === "28d") return 28;
  return 7;
}

async function readConfig(env: Env): Promise<Record<string, unknown>> {
  const row = await env.DB.prepare("SELECT json FROM config WHERE operator_id = ?1")
    .bind(OP)
    .first<{ json: string }>();
  if (!row) return {};
  try {
    return JSON.parse(row.json) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function writeConfig(env: Env, json: Record<string, unknown>) {
  const text = JSON.stringify(json);
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO config (operator_id, json, updated_at) VALUES (?1,?2,?3)
     ON CONFLICT(operator_id) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at`,
  )
    .bind(OP, text, now)
    .run();
  try {
    await env.CONFIG.put(`operator:${OP}`, text);
  } catch (err) {
    console.error("kv config write failed", err);
  }
}

async function logActivity(
  env: Env,
  actor: string,
  action: string,
  target: string,
  status = "ok",
  cost = 0,
  tokens = 0,
) {
  await env.DB.prepare(
    `INSERT INTO activity (id, operator_id, at, actor, action, target, status, cost, tokens)
     VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)`,
  )
    .bind(crypto.randomUUID(), OP, new Date().toISOString(), actor, action, target, status, cost, tokens)
    .run();
}

async function rateOf(env: Env): Promise<number> {
  const cfg = await readConfig(env);
  const rate = Number(cfg.hourlyRate);
  if (Number.isFinite(rate) && rate > 0) return rate;
  const op = await env.DB.prepare("SELECT hourly_rate FROM operators WHERE id = ?1")
    .bind(OP)
    .first<{ hourly_rate: number }>();
  return op?.hourly_rate ?? 150;
}

app.get("/api/health", async (c) => {
  const [op, agents, actions, budget, tokens, runtimes] = await Promise.all([
    c.env.DB.prepare("SELECT name, workspace, env FROM operators WHERE id = ?1")
      .bind(OP)
      .first<{ name: string; workspace: string; env: string }>(),
    c.env.DB.prepare("SELECT COUNT(*) AS n FROM agents WHERE operator_id = ?1")
      .bind(OP)
      .first<{ n: number }>(),
    c.env.DB.prepare(
      "SELECT SUM(status = 'complete') AS done, COUNT(*) AS total FROM mission_actions",
    ).first<{ done: number; total: number }>(),
    c.env.DB.prepare("SELECT used, cap FROM usage_windows WHERE id = 'win-router'")
      .first<{ used: number; cap: number }>(),
    c.env.DB.prepare("SELECT tokens FROM usage_days WHERE operator_id = ?1 ORDER BY day DESC LIMIT 1")
      .bind(OP)
      .first<{ tokens: number }>(),
    c.env.DB.prepare("SELECT id, name, status, detail FROM runtimes WHERE operator_id = ?1")
      .bind(OP)
      .all(),
  ]);
  return c.json({
    ok: true,
    d1: true,
    mode: "demo",
    llm: llmMode(c.env, c.req.header("x-kuletx-token")),
    hud: {
      budgetLeft: budget ? Math.round((budget.cap - budget.used) * 100) / 100 : 0,
      budgetCap: budget?.cap ?? 0,
      tokensToday: tokens?.tokens ?? 0,
      tasksDone: actions?.done ?? 0,
      tasksTotal: actions?.total ?? 0,
      agentsActive: agents?.n ?? 0,
      operator: op?.name ?? "Kulet",
      workspace: op?.workspace ?? "~/kuletx/agents",
      env: op?.env ?? "demo",
    },
    runtimes: runtimes.results ?? [],
    greetingHour: manilaHour(),
  });
});

app.get("/api/config", async (c) => {
  return c.json(await readConfig(c.env));
});

app.put("/api/config", async (c) => {
  const body = (await c.req.json()) as Record<string, unknown>;
  const current = await readConfig(c.env);
  const next = { ...current, ...body };
  if (typeof next.hourlyRate === "number") {
    await c.env.DB.prepare("UPDATE operators SET hourly_rate = ?1 WHERE id = ?2")
      .bind(next.hourlyRate, OP)
      .run();
  }
  await writeConfig(c.env, next);
  await logActivity(c.env, "Kulet", "updated config", "operator config");
  return c.json(next);
});

app.get("/api/dashboard", async (c) => {
  const days = rangeDays(c.req.query("range"));
  const rate = await rateOf(c.env);
  const daysRows = await c.env.DB.prepare(
    "SELECT day, spent, hours_saved, sessions, focus_hours, tokens FROM usage_days WHERE operator_id = ?1 ORDER BY day ASC",
  )
    .bind(OP)
    .all<{
      day: string;
      spent: number;
      hours_saved: number;
      sessions: number;
      focus_hours: number;
      tokens: number;
    }>();
  const all = daysRows.results ?? [];
  const slice = all.slice(-days);
  const prev = all.slice(-(days * 2), -days);
  const sum = (rows: typeof all, key: "spent" | "hours_saved" | "sessions" | "focus_hours") =>
    rows.reduce((a, r) => a + Number(r[key]), 0);
  const spent = sum(slice, "spent");
  const spentPrev = sum(prev, "spent");
  const hours = sum(slice, "hours_saved");
  const hoursPrev = sum(prev, "hours_saved");
  const saved = hours * rate;
  const savedPrev = hoursPrev * rate;
  const subs = await c.env.DB.prepare(
    "SELECT id, provider, plan, monthly_price AS monthlyPrice, accent FROM subscriptions WHERE operator_id = ?1",
  )
    .bind(OP)
    .all();
  const windows = await c.env.DB.prepare(
    "SELECT id, provider, label, used, cap, unit, resets FROM usage_windows WHERE operator_id = ?1",
  )
    .bind(OP)
    .all();
  const dreams = await c.env.DB.prepare(
    "SELECT * FROM dream_items WHERE operator_id = ?1 AND status = 'open' ORDER BY sort",
  )
    .bind(OP)
    .all();
  const skills = await c.env.DB.prepare(
    "SELECT * FROM skills WHERE operator_id = ?1 ORDER BY hours_saved_28d DESC",
  )
    .bind(OP)
    .all<{
      id: string;
      name: string;
      category: string;
      invocations: number;
      est_minutes: number;
      hours_saved_28d: number;
      state: string;
    }>();
  const mem = await c.env.DB.prepare(
    `SELECT
       SUM(status = 'stale') AS stale,
       SUM(status = 'conflict') AS conflicts,
       SUM(status = 'missing') AS missing,
       COUNT(*) AS notes
     FROM memories WHERE operator_id = ?1`,
  )
    .bind(OP)
    .first<{ stale: number; conflicts: number; missing: number; notes: number }>();
  const signals = await c.env.DB.prepare(
    "SELECT action, path, at FROM memory_activity WHERE operator_id = ?1 ORDER BY at DESC LIMIT 4",
  )
    .bind(OP)
    .all();
  const integrations = await c.env.DB.prepare(
    "SELECT id, name, category, connected, last_sync AS lastSync, detail FROM integrations WHERE operator_id = ?1",
  )
    .bind(OP)
    .all();
  const knowledge = await c.env.DB.prepare(
    "SELECT id, name, kind, count_label AS countLabel, last_sync AS lastSync FROM knowledge_systems WHERE operator_id = ?1",
  )
    .bind(OP)
    .all();
  const schedules = await c.env.DB.prepare(
    "SELECT id, name, cadence, last_run AS lastRun, next_run AS nextRun, status, enabled FROM schedules WHERE operator_id = ?1",
  )
    .bind(OP)
    .all();
  const flat = (subs.results ?? []).reduce(
    (a, s) => a + Number((s as { monthlyPrice: number }).monthlyPrice),
    0,
  );
  const skillRows = skills.results ?? [];
  const factor = days / 28;
  return c.json({
    range: days === 1 ? "1d" : days === 28 ? "28d" : "7d",
    rate,
    flatMonthly: flat,
    kpis: {
      spent: {
        value: round2(spent),
        delta: pct(spent, spentPrev),
        series: slice.map((r) => r.spent),
      },
      saved: {
        value: round2(saved),
        hours: round2(hours),
        delta: pct(saved, savedPrev),
        series: slice.map((r) => r.hours_saved * rate),
      },
      roi: {
        value: round2(saved - spent),
        delta: pct(saved - spent, savedPrev - spentPrev),
        multiple: spent > 0 ? round2(saved / spent) : 0,
        series: slice.map((r) => r.hours_saved * rate - r.spent),
      },
    },
    sessions: {
      count: sum(slice, "sessions"),
      focus: round2(sum(slice, "focus_hours")),
      delta: pct(sum(slice, "sessions"), sum(prev, "sessions")),
      series: slice.map((r) => ({ day: r.day, sessions: r.sessions, focus: r.focus_hours })),
    },
    subscriptions: subs.results ?? [],
    windows: windows.results ?? [],
    dreams: (dreams.results ?? []).map(hydrateDream),
    skills: skillRows.slice(0, 5).map((s) => ({
      ...s,
      saved: round2(s.hours_saved_28d * factor * rate),
    })),
    recommended: skillRows
      .filter((s) => s.state !== "active")
      .map((s) => ({ id: s.id, name: s.name, state: s.state, category: s.category })),
    memory: {
      notes: mem?.notes ?? 0,
      stale: mem?.stale ?? 0,
      conflicts: mem?.conflicts ?? 0,
      missing: mem?.missing ?? 0,
      signals: signals.results ?? [],
    },
    integrations: integrations.results ?? [],
    knowledge: knowledge.results ?? [],
    schedules: schedules.results ?? [],
    syncedAt: new Date().toISOString(),
  });
});

app.get("/api/dreams", async (c) => {
  const rows = await c.env.DB.prepare(
    "SELECT * FROM dream_items WHERE operator_id = ?1 ORDER BY sort",
  )
    .bind(OP)
    .all();
  const items = (rows.results ?? []).map(hydrateDream);
  return c.json({
    items,
    open: items.filter((i) => i.status === "open").length,
    generatedAt: items[0]?.generated_at ?? null,
    generatedBy: "Nightwatch",
  });
});

app.post("/api/dreams/run", async (c) => {
  const result = await runDream(c.env, "manual");
  return c.json(result);
});

app.post("/api/dreams/:id/ack", async (c) => {
  const id = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as { action?: string };
  const action = body.action;
  if (action !== "apply" && action !== "skip" && action !== "restore") {
    return c.json({ error: "action must be apply, skip, or restore" }, 400);
  }
  const item = await c.env.DB.prepare("SELECT * FROM dream_items WHERE id = ?1 AND operator_id = ?2")
    .bind(id, OP)
    .first<{ id: string; category: string; title: string }>();
  if (!item) return c.json({ error: "not found" }, 404);
  const status = action === "restore" ? "open" : action === "apply" ? "applied" : "skipped";
  await c.env.DB.prepare("UPDATE dream_items SET status = ?1 WHERE id = ?2").bind(status, id).run();
  if (action === "apply") await applyDreamSideEffect(c.env, item.category, item.title);
  await logActivity(c.env, "Kulet", action === "apply" ? "applied dream card" : action === "skip" ? "skipped dream card" : "restored dream card", item.title);
  const open = await c.env.DB.prepare(
    "SELECT COUNT(*) AS n FROM dream_items WHERE operator_id = ?1 AND status = 'open'",
  )
    .bind(OP)
    .first<{ n: number }>();
  return c.json({ ok: true, status, open: open?.n ?? 0 });
});

app.get("/api/skills", async (c) => {
  const rate = await rateOf(c.env);
  const rows = await c.env.DB.prepare(
    "SELECT * FROM skills WHERE operator_id = ?1 ORDER BY hours_saved_28d DESC",
  )
    .bind(OP)
    .all();
  const skills = (rows.results ?? []).map((s) => {
    const row = s as {
      hours_saved_28d: number;
      est_minutes: number;
      invocations: number;
      state: string;
    };
    return {
      ...row,
      saved: round2(row.hours_saved_28d * rate),
    };
  });
  const hours = skills.reduce((a, s) => a + Number((s as { hours_saved_28d: number }).hours_saved_28d), 0);
  const counts = {
    total: skills.length,
    active: skills.filter((s) => (s as { state: string }).state === "active").length,
    dormant: skills.filter((s) => (s as { state: string }).state === "dormant").length,
    dead: skills.filter((s) => (s as { state: string }).state === "dead").length,
    invocations: skills.reduce((a, s) => a + Number((s as { invocations: number }).invocations), 0),
  };
  return c.json({ rate, hours: round2(hours), saved: round2(hours * rate), counts, skills });
});

app.post("/api/skills/compose", async (c) => {
  const body = (await c.req.json()) as { ids?: string[] };
  const ids = (body.ids ?? []).slice(0, 4);
  if (ids.length < 2) return c.json({ error: "pick two skills" }, 400);
  const marks = ids.map((_, i) => `?${i + 2}`).join(",");
  const rows = await c.env.DB.prepare(
    `SELECT * FROM skills WHERE operator_id = ?1 AND id IN (${marks})`,
  )
    .bind(OP, ...ids)
    .all<{ name: string; est_minutes: number; category: string; hours_saved_28d: number }>();
  const found = rows.results ?? [];
  if (found.length < 2) return c.json({ error: "skills not found" }, 404);
  const id = `composed-${ids.slice(0, 2).join("-")}`.slice(0, 48);
  const name = found.map((f) => f.name).join(" + ");
  await c.env.DB.prepare(
    `INSERT INTO skills (id, operator_id, name, category, description, invocations, last_used, avg_tokens, est_minutes, error_rate, state, hours_saved_28d)
     VALUES (?1,?2,?3,?4,?5,0,?6,0,?7,0,'active',0)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, description = excluded.description, est_minutes = excluded.est_minutes, state = 'active'`,
  )
    .bind(
      id,
      OP,
      name,
      found[0].category,
      `Composed from ${name}. Demo skill, ready for a runtime to pick up.`,
      new Date().toISOString(),
      found.reduce((a, f) => a + f.est_minutes, 0),
    )
    .run();
  await logActivity(c.env, "Kulet", "composed skills", name);
  return c.json({ ok: true, id, name });
});

app.post("/api/skills/:id", async (c) => {
  const id = c.req.param("id");
  const body = (await c.req.json()) as { state?: string };
  if (!body.state || !["active", "dormant", "dead"].includes(body.state)) {
    return c.json({ error: "bad state" }, 400);
  }
  const res = await c.env.DB.prepare(
    "UPDATE skills SET state = ?1 WHERE id = ?2 AND operator_id = ?3",
  )
    .bind(body.state, id, OP)
    .run();
  if (!res.meta.changes) return c.json({ error: "not found" }, 404);
  await logActivity(c.env, "Kulet", "set skill state", `${id} → ${body.state}`);
  return c.json({ ok: true });
});

app.get("/api/memory", async (c) => {
  const sources = await c.env.DB.prepare(
    "SELECT id, name, enabled, last_indexed AS lastIndexed FROM memory_sources WHERE operator_id = ?1",
  )
    .bind(OP)
    .all<{ id: string; name: string; enabled: number; lastIndexed: string }>();
  const enabled = new Set(
    (sources.results ?? []).filter((s) => s.enabled).map((s) => s.id),
  );
  const nodes = await c.env.DB.prepare("SELECT * FROM memories WHERE operator_id = ?1")
    .bind(OP)
    .all<{
      id: string;
      source: string;
      kind: string;
      status: string;
      sector: string;
      workspace: string;
    }>();
  const visible = (nodes.results ?? []).filter(
    (n) => enabled.has(n.source) || n.kind === "core" || n.source === "profile",
  );
  const ids = new Set(visible.map((n) => n.id));
  const edges = await c.env.DB.prepare(
    "SELECT id, source_id AS source, target_id AS target FROM memory_edges WHERE operator_id = ?1",
  )
    .bind(OP)
    .all<{ id: string; source: string; target: string }>();
  const activity = await c.env.DB.prepare(
    "SELECT id, action, path, at FROM memory_activity WHERE operator_id = ?1 ORDER BY at DESC LIMIT 12",
  )
    .bind(OP)
    .all();
  const stale = visible.filter((n) => n.status === "stale");
  const bad = visible.filter((n) => n.status === "conflict" || n.status === "missing");
  return c.json({
    nodes: visible,
    edges: (edges.results ?? []).filter((e) => ids.has(e.source) && ids.has(e.target)),
    sources: sources.results ?? [],
    activity: activity.results ?? [],
    stale,
    issues: bad,
    stats: {
      notes: visible.length,
      stale: stale.length,
      conflicts: visible.filter((n) => n.status === "conflict").length,
      missing: visible.filter((n) => n.status === "missing").length,
      workspaces: new Set(visible.map((n) => n.workspace)).size,
    },
  });
});

app.post("/api/memory/refresh", async (c) => {
  const now = new Date().toISOString();
  await c.env.DB.prepare("UPDATE memory_sources SET last_indexed = ?1 WHERE operator_id = ?2")
    .bind(now, OP)
    .run();
  await c.env.DB.prepare(
    "INSERT INTO memory_activity (id, operator_id, action, path, at) VALUES (?1,?2,'VECTORIZE',?3,?4)",
  )
    .bind(crypto.randomUUID(), OP, "core/index", now)
    .run();
  await logActivity(c.env, "Keeper", "refreshed memory index", "all enabled sources");
  return c.json({ ok: true, indexedAt: now });
});

app.post("/api/memory/sources/:id", async (c) => {
  const id = c.req.param("id");
  const body = (await c.req.json()) as { enabled?: boolean };
  await c.env.DB.prepare(
    "UPDATE memory_sources SET enabled = ?1 WHERE id = ?2 AND operator_id = ?3",
  )
    .bind(body.enabled ? 1 : 0, id, OP)
    .run();
  return c.json({ ok: true });
});

app.post("/api/memory/notes", async (c) => {
  const body = (await c.req.json()) as { title?: string; summary?: string; path?: string };
  const title = (body.title || "Thread note").slice(0, 120);
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO memories (id, operator_id, title, path, workspace, source, kind, status, summary, x, y, sector, updated_at)
     VALUES (?1,?2,?3,?4,'agents-platform','profile','note','fresh',?5,54,46,'notes',?6)`,
  )
    .bind(
      id,
      OP,
      title,
      body.path || `threads/${id}.md`,
      body.summary || title,
      new Date().toISOString(),
    )
    .run();
  await logActivity(c.env, "Keeper", "saved thread to memory", title);
  return c.json({ ok: true, id });
});

app.get("/api/projects", async (c) => {
  const rows = await c.env.DB.prepare(
    "SELECT id, name, language, files, edges, clusters, blurb, updated_at AS updatedAt, savings_est AS savings FROM projects WHERE operator_id = ?1",
  )
    .bind(OP)
    .all();
  return c.json({ projects: rows.results ?? [] });
});

app.get("/api/projects/:id/graph", async (c) => {
  const id = c.req.param("id");
  const project = await c.env.DB.prepare("SELECT * FROM projects WHERE id = ?1 AND operator_id = ?2")
    .bind(id, OP)
    .first();
  if (!project) return c.json({ error: "not found" }, 404);
  const [clusters, files, qa] = await Promise.all([
    c.env.DB.prepare("SELECT * FROM project_clusters WHERE project_id = ?1").bind(id).all(),
    c.env.DB.prepare("SELECT path, rank, note FROM project_files WHERE project_id = ?1 ORDER BY rank")
      .bind(id)
      .all(),
    c.env.DB.prepare("SELECT question, answer FROM project_qa WHERE project_id = ?1").bind(id).all(),
  ]);
  return c.json({
    project,
    clusters: clusters.results ?? [],
    files: files.results ?? [],
    prompts: (qa.results ?? []).map((q) => (q as { question: string }).question),
  });
});

app.post("/api/projects/:id/ask", async (c) => {
  const id = c.req.param("id");
  const body = (await c.req.json()) as { question?: string };
  const question = (body.question || "").trim();
  if (!question) return c.json({ error: "question required" }, 400);
  const qa = await c.env.DB.prepare(
    "SELECT question, answer FROM project_qa WHERE project_id = ?1",
  )
    .bind(id)
    .all<{ question: string; answer: string }>();
  const files = await c.env.DB.prepare(
    "SELECT path, note FROM project_files WHERE project_id = ?1 ORDER BY rank LIMIT 3",
  )
    .bind(id)
    .all<{ path: string; note: string }>();
  const words = question.toLowerCase().split(/\W+/).filter((w) => w.length > 2);
  let best = qa.results?.[0];
  let score = -1;
  for (const row of qa.results ?? []) {
    const hay = `${row.question} ${row.answer}`.toLowerCase();
    const s = words.reduce((n, w) => n + (hay.includes(w) ? 1 : 0), 0);
    if (s > score) {
      score = s;
      best = row;
    }
  }
  const answer =
    best && score > 0
      ? best.answer
      : `From the seeded map, start with ${(files.results ?? []).map((f) => f.path).join(", ") || "the project root"}. This reply stays inside the graph. A live model is used only when a worker secret is set.`;
  await logActivity(c.env, "Atlas", "answered from graph", id, "ok", 0, 400);
  return c.json({ answer, grounded: true, matched: score > 0 });
});

app.get("/api/agents", async (c) => {
  const agents = await c.env.DB.prepare("SELECT * FROM agents WHERE operator_id = ?1")
    .bind(OP)
    .all();
  const personas = await c.env.DB.prepare("SELECT * FROM agent_personas").all();
  const cfg = await readConfig(c.env);
  return c.json({
    agents: agents.results ?? [],
    personas: personas.results ?? [],
    sharedMemory: cfg.sharedMemory !== false,
    primaryAgent: cfg.primaryAgent ?? "marshal",
    dispatchMode: cfg.dispatchMode ?? "ask-all",
    committee: cfg.committee ?? catalogDefaultCommittee(),
    llm: llmMode(c.env, c.req.header("x-kuletx-token")),
  });
});

app.get("/api/agents/:id", async (c) => {
  const id = c.req.param("id");
  const agent = await c.env.DB.prepare("SELECT * FROM agents WHERE id = ?1 AND operator_id = ?2")
    .bind(id, OP)
    .first();
  if (!agent) return c.json({ error: "not found" }, 404);
  const personas = await c.env.DB.prepare("SELECT * FROM agent_personas WHERE agent_id = ?1")
    .bind(id)
    .all();
  const profile = await c.env.DB.prepare("SELECT body FROM documents WHERE id = 'doc-profile'")
    .first<{ body: string }>();
  return c.json({ agent, personas: personas.results ?? [], profile: profile?.body ?? "" });
});

app.get("/api/agents/:id/messages", async (c) => {
  const id = c.req.param("id");
  const thread = await c.env.DB.prepare(
    "SELECT id, title FROM threads WHERE operator_id = ?1 AND agent_id = ?2 ORDER BY updated_at DESC LIMIT 1",
  )
    .bind(OP, id)
    .first<{ id: string; title: string }>();
  if (!thread) return c.json({ thread: null, messages: [] });
  const messages = await c.env.DB.prepare(
    "SELECT id, role, body, at, agent_id AS agentId FROM messages WHERE thread_id = ?1 ORDER BY at ASC",
  )
    .bind(thread.id)
    .all();
  return c.json({ thread, messages: messages.results ?? [] });
});

app.post("/api/agents/:id/messages", async (c) => {
  if (tooMany(c.req.header("cf-connecting-ip") ?? "", "chat")) {
    return c.json({ error: "Too many messages. Wait a minute and try again." }, 429);
  }
  const id = c.req.param("id");
  const body = (await c.req.json()) as { body?: string };
  const prompt = (body.body || "").trim();
  if (!prompt) return c.json({ error: "empty message" }, 400);
  const mode = llmMode(c.env, c.req.header("x-kuletx-token"));
  const agent = await c.env.DB.prepare(
    "SELECT id, name, soul, agent_memory FROM agents WHERE id = ?1 AND operator_id = ?2",
  )
    .bind(id, OP)
    .first<{ id: string; name: string; soul: string; agent_memory: string }>();
  if (!agent) return c.json({ error: "not found" }, 404);
  const cfg = await readConfig(c.env);
  const mission = await missionTitle(c.env);
  const reply =
    (mode === "live"
      ? await maybeModelReply(c.env, id, prompt, `${agent.soul}\n${agent.agent_memory}`)
      : null) ?? demoReply(id, prompt, { shared: cfg.sharedMemory !== false, mission });
  const threadId = await ensureThread(c.env, id, `Chat with ${agent.name}`);
  const now = new Date().toISOString();
  const userId = crypto.randomUUID();
  const agentMsgId = crypto.randomUUID();
  await c.env.DB.batch([
    c.env.DB.prepare(
      "INSERT INTO messages (id, thread_id, role, body, at, agent_id) VALUES (?1,?2,'user',?3,?4,NULL)",
    ).bind(userId, threadId, prompt, now),
    c.env.DB.prepare(
      "INSERT INTO messages (id, thread_id, role, body, at, agent_id) VALUES (?1,?2,'agent',?3,?4,?5)",
    ).bind(agentMsgId, threadId, reply, new Date(Date.now() + 400).toISOString(), id),
    c.env.DB.prepare("UPDATE threads SET updated_at = ?1 WHERE id = ?2").bind(now, threadId),
    c.env.DB.prepare("UPDATE agents SET last_active = ?1, status = 'live' WHERE id = ?2").bind(now, id),
  ]);
  await logActivity(c.env, agent.name, "replied", prompt.slice(0, 80), "ok", mode === "live" ? 0.02 : 0, 600);
  return c.json({
    threadId,
    mode,
    messages: [
      { id: userId, role: "user", body: prompt, at: now, agentId: null },
      { id: agentMsgId, role: "agent", body: reply, at: now, agentId: id },
    ],
  });
});

app.post("/api/dispatch", async (c) => {
  if (tooMany(c.req.header("cf-connecting-ip") ?? "", "dispatch")) {
    return c.json({ error: "Too many dispatches. Wait a minute and try again." }, 429);
  }
  const body = (await c.req.json()) as {
    prompt?: string;
    mode?: string;
    agentIds?: string[];
    confirmed?: boolean;
  };
  const prompt = (body.prompt || "").trim();
  if (!prompt) return c.json({ error: "prompt required" }, 400);
  const cfg = await readConfig(c.env);
  const requested = (body.agentIds?.length ? body.agentIds : ["marshal", "atlas", "forge"]).slice(0, 4);
  const mode = body.mode === "relay" ? "relay" : "ask-all";
  const primary = String(cfg.primaryAgent ?? "marshal");
  const ids = mode === "relay" ? [primary] : requested;
  const marks = ids.map((_, i) => `?${i + 2}`).join(",");
  const agents = await c.env.DB.prepare(
    `SELECT id, name, soul, agent_memory FROM agents WHERE operator_id = ?1 AND id IN (${marks})`,
  )
    .bind(OP, ...ids)
    .all<{ id: string; name: string; soul: string; agent_memory: string }>();
  const found = agents.results ?? [];
  if (!body.confirmed) {
    return c.json({
      needsConfirm: true,
      mode,
      agents: found.map((a) => ({ id: a.id, name: a.name })),
      prompt,
    });
  }
  const mission = await missionTitle(c.env);
  const shared = cfg.sharedMemory !== false;
  const modeName = llmMode(c.env, c.req.header("x-kuletx-token"));
  const replies = [];
  for (const agent of found) {
    const text =
      (modeName === "live"
        ? await maybeModelReply(c.env, agent.id, prompt, `${agent.soul}\n${agent.agent_memory}`)
        : null) ?? demoReply(agent.id, prompt, { shared, mission });
    const threadId = await ensureThread(c.env, agent.id, `Dispatch`);
    const now = new Date().toISOString();
    await c.env.DB.batch([
      c.env.DB.prepare(
        "INSERT INTO messages (id, thread_id, role, body, at, agent_id) VALUES (?1,?2,'user',?3,?4,NULL)",
      ).bind(crypto.randomUUID(), threadId, prompt, now),
      c.env.DB.prepare(
        "INSERT INTO messages (id, thread_id, role, body, at, agent_id) VALUES (?1,?2,'agent',?3,?4,?5)",
      ).bind(crypto.randomUUID(), threadId, text, now, agent.id),
    ]);
    replies.push({ agentId: agent.id, name: agent.name, body: text, threadId });
  }
  replies.sort((a, b) => ids.indexOf(a.agentId) - ids.indexOf(b.agentId));
  const synthesis = `Marshal’s read: ${found.map((a) => a.name).join(", ")} answered “${prompt.slice(0, 80)}”. Where they differ, prefer Atlas on notes and Forge on patches. Nothing has been edited.`;
  await logActivity(c.env, "Marshal", mode === "relay" ? "relayed" : "asked all", prompt.slice(0, 80));
  return c.json({
    needsConfirm: false,
    mode,
    replies,
    synthesis,
    llm: modeName,
  });
});

app.get("/api/missions", async (c) => {
  const missions = await c.env.DB.prepare("SELECT * FROM missions WHERE operator_id = ?1")
    .bind(OP)
    .all<{ id: string }>();
  const actions = await c.env.DB.prepare("SELECT * FROM mission_actions ORDER BY sort").all();
  return c.json({ missions: missions.results ?? [], actions: actions.results ?? [] });
});

app.post("/api/missions/:id/actions/:aid", async (c) => {
  const aid = c.req.param("aid");
  const body = (await c.req.json()) as { status?: string };
  const status = body.status || "complete";
  if (!["complete", "active", "pending", "blocked"].includes(status)) {
    return c.json({ error: "bad status" }, 400);
  }
  await c.env.DB.prepare("UPDATE mission_actions SET status = ?1 WHERE id = ?2").bind(status, aid).run();
  await logActivity(c.env, "Kulet", "updated mission action", `${aid} → ${status}`);
  return c.json({ ok: true });
});

app.get("/api/documents", async (c) => {
  const rows = await c.env.DB.prepare(
    "SELECT id, title, description, kind, bytes, updated_at AS updatedAt, body FROM documents WHERE operator_id = ?1 ORDER BY updated_at DESC",
  )
    .bind(OP)
    .all();
  return c.json({ documents: rows.results ?? [] });
});

app.get("/api/schedules", async (c) => {
  const rows = await c.env.DB.prepare("SELECT * FROM schedules WHERE operator_id = ?1").bind(OP).all();
  return c.json({ schedules: rows.results ?? [] });
});

app.post("/api/schedules/:id", async (c) => {
  const id = c.req.param("id");
  const body = (await c.req.json()) as { enabled?: boolean };
  await c.env.DB.prepare("UPDATE schedules SET enabled = ?1 WHERE id = ?2 AND operator_id = ?3")
    .bind(body.enabled ? 1 : 0, id, OP)
    .run();
  await logActivity(c.env, "Kulet", body.enabled ? "enabled schedule" : "disabled schedule", id);
  return c.json({ ok: true });
});

app.post("/api/schedules/:id/run", async (c) => {
  const id = c.req.param("id");
  const row = await c.env.DB.prepare("SELECT * FROM schedules WHERE id = ?1 AND operator_id = ?2")
    .bind(id, OP)
    .first<{ id: string; name: string; cron: string }>();
  if (!row) return c.json({ error: "not found" }, 404);
  if (id === "sched-dream") {
    const dream = await runDream(c.env, "run-now");
    return c.json({ ok: true, dream });
  }
  const clock = SCHEDULE_CLOCK[id] ?? { hour: -1, minute: 0 };
  await c.env.DB.prepare(
    "UPDATE schedules SET last_run = ?1, next_run = ?2, status = 'ok' WHERE id = ?3",
  )
    .bind(new Date().toISOString(), nextManila(clock.hour, clock.minute, clock.dow), id)
    .run();
  await logActivity(c.env, "Nightwatch", "ran schedule", row.name);
  return c.json({ ok: true });
});

app.get("/api/integrations", async (c) => {
  const [tiles, knowledge] = await Promise.all([
    c.env.DB.prepare("SELECT * FROM integrations WHERE operator_id = ?1").bind(OP).all(),
    c.env.DB.prepare("SELECT * FROM knowledge_systems WHERE operator_id = ?1").bind(OP).all(),
  ]);
  return c.json({ integrations: tiles.results ?? [], knowledge: knowledge.results ?? [] });
});

app.post("/api/integrations/:id/connect", async (c) => {
  const id = c.req.param("id");
  await c.env.DB.prepare(
    "UPDATE integrations SET connected = 1, last_sync = ?1, detail = ?2 WHERE id = ?3 AND operator_id = ?4",
  )
    .bind(new Date().toISOString(), "Connected in demo. No OAuth was performed.", id, OP)
    .run();
  await logActivity(c.env, "Kulet", "connected integration", id);
  return c.json({ ok: true, demo: true });
});

app.get("/api/activity", async (c) => {
  const actor = c.req.query("actor");
  const status = c.req.query("status");
  let sql = "SELECT * FROM activity WHERE operator_id = ?1";
  const binds: string[] = [OP];
  if (actor) {
    binds.push(actor);
    sql += ` AND actor = ?${binds.length}`;
  }
  if (status) {
    binds.push(status);
    sql += ` AND status = ?${binds.length}`;
  }
  sql += " ORDER BY at DESC LIMIT 200";
  const stmt = c.env.DB.prepare(sql);
  const rows = await stmt.bind(...binds).all();
  return c.json({ events: rows.results ?? [] });
});

app.get("/api/inbox", async (c) => {
  const rows = await c.env.DB.prepare(
    "SELECT * FROM inbox_items WHERE operator_id = ?1 ORDER BY at DESC",
  )
    .bind(OP)
    .all();
  return c.json({ items: rows.results ?? [] });
});

app.post("/api/inbox/:id", async (c) => {
  const id = c.req.param("id");
  const body = (await c.req.json()) as { status?: string; agentId?: string };
  const status = body.status || "routed";
  await c.env.DB.prepare("UPDATE inbox_items SET status = ?1 WHERE id = ?2 AND operator_id = ?3")
    .bind(status, id, OP)
    .run();
  await logActivity(
    c.env,
    "Relay",
    status === "archived" ? "archived inbox item" : "routed inbox item",
    `${id}${body.agentId ? " → " + agentName(body.agentId) : ""}`,
  );
  return c.json({ ok: true });
});

app.get("/api/calendar", async (c) => {
  const [events, schedules] = await Promise.all([
    c.env.DB.prepare("SELECT * FROM calendar_events WHERE operator_id = ?1 ORDER BY at").bind(OP).all(),
    c.env.DB.prepare("SELECT id, name, cadence, next_run AS nextRun, status FROM schedules WHERE operator_id = ?1")
      .bind(OP)
      .all(),
  ]);
  return c.json({ events: events.results ?? [], schedules: schedules.results ?? [] });
});

app.get("/api/usage", async (c) => {
  const [subs, windows, days] = await Promise.all([
    c.env.DB.prepare("SELECT * FROM subscriptions WHERE operator_id = ?1").bind(OP).all(),
    c.env.DB.prepare("SELECT * FROM usage_windows WHERE operator_id = ?1").bind(OP).all(),
    c.env.DB.prepare("SELECT * FROM usage_days WHERE operator_id = ?1 ORDER BY day").bind(OP).all(),
  ]);
  return c.json({
    subscriptions: subs.results ?? [],
    windows: windows.results ?? [],
    days: days.results ?? [],
  });
});

app.get("/api/search", async (c) => {
  const q = (c.req.query("q") || "").trim();
  if (!q) return c.json({ hits: [] });
  const like = `%${q.replace(/%/g, "")}%`;
  const [skills, docs, agents, missions] = await Promise.all([
    c.env.DB.prepare(
      "SELECT id, name AS title FROM skills WHERE operator_id = ?1 AND (name LIKE ?2 OR description LIKE ?2) LIMIT 5",
    )
      .bind(OP, like)
      .all<{ id: string; title: string }>(),
    c.env.DB.prepare(
      "SELECT id, title FROM documents WHERE operator_id = ?1 AND (title LIKE ?2 OR description LIKE ?2) LIMIT 5",
    )
      .bind(OP, like)
      .all<{ id: string; title: string }>(),
    c.env.DB.prepare(
      "SELECT id, name AS title FROM agents WHERE operator_id = ?1 AND (name LIKE ?2 OR role LIKE ?2) LIMIT 5",
    )
      .bind(OP, like)
      .all<{ id: string; title: string }>(),
    c.env.DB.prepare(
      "SELECT id, title FROM missions WHERE operator_id = ?1 AND title LIKE ?2 LIMIT 3",
    )
      .bind(OP, like)
      .all<{ id: string; title: string }>(),
  ]);
  const hits = [
    ...(skills.results ?? []).map((r) => ({ kind: "skill", id: r.id, title: r.title, href: "/skills" })),
    ...(docs.results ?? []).map((r) => ({ kind: "document", id: r.id, title: r.title, href: "/documents" })),
    ...(agents.results ?? []).map((r) => ({ kind: "agent", id: r.id, title: r.title, href: `/agents/${r.id}` })),
    ...(missions.results ?? []).map((r) => ({ kind: "mission", id: r.id, title: r.title, href: `/missions/${r.id}` })),
  ];
  return c.json({ hits });
});

app.get("/api/business", async (c) => {
  const windows = await c.env.DB.prepare("SELECT * FROM usage_windows WHERE operator_id = ?1")
    .bind(OP)
    .all();
  return c.json({
    demo: true,
    cash: 48200,
    income: 12400,
    target: 20000,
    note: "Fictional ledger for the demo operator. Not a connected bank.",
    windows: windows.results ?? [],
  });
});

export async function runDream(env: Env, via: string) {
  const open = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM dream_items WHERE operator_id = ?1 AND status = 'open'",
  )
    .bind(OP)
    .first<{ n: number }>();
  let refiled = false;
  if (!open?.n) {
    const templates = await env.DB.prepare("SELECT * FROM dream_templates WHERE operator_id = ?1")
      .bind(OP)
      .all<{
        id: string;
        category: string;
        title: string;
        body: string;
        evidence: string;
        try_command: string;
        impact: string;
        sort: number;
      }>();
    const now = new Date().toISOString();
    const stmts = (templates.results ?? []).map((t) =>
      env.DB.prepare(
        `INSERT INTO dream_items (id, operator_id, template_id, category, title, body, evidence, try_command, impact, status, sort, generated_at, generated_by)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,'open',?10,?11,'Nightwatch')`,
      ).bind(
        crypto.randomUUID(),
        OP,
        t.id,
        t.category,
        t.title,
        t.body,
        t.evidence,
        t.try_command,
        t.impact,
        t.sort,
        now,
      ),
    );
    if (stmts.length) await env.DB.batch(stmts);
    refiled = true;
  }
  await env.DB.prepare(
    "UPDATE schedules SET last_run = ?1, next_run = ?2, status = 'ok' WHERE id = 'sched-dream'",
  )
    .bind(new Date().toISOString(), nextManila(6, 0))
    .run();
  await logActivity(env, "Nightwatch", refiled ? "re-filed dream cards" : "reviewed dream desk", via);
  return { ok: true, refiled, via };
}

async function applyDreamSideEffect(env: Env, category: string, title: string) {
  if (category === "MEMORY") {
    await env.DB.prepare(
      "UPDATE memories SET status = 'fresh', updated_at = ?1 WHERE operator_id = ?2 AND status = 'stale' AND path LIKE '%launch-notes%'",
    )
      .bind(new Date().toISOString(), OP)
      .run();
  }
  if (category === "WORKFLOW") {
    await env.DB.prepare(
      `INSERT INTO skills (id, operator_id, name, category, description, invocations, last_used, avg_tokens, est_minutes, error_rate, state, hours_saved_28d)
       VALUES ('ship-note',?1,'Ship Note','Engineering','Composed from Brief Writer and Changelog Draft.',0,?2,0,36,0,'active',0)
       ON CONFLICT(id) DO UPDATE SET state = 'active'`,
    )
      .bind(OP, new Date().toISOString())
      .run();
  }
  await logActivity(env, "Nightwatch", "applied dream effect", `${category}: ${title}`);
}

async function missionTitle(env: Env): Promise<string> {
  const row = await env.DB.prepare("SELECT title FROM missions WHERE operator_id = ?1 LIMIT 1")
    .bind(OP)
    .first<{ title: string }>();
  return row?.title ?? "Ship KuletXAI to workers.dev";
}

async function ensureThread(env: Env, agentId: string, title: string): Promise<string> {
  const existing = await env.DB.prepare(
    "SELECT id FROM threads WHERE operator_id = ?1 AND agent_id = ?2 ORDER BY updated_at DESC LIMIT 1",
  )
    .bind(OP, agentId)
    .first<{ id: string }>();
  if (existing) return existing.id;
  const id = crypto.randomUUID();
  await env.DB.prepare(
    "INSERT INTO threads (id, operator_id, agent_id, title, updated_at) VALUES (?1,?2,?3,?4,?5)",
  )
    .bind(id, OP, agentId, title, new Date().toISOString())
    .run();
  return id;
}

function hydrateDream(row: Record<string, unknown>) {
  let evidence: string[] = [];
  try {
    evidence = JSON.parse(String(row.evidence ?? "[]")) as string[];
  } catch {
    evidence = [];
  }
  return {
    id: String(row.id ?? ""),
    category: String(row.category ?? ""),
    title: String(row.title ?? ""),
    body: String(row.body ?? ""),
    try_command: row.try_command ? String(row.try_command) : "",
    impact: String(row.impact ?? ""),
    status: String(row.status ?? ""),
    sort: Number(row.sort ?? 0),
    generated_at: String(row.generated_at ?? ""),
    generated_by: String(row.generated_by ?? "Nightwatch"),
    evidence,
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function pct(curr: number, prev: number) {
  if (!prev) return curr ? 100 : 0;
  return Math.round(((curr - prev) / Math.abs(prev)) * 100);
}

function catalogDefaultCommittee() {
  return { orchestrator: "Claude Opus", delegates: ["GPT", "Grok", "DeepSeek"], cacheRatio: 0.62 };
}

const SCHEDULE_CLOCK: Record<string, { hour: number; minute: number; dow?: number }> = {
  "sched-dream": { hour: 6, minute: 0 },
  "sched-memory": { hour: 23, minute: 30 },
  "sched-usage": { hour: -1, minute: 0 },
  "sched-audit": { hour: 18, minute: 0, dow: 5 },
  "sched-digest": { hour: 9, minute: 0, dow: 1 },
  "sched-invoice": { hour: 9, minute: 0 },
};
