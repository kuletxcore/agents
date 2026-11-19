import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { rel } from "../lib/format";
import { Button, Card, ErrorNote, Loading, Page, Ribbon, useToast } from "../components/ui";

type ToolInfo = { name: string; risk: "read" | "write"; description: string };
type AgentInfo = { id: string; name: string; role: string; tools: ToolInfo[] };
type RunSummary = { id: string; agentId: string; agentName: string; goal: string; status: string; mode: string; turns: number; createdAt: string };
type Run = RunSummary & { maxTurns: number; tokensIn: number; tokensOut: number; result: string | null; error: string | null };
type Step = { id: string; seq: number; kind: string; tool: string | null; input: string | null; output: string | null; status: string; at: string };
type Detail = { run: Run; steps: Step[] };
type Index = { llm: string; runs: RunSummary[]; agents: AgentInfo[] };

const STATUS_TAG: Record<string, string> = { done: "ok", ok: "ok", failed: "bad", error: "bad", denied: "bad", running: "navy" };
const STATUS_LABEL: Record<string, string> = { waiting: "NEEDS YOU", pending: "NEEDS YOU", done: "DONE", failed: "FAILED", running: "RUNNING" };

function pretty(json: string | null): string {
  if (!json) return "";
  try {
    return JSON.stringify(JSON.parse(json), null, 2);
  } catch {
    return json;
  }
}

export default function Runs() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [index, setIndex] = useState<Index | null>(null);
  const [failed, setFailed] = useState("");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [agentId, setAgentId] = useState("keeper");
  const [goal, setGoal] = useState("");
  const [busy, setBusy] = useState(false);

  function loadIndex() {
    setFailed("");
    return api<Index>("/api/runs").then(setIndex).catch((e: Error) => setFailed(e.message));
  }
  useEffect(() => { void loadIndex(); }, []);
  useEffect(() => {
    if (!id) { setDetail(null); return; }
    if (detail?.run.id === id) return;
    api<Detail>(`/api/runs/${id}`).then(setDetail).catch((e: Error) => toast(e.message));
  }, [id]);

  async function start() {
    if (!goal.trim() || busy) return;
    setBusy(true);
    try {
      const res = await api<Detail>("/api/runs", { method: "POST", body: JSON.stringify({ agentId, goal }) });
      setDetail(res);
      setGoal("");
      navigate(`/runs/${res.run.id}`);
      await loadIndex();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function decide(step: Step, approve: boolean) {
    if (!detail || busy) return;
    setBusy(true);
    try {
      const res = await api<Detail>(`/api/runs/${detail.run.id}/steps/${step.id}`, { method: "POST", body: JSON.stringify({ approve }) });
      setDetail(res);
      toast(approve ? `Approved ${step.tool}` : `Denied ${step.tool}`);
      await loadIndex();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (failed) return <ErrorNote text={failed} onRetry={() => void loadIndex()} />;
  if (!index) return <Loading />;

  const agent = index.agents.find((a) => a.id === agentId) ?? index.agents[0];
  const live = index.llm === "live";

  return (
    <Page
      kicker={live ? "KERNEL · LIVE MODEL" : "KERNEL · SCRIPTED PLANNER"}
      title="Runs"
      sub={live
        ? "Give an agent a goal. It reads with its tools on its own and stops for your approval before it changes anything."
        : "Give an agent a goal. The tools, approvals, and trace are real. No model is attached, so the plan is a fixed script: read, propose one write, report."}
    >
      <div className="grid-2">
        <div className="stack">
          {!id && <Card>
            <Ribbon>New run</Ribbon>
            <form className="run-form" onSubmit={(e) => { e.preventDefault(); void start(); }}>
              <label>
                <span className="kicker">Agent</span>
                <select className="field" value={agent?.id} onChange={(e) => setAgentId(e.target.value)}>
                  {index.agents.map((a) => <option key={a.id} value={a.id}>{a.name} · {a.role}</option>)}
                </select>
              </label>
              <label>
                <span className="kicker">Goal</span>
                <textarea className="field" rows={3} value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Check what is still open on the deploy mission and file a note." />
              </label>
              <div><Button type="submit" disabled={busy || !goal.trim()}>{busy ? "Working…" : "Start run"}</Button></div>
            </form>
          </Card>}
          {id && <Button tone="ghost" onClick={() => navigate("/runs")}>Start another run</Button>}

          {detail ? (
            <Card>
              <div className="pager">
                <Ribbon tone="cyan">{detail.run.agentName ?? detail.run.agentId}</Ribbon>
                <span className={`tag ${STATUS_TAG[detail.run.status] ?? ""}`}>{STATUS_LABEL[detail.run.status] ?? detail.run.status.toUpperCase()}</span>
              </div>
              <h2 className="run-goal">{detail.run.goal}</h2>
              <div className="mono muted">
                {detail.run.mode === "live" ? "live model" : "scripted planner"} · turn {detail.run.turns} of {detail.run.maxTurns}
                {detail.run.tokensIn + detail.run.tokensOut ? ` · ${(detail.run.tokensIn + detail.run.tokensOut).toLocaleString()} tokens` : ""}
              </div>
              <ol className="trace">
                {detail.steps.map((s) => (
                  <li key={s.id} className={`step ${s.kind} ${s.status}`}>
                    {s.kind === "tool" ? (
                      <>
                        <div className="step-head">
                          <span className="mono">{s.tool}</span>
                          <span className={`tag ${STATUS_TAG[s.status] ?? ""}`}>{STATUS_LABEL[s.status] ?? s.status.toUpperCase()}</span>
                        </div>
                        {s.input && s.input !== "{}" ? <pre className="json-view">{pretty(s.input)}</pre> : null}
                        {s.status === "pending" ? (
                          <div className="decide">
                            <p>{detail.run.agentName} wants to make this change. Nothing happens until you decide.</p>
                            <div className="decide-row">
                              <Button disabled={busy} onClick={() => void decide(s, true)}>Approve</Button>
                              <Button tone="ghost" disabled={busy} onClick={() => void decide(s, false)}>Deny</Button>
                            </div>
                          </div>
                        ) : s.output ? (
                          <details>
                            <summary>Result</summary>
                            <pre className="json-view">{pretty(s.output)}</pre>
                          </details>
                        ) : null}
                      </>
                    ) : s.kind === "final" ? (
                      <div className="bubble">{s.output}</div>
                    ) : s.kind === "error" ? (
                      <p className="run-error">{s.output}</p>
                    ) : (
                      <p className="muted">{s.output}</p>
                    )}
                  </li>
                ))}
              </ol>
            </Card>
          ) : null}
        </div>

        <div className="stack">
          <Card>
            <Ribbon tone="yellow">Recent runs</Ribbon>
            {index.runs.length === 0 ? <p className="muted">No runs yet. Start one and its trace shows up here.</p> : null}
            <div className="list">
              {index.runs.map((r) => (
                <button key={r.id} className={`run-row ${r.id === id ? "on" : ""}`} onClick={() => navigate(`/runs/${r.id}`)}>
                  <span>
                    <strong>{r.goal}</strong>
                    <span className="muted">{r.agentName ?? r.agentId} · {rel(r.createdAt)}</span>
                  </span>
                  <span className={`tag ${STATUS_TAG[r.status] ?? ""}`}>{STATUS_LABEL[r.status] ?? r.status.toUpperCase()}</span>
                </button>
              ))}
            </div>
          </Card>
          {agent ? (
            <Card>
              <Ribbon>What {agent.name} can do</Ribbon>
              <p className="muted">Read tools run on their own. Write tools wait for you.</p>
              {agent.tools.map((t) => (
                <div className="row" key={t.name}>
                  <div><span className="mono">{t.name}</span><div className="muted">{t.description}</div></div>
                  <span className={`tag ${t.risk === "write" ? "" : "navy"}`}>{t.risk.toUpperCase()}</span>
                </div>
              ))}
            </Card>
          ) : null}
        </div>
      </div>
    </Page>
  );
}
