import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { rel } from "../lib/format";
import { Button, Card, Page, Ribbon, useToast } from "../components/ui";

type Tile = { id: string; name: string; category: string; connected: number; last_sync: string | null; detail: string };
type Know = { id: string; name: string; kind: string; count_label: string; last_sync: string };

export default function Integrations() {
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [knowledge, setKnowledge] = useState<Know[]>([]);
  const [ask, setAsk] = useState<Tile | null>(null);
  const toast = useToast();
  function load() {
    return api<{ integrations: Tile[]; knowledge: Know[] }>("/api/integrations").then((r) => {
      setTiles(r.integrations);
      setKnowledge(r.knowledge);
    });
  }
  useEffect(() => { load().catch((e: Error) => toast(e.message)); }, []);

  return (
    <Page kicker="CONNECTORS" title="Links" sub="Status and last sync only. Connect marks the tile in the demo database. No OAuth runs from this page.">
      <div className="grid-3">
        {tiles.map((t) => (
          <Card key={t.id}>
            <span className={`tag ${t.connected ? "ok" : ""}`}>{t.connected ? "LINKED" : "OPEN"}</span>
            <h3>{t.name}</h3>
            <div className="muted">{t.category} · {t.last_sync ? rel(t.last_sync) : "never"}</div>
            <p>{t.detail}</p>
            {!t.connected ? <Button small onClick={() => setAsk(t)}>Connect</Button> : null}
          </Card>
        ))}
      </div>
      <Card>
        <Ribbon>Knowledge systems</Ribbon>
        {knowledge.map((k) => (
          <div className="row" key={k.id}>
            <div><strong>{k.name}</strong><div className="muted">{k.kind} · {k.count_label}</div></div>
            <span className="muted">{rel(k.last_sync)}</span>
          </div>
        ))}
      </Card>
      {ask ? (
        <div className="menu" onClick={() => setAsk(null)}>
          <div className="menu-card" onClick={(e) => e.stopPropagation()}>
            <Ribbon>Connect {ask.name}</Ribbon>
            <p>This demo records the tile as linked. It does not open a provider login.</p>
            <div style={{ display: "flex", gap: 8 }}>
              <Button tone="ghost" onClick={() => setAsk(null)}>Cancel</Button>
              <Button onClick={() => {
                void api(`/api/integrations/${ask.id}/connect`, { method: "POST" }).then(load).then(() => {
                  toast(`${ask.name} marked linked`);
                  setAsk(null);
                });
              }}>Mark linked</Button>
            </div>
          </div>
        </div>
      ) : null}
    </Page>
  );
}
