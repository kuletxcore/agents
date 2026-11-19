export interface Env {
  DB: D1Database;
  CONFIG: KVNamespace;
  ASSETS: Fetcher;
  LLM_BASE_URL?: string;
  LLM_API_KEY?: string;
  LLM_PROTOCOL?: string;
  LLM_MODEL?: string;
  /** Shared gate. Live model calls are refused unless the request presents this value. */
  OPERATOR_TOKEN?: string;
}

export const OP = "kuletx";
