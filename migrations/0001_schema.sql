-- KuletXAI schema. The worker also bootstraps this SQL on first request
-- when the tables are missing, then loads seed/catalog.json.

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS operators (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  handle TEXT NOT NULL,
  timezone TEXT NOT NULL,
  hourly_rate REAL NOT NULL,
  workspace TEXT NOT NULL,
  env TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS config (
  operator_id TEXT PRIMARY KEY,
  json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  operator_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  plan TEXT NOT NULL,
  monthly_price REAL NOT NULL,
  accent TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS usage_windows (
  id TEXT PRIMARY KEY,
  operator_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  label TEXT NOT NULL,
  used REAL NOT NULL,
  cap REAL NOT NULL,
  unit TEXT NOT NULL,
  resets TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS usage_days (
  operator_id TEXT NOT NULL,
  day TEXT NOT NULL,
  spent REAL NOT NULL,
  hours_saved REAL NOT NULL,
  sessions INTEGER NOT NULL,
  focus_hours REAL NOT NULL,
  tokens INTEGER NOT NULL,
  PRIMARY KEY (operator_id, day)
);

CREATE TABLE IF NOT EXISTS skills (
  id TEXT PRIMARY KEY,
  operator_id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  invocations INTEGER NOT NULL,
  last_used TEXT NOT NULL,
  avg_tokens INTEGER NOT NULL,
  est_minutes REAL NOT NULL,
  error_rate REAL NOT NULL,
  state TEXT NOT NULL,
  hours_saved_28d REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  operator_id TEXT NOT NULL,
  title TEXT NOT NULL,
  path TEXT NOT NULL,
  workspace TEXT NOT NULL,
  source TEXT NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  summary TEXT NOT NULL,
  x REAL NOT NULL,
  y REAL NOT NULL,
  sector TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS memory_edges (
  id TEXT PRIMARY KEY,
  operator_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  target_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS memory_sources (
  id TEXT PRIMARY KEY,
  operator_id TEXT NOT NULL,
  name TEXT NOT NULL,
  enabled INTEGER NOT NULL,
  last_indexed TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS memory_activity (
  id TEXT PRIMARY KEY,
  operator_id TEXT NOT NULL,
  action TEXT NOT NULL,
  path TEXT NOT NULL,
  at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS dream_templates (
  id TEXT PRIMARY KEY,
  operator_id TEXT NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  evidence TEXT NOT NULL,
  try_command TEXT,
  impact TEXT NOT NULL,
  sort INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS dream_items (
  id TEXT PRIMARY KEY,
  operator_id TEXT NOT NULL,
  template_id TEXT,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  evidence TEXT NOT NULL,
  try_command TEXT,
  impact TEXT NOT NULL,
  status TEXT NOT NULL,
  sort INTEGER NOT NULL,
  generated_at TEXT NOT NULL,
  generated_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  operator_id TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  bio TEXT NOT NULL,
  status TEXT NOT NULL,
  model TEXT NOT NULL,
  hue INTEGER NOT NULL,
  glyph TEXT NOT NULL,
  is_primary INTEGER NOT NULL,
  last_active TEXT NOT NULL,
  latency_ms INTEGER NOT NULL,
  memory_tokens INTEGER NOT NULL,
  memory_cap INTEGER NOT NULL,
  soul TEXT NOT NULL,
  agent_memory TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_personas (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  name TEXT NOT NULL,
  job TEXT NOT NULL,
  model TEXT NOT NULL,
  pinned INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS threads (
  id TEXT PRIMARY KEY,
  operator_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  title TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  role TEXT NOT NULL,
  body TEXT NOT NULL,
  at TEXT NOT NULL,
  agent_id TEXT
);

CREATE TABLE IF NOT EXISTS missions (
  id TEXT PRIMARY KEY,
  operator_id TEXT NOT NULL,
  title TEXT NOT NULL,
  metric TEXT NOT NULL,
  days_remaining INTEGER NOT NULL,
  status TEXT NOT NULL,
  summary TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS mission_actions (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT NOT NULL,
  owner TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  status TEXT NOT NULL,
  sort INTEGER NOT NULL,
  prompt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  operator_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  kind TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  body TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS schedules (
  id TEXT PRIMARY KEY,
  operator_id TEXT NOT NULL,
  name TEXT NOT NULL,
  cadence TEXT NOT NULL,
  cron TEXT NOT NULL,
  last_run TEXT,
  next_run TEXT,
  status TEXT NOT NULL,
  enabled INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS integrations (
  id TEXT PRIMARY KEY,
  operator_id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  connected INTEGER NOT NULL,
  last_sync TEXT,
  detail TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS knowledge_systems (
  id TEXT PRIMARY KEY,
  operator_id TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  count_label TEXT NOT NULL,
  last_sync TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  operator_id TEXT NOT NULL,
  name TEXT NOT NULL,
  language TEXT NOT NULL,
  files INTEGER NOT NULL,
  edges INTEGER NOT NULL,
  clusters INTEGER NOT NULL,
  blurb TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  confidence_code REAL NOT NULL,
  confidence_inferred REAL NOT NULL,
  savings_est REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS project_clusters (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  count INTEGER NOT NULL,
  x REAL NOT NULL,
  y REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS project_files (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  path TEXT NOT NULL,
  rank INTEGER NOT NULL,
  note TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS project_qa (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS activity (
  id TEXT PRIMARY KEY,
  operator_id TEXT NOT NULL,
  at TEXT NOT NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT NOT NULL,
  status TEXT NOT NULL,
  cost REAL NOT NULL,
  tokens INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS inbox_items (
  id TEXT PRIMARY KEY,
  operator_id TEXT NOT NULL,
  source TEXT NOT NULL,
  title TEXT NOT NULL,
  preview TEXT NOT NULL,
  tag TEXT NOT NULL,
  score INTEGER NOT NULL,
  status TEXT NOT NULL,
  at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS calendar_events (
  id TEXT PRIMARY KEY,
  operator_id TEXT NOT NULL,
  title TEXT NOT NULL,
  at TEXT NOT NULL,
  kind TEXT NOT NULL,
  owner TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS runtimes (
  id TEXT PRIMARY KEY,
  operator_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  detail TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_skills_op ON skills(operator_id);
CREATE INDEX IF NOT EXISTS idx_mem_op ON memories(operator_id);
CREATE INDEX IF NOT EXISTS idx_act_op ON activity(operator_id, at);
CREATE INDEX IF NOT EXISTS idx_msg_thread ON messages(thread_id, at);
