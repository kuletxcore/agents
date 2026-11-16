import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { money, when } from "../lib/format";
import { Card, Page, useToast } from "../components/ui";

type Ev = { id: string; at: string; actor: string; action: string; target: string; status: string; cost: number; tokens: number };

export default function Activity() {
  const [events, setEvents] = useState<Ev[]>([]);
  const [actor, setActor] = useState("");
  const [status, setStatus] = useState("");
  const toast = useToast();

  useEffect(() => {
    const q = new URLSearchParams();
    if (actor) q.set("actor", actor);
    if (status) q.set("status", status);
    api<{ events: Ev[] }>(`/api/activity?${q.toString()}`)
      .then((r) => setEvents(r.events))
      .catch((e: Error) => toast(e.message));
  }, [actor, status]);

  const actors = ["", "Kulet", "Marshal", "Forge", "Atlas", "Relay", "Keeper", "Nightwatch", "Beacon", "ARONA"];
  return (
    <Page kicker="AUDIT" title="Log" sub="Who did what, to which target, and what it cost in the demo ledger.">
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <select className="field" style={{ maxWidth: 200 }} value={actor} onChange={(e) => setActor(e.target.value)} aria-label="Filter by actor">
          {actors.map((a) => <option key={a} value={a}>{a || "All actors"}</option>)}
        </select>
        <select className="field" style={{ maxWidth: 200 }} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
          {["", "ok", "failed", "warn"].map((s) => <option key={s} value={s}>{s || "All statuses"}</option>)}
        </select>
      </div>
      <Card>
        <table className="table">
          <thead><tr><th>WHEN</th><th>ACTOR</th><th>ACTION</th><th>TARGET</th><th>STATUS</th><th>COST</th></tr></thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id}>
                <td className="mono">{when(e.at)}</td>
                <td>{e.actor}</td>
                <td>{e.action}</td>
                <td>{e.target}</td>
                <td><span className={`tag ${e.status === "ok" ? "ok" : e.status === "failed" ? "bad" : ""}`}>{e.status}</span></td>
                <td className="mono">{e.cost ? money(e.cost) : "—"} · {e.tokens ? `${e.tokens}` : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {events.length === 0 ? <p>No rows for that filter.</p> : null}
      </Card>
    </Page>
  );
}
