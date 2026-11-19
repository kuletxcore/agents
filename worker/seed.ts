import { catalog, OPERATOR_ID } from "../seed/catalog";
import type { Env } from "./env";
import { SCHEMA_SQL } from "./schema";
import { dayKey, daysAgo, hoursAgo, nextManila } from "./time";

let ready: Promise<void> | null = null;

export function ensureReady(env: Env): Promise<void> {
  if (!ready) {
    ready = seedIfNeeded(env).catch((err) => {
      ready = null;
      throw err;
    });
  }
  return ready;
}

const defaultConfig = {
  operatorName: "Kulet",
  handle: "kuletx",
  hourlyRate: 150,
  timezone: "Asia/Manila",
  dreamFrequency: "daily",
  dreamTime: "06:00",
  dreamWindow: "morning",
  webSearch: false,
  heroImage: false,
  env: "demo",
  sharedMemory: true,
  primaryAgent: "marshal",
  theme: "day",
  dispatchMode: "ask-all",
  tools: {
    claude_code: true,
    codex: true,
    grok: false,
    gemini_cli: true,
    openrouter: true,
    workers: true,
    notion: false,
    vector_index: true,
    vault: true,
    telegram: false,
  },
  paths: {
    claude_code: "~/.claude",
    codex: "~/.codex",
    vault: "~/KuletXAI/vault",
    vector: "kx-agents-memory",
    workers: "agents.kuletxcore.workers.dev",
  },
  dreamDimensions: {
    conversation: true,
    cost: true,
    skill: true,
    memory: true,
    session: true,
    workflow: true,
    external: false,
    business: true,
  },
  committee: {
    orchestrator: "Claude Opus",
    delegates: ["GPT", "Grok", "DeepSeek"],
    cacheRatio: 0.62,
  },
  wizardComplete: true,
};

function sqlStatements(sql: string): string[] {
  return sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
}

async function seedIfNeeded(env: Env): Promise<void> {
  const db = env.DB;
  for (const statement of sqlStatements(SCHEMA_SQL)) {
    await db.prepare(statement).run();
  }
  const seeded = await db.prepare("SELECT value FROM meta WHERE key = 'seeded'").first<{ value: string }>();
  if (seeded?.value === "1") return;
  const stmts: D1PreparedStatement[] = [];
  const op = catalog.operator;
  stmts.push(
    db
      .prepare(
        "INSERT INTO operators (id, name, handle, timezone, hourly_rate, workspace, env) VALUES (?1,?2,?3,?4,?5,?6,?7)",
      )
      .bind(op.id, op.name, op.handle, op.timezone, op.hourlyRate, op.workspace, op.env),
  );
  stmts.push(
    db
      .prepare("INSERT INTO config (operator_id, json, updated_at) VALUES (?1,?2,?3)")
      .bind(OPERATOR_ID, JSON.stringify(defaultConfig), new Date().toISOString()),
  );
  stmts.push(db.prepare("INSERT INTO meta (key, value) VALUES ('schema', '1')"));

  for (const s of catalog.subscriptions) {
    stmts.push(
      db
        .prepare(
          "INSERT INTO subscriptions (id, operator_id, provider, plan, monthly_price, accent) VALUES (?1,?2,?3,?4,?5,?6)",
        )
        .bind(s.id, OPERATOR_ID, s.provider, s.plan, s.monthlyPrice, s.accent),
    );
  }
  for (const w of catalog.windows) {
    stmts.push(
      db
        .prepare(
          "INSERT INTO usage_windows (id, operator_id, provider, label, used, cap, unit, resets) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
        )
        .bind(w.id, OPERATOR_ID, w.provider, w.label, w.used, w.cap, w.unit, w.resets),
    );
  }

  const hourWeights = [
    1.6, 1.2, 1.4, 0.8, 1.5, 1.1, 1.3, 2.2, 1.0, 0.9, 1.4, 1.7, 0.7, 1.2, 1.8, 1.1, 0.9, 2.4, 1.3,
    1.0, 1.5, 0.8, 1.6, 1.2, 0.6, 1.9, 1.4, 1.3,
  ];
  const hourSum = hourWeights.reduce((a, b) => a + b, 0);
  const targetHours = catalog.skills.reduce((a, s) => a + s.hours, 0);
  for (let i = 0; i < 28; i++) {
    const hours = (hourWeights[i] / hourSum) * targetHours;
    const spike = i === 4 ? 14 : i === 12 ? 7.5 : 0;
    const spent = Math.round((4.4 + Math.sin(i / 2.4) * 1.3 + spike) * 100) / 100;
    const sessions = 4 + ((i * 3) % 8);
    const tokens = Math.round(42000 + spent * 2800);
    stmts.push(
      db
        .prepare(
          "INSERT INTO usage_days (operator_id, day, spent, hours_saved, sessions, focus_hours, tokens) VALUES (?1,?2,?3,?4,?5,?6,?7)",
        )
        .bind(
          OPERATOR_ID,
          dayKey(i),
          spent,
          Math.round(hours * 100) / 100,
          sessions,
          Math.round(sessions * 0.62 * 10) / 10,
          tokens,
        ),
    );
  }

  for (const s of catalog.skills) {
    stmts.push(
      db
        .prepare(
          `INSERT INTO skills (id, operator_id, name, category, description, invocations, last_used, avg_tokens, est_minutes, error_rate, state, hours_saved_28d)
           VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)`,
        )
        .bind(
          s.id,
          OPERATOR_ID,
          s.name,
          s.category,
          s.description,
          s.invocations,
          daysAgo(s.daysAgo),
          s.avgTokens,
          s.estMinutes,
          s.errorRate,
          s.state,
          s.hours,
        ),
    );
  }

  const generated: {
    id: string;
    title: string;
    path: string;
    workspace: string;
    source: string;
    kind: string;
    status: string;
    summary: string;
    x: number;
    y: number;
    sector: string;
    updated_at: string;
  }[] = catalog.memoryNotes.map((n) => ({
    id: n.id,
    title: n.title,
    path: n.path,
    workspace: n.workspace,
    source: n.source,
    kind: n.kind,
    status: n.status,
    summary: n.summary,
    x: n.x,
    y: n.y,
    sector: n.sector,
    updated_at: daysAgo(n.daysAgo),
  }));

  const fillers: { ws: string; source: string; sector: string; kind: string; n: number }[] = [
    { ws: "agents-platform", source: "claude", sector: "notes", kind: "note", n: 14 },
    { ws: "workers-deploy", source: "workers", sector: "documents", kind: "note", n: 12 },
    { ws: "community", source: "messages", sector: "messages", kind: "note", n: 10 },
    { ws: "voice-herald", source: "meetings", sector: "sessions", kind: "session", n: 8 },
    { ws: "agents-platform", source: "skills", sector: "skills", kind: "skill", n: 8 },
    { ws: "community", source: "meetings", sector: "meetings", kind: "session", n: 8 },
    { ws: "workers-deploy", source: "codex", sector: "decisions", kind: "decision", n: 6 },
    { ws: "agents-platform", source: "chatgpt", sector: "notes", kind: "note", n: 6 },
    { ws: "voice-herald", source: "grok", sector: "sessions", kind: "session", n: 5 },
  ];
  let fi = 0;
  for (const group of fillers) {
    for (let i = 0; i < group.n; i++) {
      fi++;
      const angle = (fi * 2.399) % (Math.PI * 2);
      const ring = 16 + (fi % 5) * 6.5;
      const jitter = ((fi * 17) % 7) - 3;
      generated.push({
        id: `mem-f-${fi}`,
        title: `${group.ws} note ${i + 1}`,
        path: `${group.ws}/${group.sector}/note-${i + 1}.md`,
        workspace: group.ws,
        source: group.source,
        kind: group.kind,
        status: "fresh",
        summary: `Indexed ${group.kind} from the ${group.ws} workspace.`,
        x: Math.round((50 + Math.cos(angle) * ring + jitter) * 10) / 10,
        y: Math.round((50 + Math.sin(angle) * ring * 0.86) * 10) / 10,
        sector: group.sector,
        updated_at: daysAgo((fi % 9) + 0.2),
      });
    }
  }

  for (const m of generated) {
    stmts.push(
      db
        .prepare(
          `INSERT INTO memories (id, operator_id, title, path, workspace, source, kind, status, summary, x, y, sector, updated_at)
           VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13)`,
        )
        .bind(
          m.id,
          OPERATOR_ID,
          m.title,
          m.path,
          m.workspace,
          m.source,
          m.kind,
          m.status,
          m.summary,
          m.x,
          m.y,
          m.sector,
          m.updated_at,
        ),
    );
  }

  const hubs = ["mem-limits", "mem-stale-play", "mem-decision", "mem-stale-voice"];
  let ei = 0;
  for (const hub of hubs) {
    ei++;
    stmts.push(
      db
        .prepare(
          "INSERT INTO memory_edges (id, operator_id, source_id, target_id) VALUES (?1,?2,?3,?4)",
        )
        .bind(`edge-${ei}`, OPERATOR_ID, "mem-core", hub),
    );
  }
  stmts.push(
    db
      .prepare(
        "INSERT INTO memory_edges (id, operator_id, source_id, target_id) VALUES (?1,?2,?3,?4)",
      )
      .bind("edge-conflict", OPERATOR_ID, "mem-conflict-a", "mem-conflict-b"),
  );
  const fillerIds = generated.filter((m) => m.id.startsWith("mem-f-")).map((m) => m.id);
  for (let i = 0; i < fillerIds.length; i++) {
    const a = i % 7 === 0 ? "mem-core" : fillerIds[Math.max(0, i - 1)];
    stmts.push(
      db
        .prepare(
          "INSERT INTO memory_edges (id, operator_id, source_id, target_id) VALUES (?1,?2,?3,?4)",
        )
        .bind(`edge-f-${i}`, OPERATOR_ID, a, fillerIds[i]),
    );
  }

  const sources = [
    ["profile", "Profile"],
    ["claude", "Claude"],
    ["codex", "Codex"],
    ["chatgpt", "ChatGPT"],
    ["meetings", "Meetings"],
    ["messages", "Messages"],
    ["skills", "Skills"],
    ["grok", "Grok"],
    ["workers", "Workers"],
    ["vault", "Vault"],
    ["photos", "Photos"],
  ] as const;
  for (const [id, name] of sources) {
    stmts.push(
      db
        .prepare(
          "INSERT INTO memory_sources (id, operator_id, name, enabled, last_indexed) VALUES (?1,?2,?3,?4,?5)",
        )
        .bind(id, OPERATOR_ID, name, id === "photos" ? 0 : 1, hoursAgo(2)),
    );
  }
  for (const row of catalog.memoryActivity) {
    stmts.push(
      db
        .prepare(
          "INSERT INTO memory_activity (id, operator_id, action, path, at) VALUES (?1,?2,?3,?4,?5)",
        )
        .bind(crypto.randomUUID(), OPERATOR_ID, row.action, row.path, hoursAgo(row.hoursAgo)),
    );
  }

  const generatedAt = hoursAgo(8);
  for (const d of catalog.dreams) {
    stmts.push(
      db
        .prepare(
          `INSERT INTO dream_templates (id, operator_id, category, title, body, evidence, try_command, impact, sort)
           VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)`,
        )
        .bind(
          d.id,
          OPERATOR_ID,
          d.category,
          d.title,
          d.body,
          JSON.stringify(d.evidence),
          d.tryCommand,
          d.impact,
          d.sort,
        ),
    );
    stmts.push(
      db
        .prepare(
          `INSERT INTO dream_items (id, operator_id, template_id, category, title, body, evidence, try_command, impact, status, sort, generated_at, generated_by)
           VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,'open',?10,?11,'Nightwatch')`,
        )
        .bind(
          d.id,
          OPERATOR_ID,
          d.id,
          d.category,
          d.title,
          d.body,
          JSON.stringify(d.evidence),
          d.tryCommand,
          d.impact,
          d.sort,
          generatedAt,
        ),
    );
  }

  for (const a of catalog.agents) {
    stmts.push(
      db
        .prepare(
          `INSERT INTO agents (id, operator_id, name, role, bio, status, model, hue, glyph, is_primary, last_active, latency_ms, memory_tokens, memory_cap, soul, agent_memory)
           VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16)`,
        )
        .bind(
          a.id,
          OPERATOR_ID,
          a.name,
          a.role,
          a.bio,
          a.status,
          a.model,
          a.hue,
          a.glyph,
          a.primary ? 1 : 0,
          hoursAgo(a.hoursAgo),
          a.latency,
          a.mem,
          a.cap,
          a.soul,
          a.memory,
        ),
    );
  }
  for (const p of catalog.personas) {
    stmts.push(
      db
        .prepare(
          "INSERT INTO agent_personas (id, agent_id, name, job, model, pinned) VALUES (?1,?2,?3,?4,?5,?6)",
        )
        .bind(p.id, p.agentId, p.name, p.job, p.model, p.pinned),
    );
  }

  const thread = catalog.thread;
  stmts.push(
    db
      .prepare(
        "INSERT INTO threads (id, operator_id, agent_id, title, updated_at) VALUES (?1,?2,?3,?4,?5)",
      )
      .bind(thread.id, OPERATOR_ID, thread.agentId, thread.title, hoursAgo(4.5)),
  );
  for (const m of thread.messages) {
    stmts.push(
      db
        .prepare(
          "INSERT INTO messages (id, thread_id, role, body, at, agent_id) VALUES (?1,?2,?3,?4,?5,?6)",
        )
        .bind(
          crypto.randomUUID(),
          thread.id,
          m.role,
          m.body,
          hoursAgo(m.hoursAgo),
          m.role === "agent" ? thread.agentId : null,
        ),
    );
  }

  const mission = catalog.mission;
  stmts.push(
    db
      .prepare(
        "INSERT INTO missions (id, operator_id, title, metric, days_remaining, status, summary) VALUES (?1,?2,?3,?4,?5,?6,?7)",
      )
      .bind(
        mission.id,
        OPERATOR_ID,
        mission.title,
        mission.metric,
        mission.daysRemaining,
        mission.status,
        mission.summary,
      ),
  );
  for (const a of mission.actions) {
    stmts.push(
      db
        .prepare(
          `INSERT INTO mission_actions (id, mission_id, title, detail, owner, owner_name, status, sort, prompt)
           VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)`,
        )
        .bind(a.id, mission.id, a.title, a.detail, a.owner, a.ownerName, a.status, a.sort, a.prompt),
    );
  }

  for (const doc of catalog.documents) {
    const body = doc.body.trim();
    stmts.push(
      db
        .prepare(
          `INSERT INTO documents (id, operator_id, title, description, kind, bytes, updated_at, body)
           VALUES (?1,?2,?3,?4,?5,?6,?7,?8)`,
        )
        .bind(
          doc.id,
          OPERATOR_ID,
          doc.title,
          doc.description,
          doc.kind,
          body.length,
          daysAgo(doc.daysAgo),
          body,
        ),
    );
  }

  for (const s of catalog.schedules) {
    stmts.push(
      db
        .prepare(
          `INSERT INTO schedules (id, operator_id, name, cadence, cron, last_run, next_run, status, enabled)
           VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)`,
        )
        .bind(
          s.id,
          OPERATOR_ID,
          s.name,
          s.cadence,
          s.cron,
          hoursAgo(s.hoursAgo),
          nextManila(s.hour, s.minute, "dow" in s ? s.dow : undefined),
          s.status,
          s.enabled,
        ),
    );
  }

  for (const i of catalog.integrations) {
    stmts.push(
      db
        .prepare(
          `INSERT INTO integrations (id, operator_id, name, category, connected, last_sync, detail)
           VALUES (?1,?2,?3,?4,?5,?6,?7)`,
        )
        .bind(
          i.id,
          OPERATOR_ID,
          i.name,
          i.category,
          i.connected,
          i.hoursAgo == null ? null : hoursAgo(i.hoursAgo),
          i.detail,
        ),
    );
  }
  for (const k of catalog.knowledge) {
    stmts.push(
      db
        .prepare(
          `INSERT INTO knowledge_systems (id, operator_id, name, kind, count_label, last_sync)
           VALUES (?1,?2,?3,?4,?5,?6)`,
        )
        .bind(k.id, OPERATOR_ID, k.name, k.kind, k.countLabel, hoursAgo(k.hoursAgo)),
    );
  }

  for (const p of catalog.projects) {
    stmts.push(
      db
        .prepare(
          `INSERT INTO projects (id, operator_id, name, language, files, edges, clusters, blurb, updated_at, confidence_code, confidence_inferred, savings_est)
           VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)`,
        )
        .bind(
          p.id,
          OPERATOR_ID,
          p.name,
          p.language,
          p.files,
          p.edges,
          p.clusters,
          p.blurb,
          daysAgo(p.daysAgo),
          p.confidenceCode,
          p.confidenceInferred,
          p.savings,
        ),
    );
    for (const c of p.clustersList) {
      stmts.push(
        db
          .prepare(
            "INSERT INTO project_clusters (id, project_id, name, color, count, x, y) VALUES (?1,?2,?3,?4,?5,?6,?7)",
          )
          .bind(`${p.id}-${c.id}`, p.id, c.name, c.color, c.count, c.x, c.y),
      );
    }
    p.filesList.forEach((f, idx) => {
      stmts.push(
        db
          .prepare(
            "INSERT INTO project_files (id, project_id, path, rank, note) VALUES (?1,?2,?3,?4,?5)",
          )
          .bind(`${p.id}-f${idx}`, p.id, f.path, idx + 1, f.note),
      );
    });
    p.qa.forEach((qa, idx) => {
      stmts.push(
        db
          .prepare(
            "INSERT INTO project_qa (id, project_id, question, answer) VALUES (?1,?2,?3,?4)",
          )
          .bind(`${p.id}-q${idx}`, p.id, qa.q, qa.a),
      );
    });
  }

  catalog.activity.forEach((a, idx) => {
    stmts.push(
      db
        .prepare(
          `INSERT INTO activity (id, operator_id, at, actor, action, target, status, cost, tokens)
           VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)`,
        )
        .bind(
          `act-seed-${idx}`,
          OPERATOR_ID,
          hoursAgo(a.hoursAgo),
          a.actor,
          a.action,
          a.target,
          a.status,
          a.cost,
          a.tokens,
        ),
    );
  });

  for (const item of catalog.inbox) {
    stmts.push(
      db
        .prepare(
          `INSERT INTO inbox_items (id, operator_id, source, title, preview, tag, score, status, at)
           VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)`,
        )
        .bind(
          item.id,
          OPERATOR_ID,
          item.source,
          item.title,
          item.preview,
          item.tag,
          item.score,
          item.status,
          hoursAgo(item.hoursAgo),
        ),
    );
  }
  for (const ev of catalog.events) {
    stmts.push(
      db
        .prepare(
          "INSERT INTO calendar_events (id, operator_id, title, at, kind, owner) VALUES (?1,?2,?3,?4,?5,?6)",
        )
        .bind(
          ev.id,
          OPERATOR_ID,
          ev.title,
          new Date(Date.now() + ev.hoursFromNow * 3600 * 1000).toISOString(),
          ev.kind,
          ev.owner,
        ),
    );
  }
  for (const r of catalog.runtimes) {
    stmts.push(
      db
        .prepare(
          "INSERT INTO runtimes (id, operator_id, name, status, detail) VALUES (?1,?2,?3,?4,?5)",
        )
        .bind(r.id, OPERATOR_ID, r.name, r.status, r.detail),
    );
  }

  // D1 batches are transactional. Conflicts must never cause a destructive reset.
  stmts.push(db.prepare("INSERT INTO meta (key, value) VALUES ('seeded', '1')"));
  try {
    await db.batch(stmts);
  } catch (err) {
    // Another isolate may have initialized the same empty database first.
    const marker = await db.prepare("SELECT value FROM meta WHERE key = 'seeded'").first<{ value: string }>();
    if (marker?.value === "1") return;
    throw err;
  }

  try {
    await env.CONFIG.put(`operator:${OPERATOR_ID}`, JSON.stringify(defaultConfig));
  } catch (err) {
    console.error("config kv seed skipped", err);
  }
}
