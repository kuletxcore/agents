import { app, runDream } from "./api";
import type { Env } from "./env";
import { ensureReady } from "./seed";
import "./runs";

app.all("*", async (c) => {
  if (c.req.path.startsWith("/api")) return c.json({ error: "not found" }, 404);
  const assets = c.env.ASSETS;
  if (assets) return assets.fetch(c.req.raw);
  return c.notFound();
});

export default {
  fetch: app.fetch,
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      (async () => {
        await ensureReady(env);
        await runDream(env, "cron");
      })(),
    );
  },
} satisfies ExportedHandler<Env>;
