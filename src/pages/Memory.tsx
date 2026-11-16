import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { rel } from "../lib/format";
import { Button, Card, Page, Ribbon, useToast } from "../components/ui";

type Node = {
  id: string; title: string; path: string; workspace: string; source: string; kind: string;
  status: string; summary: string; x: number; y: number; sector: string; updated_at: string;
};
type Source = { id: string; name: string; enabled: number; lastIndexed: string };
type Payload = {
  nodes: Node[];
  edges: { id: string; source: string; target: string }[];
  sources: Source[];
  activity: { id: string; action: string; path: string; at: string }[];
  stale: Node[];
  issues: Node[];
  stats: { notes: number; stale: number; conflicts: number; missing: number; workspaces: number };
};

const SECTORS = [
  { id: "documents", label: "Documents", color: "#128afa" },
  { id: "messages", label: "Messages", color: "#4ac8ff" },
  { id: "notes", label: "Notes", color: "#ffd84d" },
  { id: "meetings", label: "Meetings", color: "#7aa2ff" },
  { id: "skills", label: "Skills", color: "#1aa36a" },
  { id: "sessions", label: "Sessions", color: "#ff8fb8" },
  { id: "decisions", label: "Decisions", color: "#12304f" },
];

export default function Memory() {
  const [data, setData] = useState<Payload | null>(null);
  const [view, setView] = useState<"cortex" | "network">("cortex");
  const [hover, setHover] = useState<string | null>(null);
  const [picked, setPicked] = useState<Node | null>(null);
  const toast = useToast();

  function load() {
    return api<Payload>("/api/memory").then(setData);
  }
  useEffect(() => { load().catch((e: Error) => toast(e.message)); }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, Node[]>();
    for (const s of SECTORS) map.set(s.id, []);
    for (const n of data?.nodes ?? []) {
      if (n.kind === "core") continue;
      const list = map.get(n.sector) ?? map.get("notes")!;
      list.push(n);
    }
    return map;
  }, [data]);

  if (!data) return <div className="linking">Indexing cortex…</div>;

  return (
    <Page
      kicker={`${data.stats.notes} FILES · ${data.stats.workspaces} WORKSPACES`}
      title="Cortex"
      sub="Your knowledge, connected. Hover a node to trace its links. Click to read the note."
      action={
        <div className="seg">
          <button className={`chip ${view === "cortex" ? "on" : ""}`} onClick={() => setView("cortex")}><span>Visual cortex</span></button>
          <button className={`chip ${view === "network" ? "on" : ""}`} onClick={() => setView("network")}><span>Network</span></button>
          <Button small onClick={() => api("/api/memory/refresh", { method: "POST" }).then(() => load()).then(() => toast("Index refreshed"))}>Refresh all</Button>
        </div>
      }
    >
      <div className="cortex-wrap">
        <Card>
          {view === "cortex" ? (
            <svg className="cortex" viewBox="0 0 640 460">
              {SECTORS.map((s, i) => {
                const start = -Math.PI / 2 + (i / SECTORS.length) * Math.PI * 2;
                const end = start + (Math.PI * 2) / SECTORS.length - 0.04;
                const nodes = (grouped.get(s.id) ?? []).slice(0, 28);
                return (
                  <g key={s.id}>
                    <path d={arc(320, 230, 150, 190, start, end)} fill={s.color} opacity="0.13" />
                    <text x={320 + Math.cos((start + end) / 2) * 206} y={230 + Math.sin((start + end) / 2) * 206} textAnchor="middle" fill="#1f3b5e" fontSize="11" fontFamily="Outfit">{s.label}</text>
                    {nodes.map((n, idx) => {
                      const t = start + ((idx + 0.5) / Math.max(nodes.length, 1)) * (end - start);
                      const rad = 78 + (idx % 5) * 18;
                      const x = 320 + Math.cos(t) * rad;
                      const y = 230 + Math.sin(t) * rad * 0.92;
                      return (
                        <circle key={n.id} cx={x} cy={y} r={n.status === "fresh" ? 3.2 : 5} fill={n.status === "conflict" ? "#ff4d6a" : n.status === "stale" ? "#d4924a" : s.color} onClick={() => setPicked(n)} style={{ cursor: "pointer" }}>
                          <title>{n.title}</title>
                        </circle>
                      );
                    })}
                  </g>
                );
              })}
              <circle cx="320" cy="230" r="46" fill="#12304F" />
              <text x="320" y="226" textAnchor="middle" fill="#fff" fontFamily="Exo 2" fontStyle="italic" fontWeight="800" fontSize="13">CORTEX</text>
              <text x="320" y="242" textAnchor="middle" fill="#ffd84d" fontSize="10" fontFamily="Outfit">{data.stats.notes}</text>
            </svg>
          ) : (
            <svg className="cortex" viewBox="0 0 100 70" onMouseLeave={() => setHover(null)}>
              {data.edges.map((e) => {
                const a = data.nodes.find((n) => n.id === e.source);
                const b = data.nodes.find((n) => n.id === e.target);
                if (!a || !b) return null;
                const hot = hover && (hover === a.id || hover === b.id);
                return <line key={e.id} x1={a.x} y1={a.y * 0.7} x2={b.x} y2={b.y * 0.7} stroke={hot ? "#128afa" : "rgba(31,59,94,0.18)"} strokeWidth={hot ? 0.5 : 0.15} />;
              })}
              {data.nodes.map((n) => (
                <circle key={n.id} cx={n.x} cy={n.y * 0.7} r={n.kind === "core" ? 2.2 : 0.9} fill={n.status === "conflict" ? "#ff4d6a" : n.status === "stale" ? "#d4924a" : n.status === "missing" ? "#ffd84d" : "#128afa"} onMouseEnter={() => setHover(n.id)} onClick={() => setPicked(n)} style={{ cursor: "pointer" }}>
                  <title>{n.title}</title>
                </circle>
              ))}
            </svg>
          )}
          <div className="muted">{data.stats.notes} memories · {data.stats.workspaces} workspaces · {data.stats.stale} stale · {data.stats.conflicts} conflicts · {data.stats.missing} missing</div>
        </Card>
        <Card>
          <Ribbon>Sources</Ribbon>
          {data.sources.map((s) => (
            <label key={s.id} className="row" style={{ cursor: "pointer" }}>
              <span>{s.name}</span>
              <input type="checkbox" checked={!!s.enabled} onChange={(e) => {
                void api(`/api/memory/sources/${s.id}`, { method: "POST", body: JSON.stringify({ enabled: e.target.checked }) }).then(load);
              }} />
            </label>
          ))}
          <p className="muted">Indexed {rel(data.sources[0]?.lastIndexed)}. Photos stay off until you enable them.</p>
          {picked ? (
            <div className="side-sheet">
              <strong>{picked.title}</strong>
              <div className="mono">{picked.path}</div>
              <p>{picked.summary}</p>
              <span className={`tag ${picked.status === "fresh" ? "ok" : picked.status === "conflict" ? "bad" : ""}`}>{picked.status}</span>
            </div>
          ) : null}
        </Card>
      </div>
      <div className="grid-3">
        <Card>
          <Ribbon>Recent activity</Ribbon>
          {data.activity.map((a) => (
            <div className="row" key={a.id}><span><span className="tag navy">{a.action}</span> {a.path}</span><span className="muted">{rel(a.at)}</span></div>
          ))}
        </Card>
        <Card>
          <Ribbon tone="yellow">Stale</Ribbon>
          {data.stale.map((n) => <div key={n.id} className="row"><span>{n.path}</span><span className="muted">{rel(n.updated_at)}</span></div>)}
          {data.stale.length === 0 ? <p>No stale notes in the current filter.</p> : null}
        </Card>
        <Card>
          <Ribbon tone="alert">Missing / conflict</Ribbon>
          {data.issues.map((n) => <div key={n.id} className="row"><div><strong>{n.title}</strong><div className="muted">{n.summary}</div></div><span className="tag bad">{n.status}</span></div>)}
        </Card>
      </div>
    </Page>
  );
}

function arc(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number) {
  const p = (r: number, a: number) => [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  const [x0, y0] = p(r1, a0);
  const [x1, y1] = p(r1, a1);
  const [x2, y2] = p(r0, a1);
  const [x3, y3] = p(r0, a0);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${x0},${y0} A${r1},${r1} 0 ${large} 1 ${x1},${y1} L${x2},${y2} A${r0},${r0} 0 ${large} 0 ${x3},${y3} Z`;
}
