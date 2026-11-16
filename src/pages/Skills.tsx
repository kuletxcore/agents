import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { money, rel } from "../lib/format";
import { Button, Card, Meter, Page, Ribbon, useToast } from "../components/ui";

type Skill = {
  id: string; name: string; category: string; description: string; invocations: number; last_used: string;
  avg_tokens: number; est_minutes: number; error_rate: number; state: string; hours_saved_28d: number; saved: number;
};
type Payload = { rate: number; hours: number; saved: number; counts: { total: number; active: number; dormant: number; dead: number; invocations: number }; skills: Skill[] };

const PRESETS = [20, 60, 150, 250, 1500];

export default function Skills() {
  const [data, setData] = useState<Payload | null>(null);
  const [cat, setCat] = useState("All");
  const [open, setOpen] = useState<Skill | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [range, setRange] = useState<"day" | "week" | "month">("month");
  const toast = useToast();

  function load() {
    return api<Payload>("/api/skills").then(setData);
  }
  useEffect(() => { load().catch((e: Error) => toast(e.message)); }, []);

  const cats = useMemo(() => ["All", ...new Set(data?.skills.map((s) => s.category) ?? [])], [data]);
  const factor = range === "day" ? 1 / 28 : range === "week" ? 7 / 28 : 1;
  const rows = (data?.skills ?? []).filter((s) => cat === "All" || s.category === cat);
  const max = Math.max(...rows.map((s) => s.hours_saved_28d), 0.1);

  async function setRate(rate: number) {
    await api("/api/config", { method: "PUT", body: JSON.stringify({ hourlyRate: rate }) });
    await load();
  }
  async function setState(id: string, state: string) {
    await api(`/api/skills/${id}`, { method: "POST", body: JSON.stringify({ state }) });
    toast(`Marked ${state}`);
    await load();
  }

  if (!data) return <div className="linking">Counting craft…</div>;
  const shownSaved = data.saved * factor;
  const shownHours = data.hours * factor;

  return (
    <Page
      kicker={`${data.counts.total} CAPABILITIES · ${data.counts.invocations} RUNS`}
      title="Craft"
      sub="Time saved is invocations × minutes, priced at your hourly rate. Per-run minutes are an estimate."
      action={
        <div className="seg">
          {(["day", "week", "month"] as const).map((r) => (
            <button key={r} className={`chip ${range === r ? "on" : ""}`} onClick={() => setRange(r)}><span>{r}</span></button>
          ))}
        </div>
      }
    >
      <Card>
        <Ribbon tone="cyan">{shownHours.toFixed(1)}h · {money(shownSaved, 0)}</Ribbon>
        <p>At ${data.rate}/hr. Active {data.counts.active} · dormant {data.counts.dormant} · dead {data.counts.dead}.</p>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {PRESETS.map((p) => (
            <button key={p} className={`chip ${data.rate === p ? "on" : ""}`} onClick={() => void setRate(p)}><span>${p}/hr</span></button>
          ))}
        </div>
        <label className="muted">
          Rate ${data.rate}
          <input type="range" min={20} max={1500} value={data.rate} onChange={(e) => void setRate(Number(e.target.value))} style={{ width: "100%" }} />
        </label>
      </Card>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {cats.map((c) => <button key={c} className={`chip ${cat === c ? "on" : ""}`} onClick={() => setCat(c)}><span>{c}</span></button>)}
      </div>
      <Card>
        {rows.map((s) => (
          <div className="row" key={s.id}>
            <button style={{ background: "none", border: 0, textAlign: "left" }} onClick={() => setOpen(s)}>
              <strong>{s.name}</strong>
              <div className="muted">{s.category} · {s.state} · {rel(s.last_used)}</div>
              <div style={{ width: 180, marginTop: 4 }}><Meter value={(s.hours_saved_28d / max) * 100} tone="cyan" /></div>
            </button>
            <div style={{ textAlign: "right" }}>
              <b>{money(s.saved * factor, 0)}</b>
              <div className="muted">{(s.hours_saved_28d * factor).toFixed(1)}h</div>
              <button className="chip" onClick={() => setPicked((p) => p.includes(s.id) ? p.filter((x) => x !== s.id) : [...p, s.id].slice(-2))}><span>{picked.includes(s.id) ? "Picked" : "Compose"}</span></button>
            </div>
          </div>
        ))}
        {picked.length === 2 ? (
          <Button onClick={() => {
            void api("/api/skills/compose", { method: "POST", body: JSON.stringify({ ids: picked }) })
              .then(() => { setPicked([]); return load(); })
              .then(() => toast("Composed"));
          }}>Compose the pair</Button>
        ) : null}
      </Card>
      {open ? (
        <div className="menu" onClick={() => setOpen(null)}>
          <div className="menu-card" onClick={(e) => e.stopPropagation()}>
            <Ribbon>{open.category}</Ribbon>
            <h2 style={{ fontFamily: "var(--display)", fontStyle: "italic" }}>{open.name}</h2>
            <p>{open.description}</p>
            <p className="mono">{open.invocations} runs · {open.avg_tokens} avg tokens · {(open.error_rate * 100).toFixed(1)}% errors · ~{open.est_minutes} min</p>
            <div style={{ display: "flex", gap: 8 }}>
              <Button onClick={() => void setState(open.id, "active")}>Revive</Button>
              <Button tone="ghost" onClick={() => void setState(open.id, "dormant")}>Archive</Button>
              <Button tone="alert" onClick={() => void setState(open.id, "dead")}>Retire</Button>
            </div>
          </div>
        </div>
      ) : null}
    </Page>
  );
}
