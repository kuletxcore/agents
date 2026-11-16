export interface Env {
  DB: D1Database;
  CONFIG: KVNamespace;
  ASSETS: Fetcher;
  LLM_BASE_URL?: string;
  LLM_API_KEY?: string;
  LLM_MODEL?: string;
}

export const OP = "kuletx";
