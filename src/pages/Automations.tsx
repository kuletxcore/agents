import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { rel, when } from "../lib/format";
import { Button, Card, Page, useToast } from "../components/ui";

type Row = { id: string; name: string; cadence: string; cron: string; last_run: string; next_run: string; status: string; enabled: number };

export default function Automations() {
  const [rows, setRows] = useState<Row[]>([]);
  const toast = useToast();
  function load() {
    return api<{ schedules: Row[] }>("/api/schedules").then((r) => setRows(r.schedules));
  }
  useEffect(() => { load().catch((e: Error) => toast(e.message)); }, []);

  return (
    <Page kicker="NIGHTWATCH AND FRIENDS" title="Patrol" sub="Enable, disable, or run a job against the demo executor. The dream cron is 06:00 Asia/Manila.">
      <Card>
        <table className="table">
          <thead><tr><th>NAME</th><th>CADENCE</th><th>LAST</th><th>NEXT</th><th>STATUS</th><th></th></tr></thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id}>
                <td>{s.name}<div className="mono">{s.cron}</div></td>
                <td>{s.cadence}</td>
                <td>{rel(s.last_run)}<div className="muted">{when(s.last_run)}</div></td>
                <td>{when(s.next_run)}</td>
                <td><span className={`tag ${s.status === "ok" ? "ok" : "bad"}`}>{s.enabled ? s.status : "off"}</span></td>
                <td style={{ display: "flex", gap: 6 }}>
                  <Button small tone="ghost" onClick={() => api(`/api/schedules/${s.id}`, { method: "POST", body: JSON.stringify({ enabled: !s.enabled }) }).then(load).then(() => toast(s.enabled ? "Disabled" : "Enabled"))}>{s.enabled ? "Disable" : "Enable"}</Button>
                  <Button disabled={s.id !== "sched-dream"} small onClick={() => api(`/api/schedules/${s.id}/run`, { method: "POST" }).then(load).then(() => toast(`Ran ${s.name}`))}>{s.id === "sched-dream" ? "Run now" : "Demo only"}</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </Page>
  );
}
