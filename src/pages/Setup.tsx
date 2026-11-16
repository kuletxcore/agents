import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { Button, Card, Page, Ribbon, useToast } from "../components/ui";

const TOOLS: { id: string; label: string; detail: string }[] = [
  { id: "claude_code", label: "Claude Code", detail: "Detected in the demo snapshot" },
  { id: "codex", label: "Codex", detail: "Detected in the demo snapshot" },
  { id: "grok", label: "Grok", detail: "Not found" },
  { id: "gemini_cli", label: "Gemini CLI", detail: "Detected" },
  { id: "openrouter", label: "OpenRouter", detail: "Key noted in the demo env" },
  { id: "workers", label: "Workers", detail: "This deployment" },
  { id: "notion", label: "Notion", detail: "Not found" },
  { id: "vector_index", label: "Vector index", detail: "kx-agents-memory" },
  { id: "vault", label: "Vault", detail: "~/KuletXAI/vault" },
  { id: "telegram", label: "Telegram", detail: "Not found" },
];

const DIMENSIONS = [
  { id: "conversation", title: "Conversation analysis", body: "Cluster a week of requests. Flag work you still do by hand three times." },
  { id: "cost", title: "Cost intelligence", body: "Catch a frontier model doing file reads, weak cache hits, or oversized context." },
  { id: "skill", title: "Skill performance", body: "Archive dead skills, revive dormant ones, compose pairs that always run together." },
  { id: "memory", title: "Memory health", body: "Surface stale notes, missing files, and pairs that disagree." },
  { id: "session", title: "Session hygiene", body: "Point at token blow-ups and sessions that should have been trimmed." },
  { id: "workflow", title: "Workflow patterns", body: "Repeated command pairs become one skill." },
  { id: "external", title: "External opportunity", body: "Off by default. Looks for cheaper models and new connectors." },
  { id: "business", title: "Outcomes", body: "Checks whether claimed time saved showed up in a shipped artifact." },
];

const PRESETS = [20, 60, 150, 250, 1500];

export default function Setup() {
  const [step, setStep] = useState(0);
  const [cfg, setCfg] = useState<Record<string, unknown> | null>(null);
  const [openDim, setOpenDim] = useState<string | null>(null);
  const toast = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    api<Record<string, unknown>>("/api/config").then(setCfg).catch((e: Error) => toast(e.message));
  }, []);

  if (!cfg) return <div className="linking">Preparing briefing…</div>;
  const tools = (cfg.tools ?? {}) as Record<string, boolean>;
  const dims = (cfg.dreamDimensions ?? {}) as Record<string, boolean>;
  const enabled = Object.values(tools).filter(Boolean).length;
  const rate = Number(cfg.hourlyRate ?? 150);
  const preview = Math.round((37.9 * (30 / 28)) * rate);

  async function finish() {
    await api("/api/config", { method: "PUT", body: JSON.stringify({ ...cfg, wizardComplete: true }) });
    toast("Briefing saved");
    navigate("/");
  }

  return (
    <Page kicker={`STEP ${step + 1} OF 8`} title="Briefing" sub="This preview cannot scan a laptop. You are configuring the demo operator. A desktop companion can replace detection later.">
      <div className="wizard">
        <Card>
          <div className="steps">
            {Array.from({ length: 8 }, (_, i) => (
              <button key={i} className={`chip ${i === step ? "on" : ""}`} onClick={() => setStep(i)}><span>{i + 1}</span></button>
            ))}
          </div>
          {step === 0 ? (
            <>
              <Ribbon>Welcome</Ribbon>
              <h2>Who is operating?</h2>
              <input className="field" aria-label="Operator name" value={String(cfg.operatorName ?? "")} onChange={(e) => setCfg({ ...cfg, operatorName: e.target.value })} />
              <p className="muted">Handle {String(cfg.handle ?? "kuletx")} · timezone Asia/Manila</p>
            </>
          ) : null}
          {step === 1 ? (
            <>
              <Ribbon>Detect</Ribbon>
              <h2>Found on the demo bench</h2>
              <p>{enabled} of {TOOLS.length} enabled.</p>
              {TOOLS.map((t) => (
                <label key={t.id} className="row">
                  <span><strong>{t.label}</strong><div className="muted">{t.detail}</div></span>
                  <input type="checkbox" checked={!!tools[t.id]} onChange={(e) => setCfg({ ...cfg, tools: { ...tools, [t.id]: e.target.checked } })} />
                </label>
              ))}
            </>
          ) : null}
          {step === 2 ? (
            <>
              <Ribbon>Locate data</Ribbon>
              <h2>Where the demo says they live</h2>
              {Object.entries((cfg.paths ?? {}) as Record<string, string>).map(([k, v]) => (
                <label key={k} className="muted" style={{ display: "block", marginTop: 8 }}>{k}<input className="field" value={v} onChange={(e) => setCfg({ ...cfg, paths: { ...(cfg.paths as object), [k]: e.target.value } })} /></label>
              ))}
              <p className="muted">Counts in this step are from the seed, not a live disk scan.</p>
            </>
          ) : null}
          {step === 3 ? (
            <>
              <Ribbon>Memory</Ribbon>
              <h2>What should the cortex merge?</h2>
              {["claude", "chatgpt", "vault", "vector"].map((id) => {
                const list = (cfg.memorySources as string[]) ?? [];
                const on = list.includes(id);
                return (
                  <label key={id} className="row">
                    <span>{id}</span>
                    <input type="checkbox" checked={on} onChange={(e) => {
                      const next = e.target.checked ? [...list, id] : list.filter((x) => x !== id);
                      setCfg({ ...cfg, memorySources: next });
                    }} />
                  </label>
                );
              })}
            </>
          ) : null}
          {step === 4 ? (
            <>
              <Ribbon tone="yellow">Time value</Ribbon>
              <h2>What is an hour worth?</h2>
              <div className="seg">
                {PRESETS.map((p) => <button key={p} className={`chip ${rate === p ? "on" : ""}`} onClick={() => setCfg({ ...cfg, hourlyRate: p })}><span>${p}</span></button>)}
              </div>
              <input type="range" min={20} max={1500} value={rate} onChange={(e) => setCfg({ ...cfg, hourlyRate: Number(e.target.value) })} style={{ width: "100%" }} />
              <p>At ${rate}/hr, about 30 days of skill use in this demo is roughly ${preview.toLocaleString()} saved.</p>
            </>
          ) : null}
          {step === 5 ? (
            <>
              <Ribbon tone="cyan">Dream</Ribbon>
              <h2>When Nightwatch files cards</h2>
              <div className="seg">
                <button className={`chip ${cfg.dreamFrequency === "daily" ? "on" : ""}`} onClick={() => setCfg({ ...cfg, dreamFrequency: "daily" })}><span>Daily</span></button>
                <button className={`chip ${cfg.dreamFrequency === "weekly" ? "on" : ""}`} onClick={() => setCfg({ ...cfg, dreamFrequency: "weekly" })}><span>Weekly</span></button>
                <button className={`chip ${cfg.dreamWindow === "morning" ? "on" : ""}`} onClick={() => setCfg({ ...cfg, dreamWindow: "morning", dreamTime: "06:00" })}><span>Morning 06:00</span></button>
                <button className={`chip ${cfg.dreamWindow === "evening" ? "on" : ""}`} onClick={() => setCfg({ ...cfg, dreamWindow: "evening", dreamTime: "20:00" })}><span>Evening 20:00</span></button>
              </div>
              {DIMENSIONS.map((d) => (
                <div key={d.id} className="row">
                  <button style={{ background: "none", border: 0, textAlign: "left" }} onClick={() => setOpenDim(openDim === d.id ? null : d.id)}>
                    <strong>{d.title}</strong>
                    {openDim === d.id ? <div className="muted">{d.body}</div> : null}
                  </button>
                  <input type="checkbox" checked={dims[d.id] !== false && (d.id !== "external" || dims[d.id] === true)} onChange={(e) => setCfg({ ...cfg, dreamDimensions: { ...dims, [d.id]: e.target.checked } })} />
                </div>
              ))}
              <label className="row"><span>Allow web search during Dream</span><input type="checkbox" checked={!!cfg.webSearch} onChange={(e) => setCfg({ ...cfg, webSearch: e.target.checked })} /></label>
              <label className="row"><span>Fresh panel art each Dream (off — no image key required)</span><input type="checkbox" checked={!!cfg.heroImage} onChange={(e) => setCfg({ ...cfg, heroImage: e.target.checked })} /></label>
            </>
          ) : null}
          {step === 6 ? (
            <>
              <Ribbon>Review</Ribbon>
              <h2>The worker will read this config</h2>
              <p>The lobby re-reads it on each request. Reverse it anytime from Settings.</p>
            </>
          ) : null}
          {step === 7 ? (
            <>
              <Ribbon tone="yellow">You’re set</Ribbon>
              <h2>Open the lobby</h2>
              <p>Demo mode stays on until you deploy with your own Cloudflare token. Provider keys stay in worker secrets.</p>
              <Button onClick={() => void finish()}>Open lobby</Button>
            </>
          ) : null}
          <div className="pager" style={{ marginTop: 16 }}>
            <Button tone="ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>Back</Button>
            {step < 7 ? <Button onClick={() => setStep((s) => s + 1)}>Next</Button> : null}
          </div>
        </Card>
        <Card>
          <Ribbon>Live config</Ribbon>
          <pre className="json-view">{JSON.stringify(cfg, null, 2)}</pre>
          <Button small tone="ghost" onClick={() => { void navigator.clipboard.writeText(JSON.stringify(cfg, null, 2)); toast("Copied"); }}>Copy</Button>
        </Card>
      </div>
    </Page>
  );
}
