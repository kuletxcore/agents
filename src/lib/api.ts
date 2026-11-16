export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const message = (data && (data.error as string)) || res.statusText;
    throw new Error(message);
  }
  return data as T;
}

export type Hud = {
  budgetLeft: number;
  budgetCap: number;
  tokensToday: number;
  tasksDone: number;
  tasksTotal: number;
  agentsActive: number;
  operator: string;
  workspace: string;
  env: string;
};

export type Health = {
  ok: boolean;
  llm: "demo" | "live";
  hud: Hud;
  runtimes: { id: string; name: string; status: string; detail: string }[];
  greetingHour: number;
};
