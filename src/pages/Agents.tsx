import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { rel } from "../lib/format";
import { AgentGlyph } from "../components/Glyph";
import { Button, Card, Meter, Page, Ribbon, useToast } from "../components/ui";

type Agent = {
  id: string;
  name: string;
  role: string;
  bio: string;
  status: string;
  model: string;
  hue: number;
  glyph: string;
  is_primary: number;
  last_active: string;
  latency_ms: number;
  memory_tokens: number;
  memory_cap: number;
};

type Roster = {
  agents: Agent[];
  sharedMemory: boolean;
  primaryAgent: string;
  dispatchMode: string;
  committee: { orchestrator: string; delegates: string[]; cacheRatio: number };
  llm: string;
};

const BENCH = ["Claude Opus", "Claude Sonnet", "Claude Haiku", "GPT", "Grok", "DeepSeek", "Gemini", "Relay-mini"];

export default function Agents() {
  const [data, setData] = useState<Roster | null>(null);
  const [tab, setTab] = useState<"overview" | "roster" | "committee">("overview");
  const [mode, setMode] = useState<"ask-all" | "relay">("ask-all");
  const [shared, setShared] = useState(true);
  const [picked, setPicked] = useState<string[]>(["marshal", "atlas", "forge"]);
  const [prompt, setPrompt] = useState("What is left before the workers.dev cut?");
  const [pending, setPending] = useState<{ agents: { id: string; name: string }[]; prompt: string } | null>(null);
  const [result, setResult] = useState<{ replies: { agentId: string; name: string; body: string }[]; synthesis: string } | null>(null);
  const [committee, setCommittee] = useState({ orchestrator: "Claude Opus", delegates: ["GPT", "Grok", "DeepSeek"], cacheRatio: 0.62 });
  const toast = useToast();

  useEffect(() => {
    api<Roster>("/api/agents").then((r) => {
      setData(r);
      setMode(r.dispatchMode === "relay" ? "relay" : "ask-all");
      setShared(r.sharedMemory);
      setCommittee(r.committee);
    }).catch((e: Error) => toast(e.message));
  }, []);

  async function dispatch(confirmed: boolean) {
    const res = await api<{
      needsConfirm: boolean;
      agents?: { id: string; name: string }[];
      prompt?: string;
      replies?: { agentId: string; name: string; body: string }[];
      synthesis?: string;
    }>("/api/dispatch", {
      method: "POST",
      body: JSON.stringify({ prompt, mode, agentIds: picked, confirmed }),
    });
    if (res.needsConfirm) {
      setPending({ agents: res.agents ?? [], prompt: res.prompt ?? prompt });
      return;
    }
    setPending(null);
    setResult({ replies: res.replies ?? [], synthesis: res.synthesis ?? "" });
    toast(mode === "relay" ? "Relayed" : "Asked the squad");
  }

  const agents = data?.agents ?? [];
  const center = agents.filter((a) => picked.includes(a.id)).slice(0, 3);

  return (
    <Page
      kicker={data?.llm === "live" ? "LIVE MODEL" : data?.llm === "gated" ? "MODEL LOCKED" : "DEMO ADAPTER"}
      title="ARONA"
      sub="One desk for the squad. KuletXAI holds the memory. Agents answer here, then you decide what ships."
      action={
        <div className="seg">
          {(["overview", "roster", "committee"] as const).map((t) => (
            <button key={t} className={`chip ${tab === t ? "on" : ""}`} onClick={() => setTab(t)}><span>{t}</span></button>
          ))}
        </div>
      }
    >
      {tab === "overview" ? (
        <Card>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button className={`chip ${mode === "ask-all" ? "on" : ""}`} onClick={() => setMode("ask-all")}><span>Ask all</span></button>
            <button className={`chip ${mode === "relay" ? "on" : ""}`} onClick={() => setMode("relay")}><span>Relay</span></button>
            <button className={`chip ${shared ? "on" : ""}`} onClick={() => {
              const next = !shared;
              setShared(next);
              void api("/api/config", { method: "PUT", body: JSON.stringify({ sharedMemory: next }) });
            }}><span>{shared ? "Shared memory on" : "Shared memory off"}</span></button>
            <span className="muted">Primary: Marshal</span>
          </div>
          <div className="constellation">
            <svg viewBox="0 0 100 60" aria-hidden>
              <line x1="50" y1="30" x2="22" y2="40" stroke="#128afa" strokeWidth="0.4" />
              <line x1="50" y1="30" x2="78" y2="40" stroke="#128afa" strokeWidth="0.4" />
              <line x1="22" y1="40" x2="78" y2="40" stroke="#ffd84d" strokeWidth="0.3" />
            </svg>
            {center.map((a, i) => (
              <div key={a.id} className="node-float" style={{ left: `${i === 0 ? 50 : i === 1 ? 22 : 78}%`, top: `${i === 0 ? 42 : 68}%` }}>
                <div className="avatar" style={{ background: `hsl(${a.hue} 70% 48%)` }}><AgentGlyph glyph={a.glyph} /></div>
                <strong>{a.name}</strong>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
            {agents.map((a) => (
              <button key={a.id} className={`chip ${picked.includes(a.id) ? "on" : ""}`} onClick={() => setPicked((p) => p.includes(a.id) ? p.filter((x) => x !== a.id) : [...p, a.id].slice(0, 4))}>
                <span>{a.name}</span>
              </button>
            ))}
          </div>
          <form style={{ display: "flex", gap: 8, marginTop: 12 }} onSubmit={(e) => { e.preventDefault(); void dispatch(false); }}>
            <input className="composer" value={prompt} onChange={(e) => setPrompt(e.target.value)} aria-label="Ask the squad" />
            <Button type="submit">{mode === "relay" ? "Relay" : "Ask"}</Button>
          </form>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
            {["What is left before the workers.dev cut?", "Which notes are stale?", "Summarize spend against the $150 rate."].map((s) => (
              <button key={s} className="chip" onClick={() => setPrompt(s)}><span>{s}</span></button>
            ))}
          </div>
          {result ? (
            <div className="grid-3" style={{ marginTop: 12 }}>
              {result.replies.map((r) => (
                <div key={r.agentId} style={{ background: "rgba(18,138,250,0.06)", padding: 10, borderRadius: 12 }}>
                  <Ribbon>{r.name}</Ribbon>
                  <p style={{ whiteSpace: "pre-wrap" }}>{r.body}</p>
                  <Link to={`/agents/${r.agentId}`}>Open thread</Link>
                </div>
              ))}
            </div>
          ) : null}
          {result ? <p style={{ marginTop: 8 }}><strong>{result.synthesis}</strong></p> : null}
        </Card>
      ) : null}

      {tab === "roster" ? (
        <div className="grid-2">
          {agents.map((a) => (
            <Card key={a.id}>
              <div style={{ display: "flex", gap: 12 }}>
                <div className="avatar" style={{ background: `hsl(${a.hue} 70% 46%)` }}><AgentGlyph glyph={a.glyph} /></div>
                <div>
                  <h3>{a.name} {a.is_primary ? <span className="tag">PRIMARY</span> : null}</h3>
                  <div className="muted">{a.role} · {a.model} · {a.status}</div>
                  <p>{a.bio}</p>
                  <div className="mono">{a.latency_ms} ms · memory {a.memory_tokens.toLocaleString()} / {a.memory_cap.toLocaleString()} · {rel(a.last_active)}</div>
                  <Meter value={(a.memory_tokens / a.memory_cap) * 100} tone="cyan" />
                  <div style={{ marginTop: 8 }}><Link to={`/agents/${a.id}`}><Button small>Open</Button></Link></div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : null}

      {tab === "committee" ? (
        <Card>
          <Ribbon>The bench</Ribbon>
          <p className="muted">Pick an orchestrator and up to three delegates. The cache slider is the share of context you expect to reuse.</p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {BENCH.map((m) => (
              <button key={m} className={`chip ${committee.orchestrator === m ? "on" : ""}`} onClick={() => setCommittee({ ...committee, orchestrator: m })}><span>{m}</span></button>
            ))}
          </div>
          <h3 style={{ marginTop: 12 }}>Delegates</h3>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {BENCH.filter((m) => m !== committee.orchestrator).map((m) => (
              <button key={m} className={`chip ${committee.delegates.includes(m) ? "on" : ""}`} onClick={() => {
                const has = committee.delegates.includes(m);
                const delegates = has ? committee.delegates.filter((d) => d !== m) : [...committee.delegates, m].slice(0, 3);
                setCommittee({ ...committee, delegates });
              }}><span>{m}</span></button>
            ))}
          </div>
          <label className="muted" style={{ display: "block", marginTop: 12 }}>
            Cache ratio {Math.round(committee.cacheRatio * 100)}%
            <input type="range" min={0} max={100} value={committee.cacheRatio * 100} onChange={(e) => setCommittee({ ...committee, cacheRatio: Number(e.target.value) / 100 })} style={{ width: "100%" }} />
          </label>
          <p>Rough mix: orchestrator on the hard pass, delegates on the branches. At {Math.round(committee.cacheRatio * 100)}% cache, a repeat of this prompt is mostly a read.</p>
          <div style={{ display: "flex", gap: 8 }}>
            <Button onClick={() => {
              void api("/api/config", { method: "PUT", body: JSON.stringify({ committee }) }).then(() => toast("Committee saved"));
            }}>Save</Button>
            <Button tone="ghost" onClick={() => {
              const text = `Orchestrator: ${committee.orchestrator}. Delegates: ${committee.delegates.join(", ")}. Prefer cached context (${Math.round(committee.cacheRatio * 100)}%). Disagree in the open, then give one recommendation.`;
              void navigator.clipboard.writeText(text);
              toast("Prompt copied");
            }}>Copy prompt</Button>
          </div>
        </Card>
      ) : null}

      {pending ? (
        <div className="menu" role="dialog" aria-label="Confirm dispatch">
          <div className="menu-card">
            <Ribbon tone="yellow">Confirm dispatch</Ribbon>
            <h2 style={{ fontFamily: "var(--display)", fontStyle: "italic" }}>Send this to {pending.agents.map((a) => a.name).join(", ")}?</h2>
            <p>{pending.prompt}</p>
            <div style={{ display: "flex", gap: 8 }}>
              <Button tone="ghost" onClick={() => setPending(null)}>Cancel</Button>
              <Button onClick={() => void dispatch(true)}>Confirm</Button>
            </div>
          </div>
        </div>
      ) : null}
    </Page>
  );
}
