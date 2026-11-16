import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";
import { Button, Card, Page, Ribbon, useToast } from "../components/ui";

type Mission = { id: string; title: string; metric: string; days_remaining: number; status: string; summary: string };
type Action = { id: string; mission_id: string; title: string; detail: string; owner: string; owner_name: string; status: string; sort: number; prompt: string };

export default function Missions() {
  const { id } = useParams();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [page, setPage] = useState(0);
  const toast = useToast();

  function load() {
    return api<{ missions: Mission[]; actions: Action[] }>("/api/missions").then((r) => {
      setMissions(r.missions);
      setActions(r.actions);
    });
  }
  useEffect(() => { load().catch((e: Error) => toast(e.message)); }, []);

  const mission = missions.find((m) => m.id === id) ?? missions[0];
  const mine = actions.filter((a) => a.mission_id === mission?.id).sort((a, b) => a.sort - b.sort);
  const window = mine.slice(page, page + 3);
  const done = mine.filter((a) => a.status === "complete").length;

  async function mark(aid: string, status: string) {
    await api(`/api/missions/${mission?.id}/actions/${aid}`, { method: "POST", body: JSON.stringify({ status }) });
    toast(status === "complete" ? "Marked complete" : "Updated");
    await load();
  }

  if (!mission) return <div className="linking">Loading mission…</div>;

  return (
    <Page kicker={`${mission.status.toUpperCase()} · ${mission.days_remaining} DAYS LEFT`} title="Missions" sub={mission.summary}>
      <Card>
        <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 16 }}>
          <Diagram done={done} total={mine.length} />
          <div>
            <Ribbon>{done} of {mine.length} complete</Ribbon>
            <h2 style={{ fontSize: 32, margin: "8px 0" }}>{mission.title}</h2>
            <p>{mission.metric}</p>
          </div>
        </div>
        <div className="pager" style={{ marginTop: 8 }}>
          <span className="muted">Actions {page + 1}–{Math.min(page + 3, mine.length)} of {mine.length}</span>
          <div style={{ display: "flex", gap: 8 }}>
            <Button tone="ghost" small disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 3))}>Prev</Button>
            <Button tone="ghost" small disabled={page + 3 >= mine.length} onClick={() => setPage((p) => p + 3)}>Next</Button>
          </div>
        </div>
        <div className="grid-3" style={{ marginTop: 10 }}>
          {window.map((a) => (
            <div key={a.id} style={{ background: "rgba(18,138,250,0.05)", padding: 12, borderRadius: 16 }}>
              <span className={`tag ${a.owner === "operator" ? "yellow" : "navy"}`}>{a.owner === "operator" ? "OPERATOR" : a.owner_name.toUpperCase()}</span>
              <h3 style={{ fontSize: 22 }}>{a.title}</h3>
              <p>{a.detail}</p>
              <div className="muted">Status: {a.status}</div>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <Button small tone="ghost" onClick={() => { void navigator.clipboard.writeText(a.prompt); toast("Brief copied"); }}>Copy</Button>
                {a.status !== "complete" ? <Button small onClick={() => void mark(a.id, "complete")}>Mark complete</Button> : <Button small tone="yellow" onClick={() => void mark(a.id, "pending")}>Reopen</Button>}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </Page>
  );
}

function Diagram({ done, total }: { done: number; total: number }) {
  const r = total ? done / total : 0;
  return (
    <svg viewBox="0 0 160 160" aria-label="Progress diagram">
      <circle cx="80" cy="80" r="58" fill="none" stroke="rgba(18,48,79,0.12)" strokeWidth="12" />
      <circle cx="80" cy="80" r="58" fill="none" stroke="#128afa" strokeWidth="12" strokeDasharray={`${r * 364} 364`} strokeLinecap="round" transform="rotate(-90 80 80)" />
      <circle cx="80" cy="80" r="34" fill="#12304F" />
      <text x="80" y="86" textAnchor="middle" fill="#FFD84D" fontFamily="Exo 2" fontStyle="italic" fontWeight="800" fontSize="18">{done}/{total}</text>
    </svg>
  );
}
