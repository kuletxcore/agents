import { app } from "./api";
import { OP } from "./env";
import { llmMode, tooMany } from "./gate";
import { getRun, listRuns, resolveStep, startRun } from "./kernel/loop";
import { toolsFor } from "./kernel/tools";

app.get("/api/runs", async (c) => {
  const agents = await c.env.DB.prepare(
    "SELECT id, name, role FROM agents WHERE operator_id = ?1 ORDER BY is_primary DESC, name",
  )
    .bind(OP)
    .all<{ id: string; name: string; role: string }>();
  return c.json({
    llm: llmMode(c.env, c.req.header("x-kuletx-token")),
    runs: await listRuns(c.env),
    agents: (agents.results ?? []).map((a) => ({
      ...a,
      tools: toolsFor(a.id).map((t) => ({ name: t.name, risk: t.risk, description: t.description })),
    })),
  });
});

app.post("/api/runs", async (c) => {
  if (tooMany(c.req.header("cf-connecting-ip") ?? "", "runs", 12)) {
    return c.json({ error: "Too many runs. Wait a minute and try again." }, 429);
  }
  const body = (await c.req.json().catch(() => ({}))) as { agentId?: string; goal?: string };
  const goal = (body.goal || "").trim().slice(0, 2000);
  if (!goal) return c.json({ error: "Give the agent a goal." }, 400);
  const mode = llmMode(c.env, c.req.header("x-kuletx-token")) === "live" ? "live" : "demo";
  const id = await startRun(c.env, String(body.agentId || "marshal"), goal, mode);
  if (!id) return c.json({ error: "No agent with that id." }, 404);
  return c.json(await getRun(c.env, id));
});

app.get("/api/runs/:id", async (c) => {
  const run = await getRun(c.env, c.req.param("id"));
  return run ? c.json(run) : c.json({ error: "not found" }, 404);
});

app.post("/api/runs/:id/steps/:stepId", async (c) => {
  if (tooMany(c.req.header("cf-connecting-ip") ?? "", "runs-decide", 30)) {
    return c.json({ error: "Too many requests. Wait a minute and try again." }, 429);
  }
  const id = c.req.param("id");
  const current = await getRun(c.env, id);
  if (!current) return c.json({ error: "not found" }, 404);
  // Resuming a live run spends the model key, so it needs the operator token like starting one does.
  if (current.run.mode === "live" && llmMode(c.env, c.req.header("x-kuletx-token")) !== "live") {
    return c.json({ error: "This run uses the live model. Enter the operator token in Settings to continue it." }, 403);
  }
  const body = (await c.req.json().catch(() => ({}))) as { approve?: boolean };
  const outcome = await resolveStep(c.env, id, c.req.param("stepId"), body.approve === true);
  if (outcome === "not-pending") return c.json({ error: "That call was already decided." }, 409);
  return c.json(await getRun(c.env, id));
});
