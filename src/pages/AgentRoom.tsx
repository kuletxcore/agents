import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { rel } from "../lib/format";
import { AgentGlyph } from "../components/Glyph";
import { Button, Card, Meter, Page, Ribbon, useToast } from "../components/ui";

type Agent = {
  id: string; name: string; role: string; bio: string; status: string; model: string; hue: number; glyph: string;
  latency_ms: number; memory_tokens: number; memory_cap: number; soul: string; agent_memory: string; last_active: string;
};
type Msg = { id: string; role: string; body: string; at: string };

export default function AgentRoom() {
  const { id = "" } = useParams();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [personas, setPersonas] = useState<{ id: string; name: string; job: string; model: string; pinned: number }[]>([]);
  const [profile, setProfile] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const toast = useToast();

  useEffect(() => {
    api<{ agent: Agent; personas: typeof personas; profile: string }>(`/api/agents/${id}`)
      .then((r) => { setAgent(r.agent); setPersonas(r.personas); setProfile(r.profile); })
      .catch((e: Error) => toast(e.message));
    api<{ messages: Msg[] }>(`/api/agents/${id}/messages`).then((r) => setMessages(r.messages)).catch(() => {});
  }, [id]);

  async function send() {
    if (!text.trim()) return;
    const res = await api<{ messages: Msg[]; mode: string }>(`/api/agents/${id}/messages`, {
      method: "POST",
      body: JSON.stringify({ body: text }),
    });
    setMessages((m) => [...m, ...res.messages]);
    setText("");
    toast(res.mode === "live" ? "Live model" : "Demo reply");
  }

  if (!agent) return <div className="linking">Opening channel…</div>;
  const bridge = `# KuletXAI bridge (demo)\nRead the active mission before editing.\nWorkspace: ~/kuletx/agents\nDo not store provider keys in the repo.\nIf a secret is missing, stay in demo mode.`;

  return (
    <Page kicker={agent.role.toUpperCase()} title={agent.name} sub={agent.bio} action={<Link to="/agents"><Button tone="ghost">Back to squad</Button></Link>}>
      <div className="grid-2">
        <Card>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div className="avatar lg" style={{ background: `hsl(${agent.hue} 70% 46%)` }}><AgentGlyph glyph={agent.glyph} /></div>
            <div>
              <div className="muted">{agent.model} · {agent.status} · {agent.latency_ms} ms · {rel(agent.last_active)}</div>
              <Meter value={(agent.memory_tokens / agent.memory_cap) * 100} tone="cyan" />
              <div className="mono">{agent.memory_tokens.toLocaleString()} / {agent.memory_cap.toLocaleString()} memory tokens</div>
            </div>
          </div>
          <div className="chat" style={{ marginTop: 12 }}>
            {messages.map((m) => <div key={m.id} className={`bubble ${m.role === "user" ? "user" : ""}`}>{m.body}</div>)}
          </div>
          <form style={{ display: "flex", gap: 8, marginTop: 8 }} onSubmit={(e) => { e.preventDefault(); void send(); }}>
            <input className="composer" value={text} onChange={(e) => setText(e.target.value)} placeholder={`Message ${agent.name}`} aria-label={`Message ${agent.name}`} />
            <Button type="submit">Send</Button>
          </form>
          <div style={{ marginTop: 8 }}>
            <Button tone="ghost" small onClick={() => {
              const last = messages.filter((m) => m.role === "agent").at(-1);
              void api("/api/memory/notes", { method: "POST", body: JSON.stringify({ title: `Thread with ${agent.name}`, summary: last?.body ?? agent.bio }) })
                .then(() => toast("Saved into Cortex"));
            }}>Save thread to memory</Button>
          </div>
        </Card>
        <div className="stack">
          <Card>
            <Ribbon>Personas</Ribbon>
            {personas.map((p) => (
              <div className="row" key={p.id}>
                <div><strong>{p.name}</strong><div className="muted">{p.job}</div></div>
                <span className="mono">{p.model}{p.pinned ? " · pinned" : ""}</span>
              </div>
            ))}
            {personas.length === 0 ? <p className="muted">No personas on this agent.</p> : null}
          </Card>
          <Card>
            <Ribbon tone="yellow">Profile · memory · soul</Ribbon>
            <h3>Operator profile</h3>
            <pre className="prose" style={{ whiteSpace: "pre-wrap" }}>{profile}</pre>
            <h3>Agent memory</h3>
            <p>{agent.agent_memory}</p>
            <h3>Soul</h3>
            <p>{agent.soul}</p>
          </Card>
          <Card>
            <Ribbon>Bridge prompt</Ribbon>
            <pre className="mono" style={{ whiteSpace: "pre-wrap" }}>{bridge}</pre>
            <Button small onClick={() => { void navigator.clipboard.writeText(bridge); toast("Copied"); }}>Copy</Button>
          </Card>
        </div>
      </div>
    </Page>
  );
}
