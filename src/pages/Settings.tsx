import { useEffect, useState } from "react";
import ModelDesk from "../components/ModelDesk";
import { Link } from "react-router-dom";
import { api, type Health } from "../lib/api";
import { Button, Card, Page, Ribbon, useToast } from "../components/ui";

export default function Settings() {
  const [cfg, setCfg] = useState<Record<string, unknown> | null>(null);
  const [health, setHealth] = useState<Health | null>(null);

  const toast = useToast();
  useEffect(() => {
    api<Record<string, unknown>>("/api/config").then(setCfg).catch((e: Error) => toast(e.message));
    api<Health>("/api/health").then(setHealth).catch(() => {});
  }, []);
  if (!cfg) return <div className="linking">Reading config…</div>;

  async function save(partial: Record<string, unknown>) {
    const next = await api<Record<string, unknown>>("/api/config", { method: "PUT", body: JSON.stringify(partial) });
    setCfg(next);
    toast("Saved");
  }

  return (
    <Page kicker="OPERATOR" title="Settings" sub="Keys never live in the browser. A model endpoint is a worker secret and is optional.">
      <ModelDesk health={health} onHealth={setHealth} />
      <div className="grid-2">
        <Card>
          <Ribbon>Identity</Ribbon>
          <label className="muted">Name<br /><input className="field" value={String(cfg.operatorName ?? "")} onChange={(e) => setCfg({ ...cfg, operatorName: e.target.value })} /></label>
          <label className="muted">Hourly rate<br /><input className="field" type="number" value={Number(cfg.hourlyRate ?? 150)} onChange={(e) => setCfg({ ...cfg, hourlyRate: Number(e.target.value) })} /></label>
          <label className="muted">Dream time (Asia/Manila)<br /><input className="field" value={String(cfg.dreamTime ?? "06:00")} onChange={(e) => setCfg({ ...cfg, dreamTime: e.target.value })} /></label>
          <div className="seg" style={{ marginTop: 8 }}>
            <button className={`chip ${cfg.dreamWindow === "morning" ? "on" : ""}`} onClick={() => setCfg({ ...cfg, dreamWindow: "morning" })}><span>Morning</span></button>
            <button className={`chip ${cfg.dreamWindow === "evening" ? "on" : ""}`} onClick={() => setCfg({ ...cfg, dreamWindow: "evening" })}><span>Evening</span></button>
          </div>
          <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
            <Button onClick={() => void save({ operatorName: cfg.operatorName, hourlyRate: cfg.hourlyRate, dreamTime: cfg.dreamTime, dreamWindow: cfg.dreamWindow })}>Save</Button>
            <Link to="/setup"><Button tone="ghost">Reopen briefing</Button></Link>
          </div>
        </Card>
        <Card>
          <Ribbon tone="yellow">Runtime</Ribbon>
          <p>Environment: <strong>{String(cfg.env ?? "demo")}</strong></p>
          <h3>Runtimes</h3>
          {(health?.runtimes ?? []).map((r) => (
            <div className="row" key={r.id}><span>{r.name}</span><span className={`tag ${r.status === "live" ? "ok" : ""}`}>{r.status}</span></div>
          ))}
          <p className="credit">by KuletXCore</p>
        </Card>
      </div>
    </Page>
  );
}
