export function operatorToken(): string {
  try {
    return sessionStorage.getItem("kx-operator-token") ?? "";
  } catch {
    return "";
  }
}

export function setOperatorToken(token: string) {
  if (token) sessionStorage.setItem("kx-operator-token", token);
  else sessionStorage.removeItem("kx-operator-token");
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = operatorToken();
  const res = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(token ? { "x-kuletx-token": token } : {}),
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
  llm: "demo" | "gated" | "live";
  hud: Hud;
  runtimes: { id: string; name: string; status: string; detail: string }[];
  greetingHour: number;
};
