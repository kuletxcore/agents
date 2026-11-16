import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { rel } from "../lib/format";
import { Button, Card, Page, useToast } from "../components/ui";

type Item = { id: string; source: string; title: string; preview: string; tag: string; score: number; status: string; at: string };
const ROUTE: Record<string, string> = { finance: "keeper", code: "forge", mission: "marshal", community: "beacon", memory: "atlas", ops: "forge" };

export default function Inbox() {
  const [items, setItems] = useState<Item[]>([]);
  const toast = useToast();
  function load() { return api<{ items: Item[] }>("/api/inbox").then((r) => setItems(r.items)); }
  useEffect(() => { load().catch((e: Error) => toast(e.message)); }, []);

  return (
    <Page kicker="RELAY" title="Inbox" sub="Relay scores the pile so a frontier model is not spent on the sort.">
      {items.map((item) => (
        <Card key={item.id}>
          <div className="row" style={{ border: 0 }}>
            <div>
              <span className="tag">{item.tag} · {item.score}</span>
              <h3>{item.title}</h3>
              <p>{item.preview}</p>
              <div className="muted">{item.source} · {rel(item.at)} · {item.status}</div>
            </div>
            {item.status === "new" ? (
              <div style={{ display: "flex", gap: 6 }}>
                <Button small onClick={() => api(`/api/inbox/${item.id}`, { method: "POST", body: JSON.stringify({ status: "routed", agentId: ROUTE[item.tag] ?? "marshal" }) }).then(load).then(() => toast(`Routed to ${ROUTE[item.tag] ?? "marshal"}`))}>Route</Button>
                <Button small tone="ghost" onClick={() => api(`/api/inbox/${item.id}`, { method: "POST", body: JSON.stringify({ status: "archived" }) }).then(load)}>Archive</Button>
              </div>
            ) : <span className="tag ok">{item.status}</span>}
          </div>
        </Card>
      ))}
    </Page>
  );
}
