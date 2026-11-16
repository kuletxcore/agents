import type { Env } from "../env";
import { OP } from "../env";

/**
 * The tool table. A tool is the only way an agent can touch the system.
 * `read` tools run immediately. `write` tools stop the run until the operator approves.
 */
export type Tool = {
  name: string;
  risk: "read" | "write";
  description: string;
  parameters: Record<string, unknown>;
  run: (env: Env, args: Record<string, unknown>, ctx: { agentName: string }) => Promise<unknown>;
};

const str = (v: unknown, max: number) => (typeof v === "string" ? v : v == null ? "" : String(v)).trim().slice(0, max);

function need(args: Record<string, unknown>, key: string, max: number): string {
  const value = str(args[key], max);
  if (!value) throw new Error(`"${key}" is required`);
  return value;
}

const likeTerm = (q: string) => `%${q.replace(/[\\%_]/g, "\\$&")}%`;

export const TOOLS: Tool[] = [
  {
    name: "memory_search",
    risk: "read",
    description: "Search the operator's memory vault. Returns matching notes with path, status, and summary.",
    parameters: {
      type: "object",
      properties: { query: { type: "string", description: "One or two keywords. An empty query lists recent notes." } },
      required: ["query"],
    },
    async run(env, args) {
      const words = str(args.query, 120).split(/\s+/).filter(Boolean).slice(0, 4);
      const where = words.map((_, i) => `(title LIKE ?${i + 2} ESCAPE '\\' OR summary LIKE ?${i + 2} ESCAPE '\\' OR path LIKE ?${i + 2} ESCAPE '\\')`);
      const rows = await env.DB.prepare(
        `SELECT id, title, path, status, summary, updated_at AS updatedAt FROM memories
         WHERE operator_id = ?1 ${where.length ? `AND (${where.join(" OR ")})` : ""}
         ORDER BY updated_at DESC LIMIT 8`,
      )
        .bind(OP, ...words.map(likeTerm))
        .all();
      return { notes: rows.results ?? [] };
    },
  },
  {
    name: "memory_write",
    risk: "write",
    description: "Save a new note to the memory vault.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        summary: { type: "string", description: "The note text." },
        path: { type: "string", description: "Optional vault path, e.g. notes/deploy.md" },
      },
      required: ["title", "summary"],
    },
    async run(env, args) {
      const id = crypto.randomUUID();
      const title = need(args, "title", 120);
      const path = str(args.path, 200) || `runs/${id}.md`;
      await env.DB.prepare(
        `INSERT INTO memories (id, operator_id, title, path, workspace, source, kind, status, summary, x, y, sector, updated_at)
         VALUES (?1,?2,?3,?4,'agents-platform','profile','note','fresh',?5,54,46,'notes',?6)`,
      )
        .bind(id, OP, title, path, need(args, "summary", 2000), new Date().toISOString())
        .run();
      return { saved: true, id, path };
    },
  },
  {
    name: "documents_list",
    risk: "read",
    description: "List documents in the Archive (id, title, description).",
    parameters: { type: "object", properties: {} },
    async run(env) {
      const rows = await env.DB.prepare(
        "SELECT id, title, description, kind, updated_at AS updatedAt FROM documents WHERE operator_id = ?1 ORDER BY updated_at DESC LIMIT 30",
      )
        .bind(OP)
        .all();
      return { documents: rows.results ?? [] };
    },
  },
  {
    name: "document_read",
    risk: "read",
    description: "Read one Archive document by id.",
    parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
    async run(env, args) {
      const row = await env.DB.prepare("SELECT id, title, body FROM documents WHERE id = ?1 AND operator_id = ?2")
        .bind(need(args, "id", 80), OP)
        .first();
      if (!row) throw new Error("no document with that id");
      return row;
    },
  },
  {
    name: "document_write",
    risk: "write",
    description: "File a new markdown document in the Archive.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string", description: "One line on what the document is." },
        body: { type: "string", description: "Markdown body." },
      },
      required: ["title", "body"],
    },
    async run(env, args) {
      const id = `doc-${crypto.randomUUID().slice(0, 8)}`;
      const title = need(args, "title", 120);
      const body = need(args, "body", 12_000);
      await env.DB.prepare(
        "INSERT INTO documents (id, operator_id, title, description, kind, bytes, updated_at, body) VALUES (?1,?2,?3,?4,'markdown',?5,?6,?7)",
      )
        .bind(id, OP, title, str(args.description, 240) || title, new TextEncoder().encode(body).length, new Date().toISOString(), body)
        .run();
      return { saved: true, id, title };
    },
  },
  {
    name: "missions_status",
    risk: "read",
    description: "Read the active missions and every action on them, with owner and status.",
    parameters: { type: "object", properties: {} },
    async run(env) {
      const missions = await env.DB.prepare(
        "SELECT id, title, metric, days_remaining AS daysRemaining, status FROM missions WHERE operator_id = ?1",
      )
        .bind(OP)
        .all();
      const actions = await env.DB.prepare(
        `SELECT a.id, a.mission_id AS missionId, a.title, a.owner_name AS owner, a.status
         FROM mission_actions a JOIN missions m ON m.id = a.mission_id WHERE m.operator_id = ?1 ORDER BY a.sort`,
      )
        .bind(OP)
        .all();
      return { missions: missions.results ?? [], actions: actions.results ?? [] };
    },
  },
  {
    name: "mission_action_update",
    risk: "write",
    description: "Change the status of one mission action.",
    parameters: {
      type: "object",
      properties: {
        action_id: { type: "string" },
        status: { type: "string", enum: ["pending", "active", "blocked", "complete"] },
      },
      required: ["action_id", "status"],
    },
    async run(env, args) {
      const status = need(args, "status", 20);
      if (!["pending", "active", "blocked", "complete"].includes(status)) throw new Error("bad status");
      const res = await env.DB.prepare(
        `UPDATE mission_actions SET status = ?1 WHERE id = ?2
         AND mission_id IN (SELECT id FROM missions WHERE operator_id = ?3)`,
      )
        .bind(status, need(args, "action_id", 80), OP)
        .run();
      if (!res.meta.changes) throw new Error("no mission action with that id");
      return { updated: true, status };
    },
  },
  {
    name: "activity_recent",
    risk: "read",
    description: "Read the most recent entries in the activity log.",
    parameters: { type: "object", properties: { limit: { type: "integer", minimum: 1, maximum: 30 } } },
    async run(env, args) {
      const limit = Math.min(30, Math.max(1, Number(args.limit) || 12));
      const rows = await env.DB.prepare(
        "SELECT at, actor, action, target, status, tokens FROM activity WHERE operator_id = ?1 ORDER BY at DESC LIMIT ?2",
      )
        .bind(OP, limit)
        .all();
      return { activity: rows.results ?? [] };
    },
  },
  {
    name: "inbox_post",
    risk: "write",
    description: "Leave a message for the operator in their Inbox. Use for questions or anything that needs a human.",
    parameters: {
      type: "object",
      properties: { title: { type: "string" }, preview: { type: "string", description: "The message body, a few sentences." } },
      required: ["title", "preview"],
    },
    async run(env, args, ctx) {
      const id = `in-${crypto.randomUUID().slice(0, 8)}`;
      await env.DB.prepare(
        `INSERT INTO inbox_items (id, operator_id, source, title, preview, tag, score, status, at)
         VALUES (?1,?2,?3,?4,?5,'agent',70,'new',?6)`,
      )
        .bind(id, OP, ctx.agentName, need(args, "title", 120), need(args, "preview", 600), new Date().toISOString())
        .run();
      return { posted: true, id };
    },
  },
];

const READ_ONLY = TOOLS.filter((t) => t.risk === "read").map((t) => t.name);

/** Which tools each agent may call. Anything not listed here gets the read-only set. */
const GRANTS: Record<string, string[]> = {
  marshal: [...READ_ONLY, "mission_action_update", "inbox_post"],
  keeper: [...READ_ONLY, "memory_write", "document_write"],
  atlas: [...READ_ONLY, "document_write"],
  beacon: [...READ_ONLY, "document_write"],
  nightwatch: [...READ_ONLY, "memory_write", "inbox_post"],
  forge: [...READ_ONLY, "inbox_post"],
};

export function toolsFor(agentId: string): Tool[] {
  const names = GRANTS[agentId] ?? READ_ONLY;
  return TOOLS.filter((t) => names.includes(t.name));
}
