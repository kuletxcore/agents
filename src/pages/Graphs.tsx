import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { money, rel } from "../lib/format";
import { Button, Card, Page, Ribbon, useToast } from "../components/ui";

type Project = { id: string; name: string; language: string; files: number; edges: number; clusters: number; blurb: string; updatedAt: string; savings: number };
type Graph = {
  project: { id: string; name: string; files: number; edges: number; clusters: number; confidence_code: number; confidence_inferred: number; savings_est: number; blurb: string };
  clusters: { id: string; name: string; color: string; count: number; x: number; y: number }[];
  files: { path: string; rank: number; note: string }[];
  prompts: string[];
};

export default function Graphs() {
  const { projectId } = useParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [graph, setGraph] = useState<Graph | null>(null);
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState("");
  const [adding, setAdding] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    api<{ projects: Project[] }>("/api/projects").then((r) => setProjects(r.projects)).catch((e: Error) => toast(e.message));
  }, []);
  useEffect(() => {
    if (!projectId) { setGraph(null); return; }
    api<Graph>(`/api/projects/${projectId}/graph`).then(setGraph).catch((e: Error) => toast(e.message));
  }, [projectId]);

  async function ask(question: string) {
    if (!projectId) return;
    const res = await api<{ answer: string }>(`/api/projects/${projectId}/ask`, { method: "POST", body: JSON.stringify({ question }) });
    setAnswer(res.answer);
  }

  return (
    <Page kicker="SEEDED MAPS" title="Map" sub="Pick a project and ask from the graph. These clusters are precomputed. A later adapter can ingest a real code map.">
      {!projectId ? (
        <div className="grid-3">
          {projects.map((p) => (
            <button key={p.id} onClick={() => navigate(`/graphs/${p.id}`)} style={{ background: "none", border: 0, textAlign: "left", padding: 0 }}>
              <Card>
                <div className="muted">{p.language}</div>
                <h3 style={{ fontSize: 26 }}>{p.name}</h3>
                <p>{p.blurb}</p>
                <div className="mono">{p.files} files · {p.clusters} clusters · {rel(p.updatedAt)}</div>
                <div className="muted">Est. savings / session {money(p.savings)} — an estimate, not a promise.</div>
              </Card>
            </button>
          ))}
          <Card>
            <Ribbon>Add a project</Ribbon>
            <p>Local paths and GitHub URLs are recorded as a stub in this demo. The map is not cloned.</p>
            <Button onClick={() => { setAdding(true); toast("Demo stub: maps are seeded. A live ingest is not wired."); }}>Add path or repo</Button>
            {adding ? <p className="mono">github.com/kuletxcore/agents · waiting for an ingest adapter</p> : null}
          </Card>
        </div>
      ) : graph ? (
        <div className="grid-2">
          <Card>
            <Ribbon>{graph.project.name}</Ribbon>
            <p>{graph.project.blurb}</p>
            <svg viewBox="0 0 100 70" style={{ width: "100%", height: 320 }}>
              {graph.clusters.map((c) => (
                <g key={c.id}>
                  <circle cx={c.x} cy={c.y * 0.7} r={6 + c.count / 4} fill={c.color} opacity="0.85" />
                  <text x={c.x} y={c.y * 0.7 + 1} textAnchor="middle" fill="#12304f" fontSize="3" fontFamily="Outfit">{c.name}</text>
                </g>
              ))}
            </svg>
            <div style={{ display: "flex", gap: 8 }}>
              <Button tone="ghost" onClick={() => navigate("/graphs")}>All projects</Button>
            </div>
            <form style={{ display: "flex", gap: 8, marginTop: 10 }} onSubmit={(e) => { e.preventDefault(); void ask(q); }}>
              <input className="composer" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask this map" aria-label="Ask the project" />
              <Button type="submit">Ask</Button>
            </form>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
              {graph.prompts.map((p) => <button key={p} className="chip" onClick={() => { setQ(p); void ask(p); }}><span>{p}</span></button>)}
            </div>
            {answer ? <p style={{ whiteSpace: "pre-wrap" }}>{answer}</p> : null}
          </Card>
          <Card>
            <div className="stat">{graph.project.files}</div>
            <div className="muted">{graph.project.edges} edges · {graph.project.clusters} clusters</div>
            <h3>Map confidence</h3>
            <p>Found in files {Math.round(graph.project.confidence_code * 100)}% · Inferred {Math.round(graph.project.confidence_inferred * 100)}%</p>
            <h3>Important files</h3>
            {graph.files.map((f) => (
              <div className="row" key={f.path}><div><strong className="mono">{f.path}</strong><div className="muted">{f.note}</div></div><span>#{f.rank}</span></div>
            ))}
            <p>Est. savings / session {money(graph.project.savings_est)}. Estimate only.</p>
          </Card>
        </div>
      ) : <div className="linking">Loading map…</div>}
    </Page>
  );
}
