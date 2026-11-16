-- Kernel: agent runs and their step-by-step trace.

CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  operator_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  goal TEXT NOT NULL,
  -- running | waiting (on operator approval) | done | failed
  status TEXT NOT NULL,
  -- demo (scripted planner) | live (model)
  mode TEXT NOT NULL,
  -- Chat-completions message array, the run's working memory.
  transcript TEXT NOT NULL,
  turns INTEGER NOT NULL,
  max_turns INTEGER NOT NULL,
  tokens_in INTEGER NOT NULL,
  tokens_out INTEGER NOT NULL,
  result TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS run_steps (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  -- note | tool | final | error
  kind TEXT NOT NULL,
  tool TEXT,
  call_id TEXT,
  input TEXT,
  output TEXT,
  -- ok | pending | denied | error
  status TEXT NOT NULL,
  at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_runs_op ON runs(operator_id, created_at);
CREATE INDEX IF NOT EXISTS idx_steps_run ON run_steps(run_id, seq);
