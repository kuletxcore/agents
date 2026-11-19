# KuletXAI contributor guide

These instructions apply to human contributors and coding assistants of any model family. No Claude account or assistant-specific tooling is required.

- `src/`: React console. Follow `DESIGN.md` and keep new rooms lazy-loaded.
- `worker/`: Hono routes and D1-backed workflows. `worker/kernel/model.ts` normalizes provider responses; `loop.ts` handles grants and approvals. Never execute a proposed write inside a provider adapter.
- `seed/catalog.ts`: public demo fixtures, not real credentials or live model routing.
- `migrations/`: D1 schema source. `npm run build` regenerates `worker/schema.ts`.
- Develop with `npm ci` and `npm run dev`. Verify with `npm run typecheck`, `npx tsc -p tsconfig.worker.json`, `npm run test:model`, and `npm run build` (Node 22.12+).
- Keep provider secrets server-side. Test adapters with mocked responses; do not call a paid endpoint as a test default.

The optional skills under `.claude/skills/` are readable Markdown references. The console and Worker do not depend on them.
