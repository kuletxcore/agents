import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import "./dispatch.css";

const briefs = [
  { agent: 'Keeper', title: 'File a mission brief', destination: 'Archive', shape: 'M41 27h33l10 10v46H41z M74 27v12h10 M49 49h26 M49 58h26 M49 67h17', goal: 'Review open mission actions and matching memory notes. Draft a brief for the Archive.' },
  { agent: 'Marshal', title: 'Send a handoff', destination: 'Inbox', shape: 'M30 38h62v41H30z M30 39l31 23 31-23 M31 78l20-19 M91 78L71 59', goal: 'Review open missions and send me a handoff in the Inbox with the number of outstanding actions.' },
  { agent: 'Nightwatch', title: 'Save a memory note', destination: 'Cortex', shape: 'M37 32h46v47H37z M43 26h46v47 M31 38v47h46 M46 47h26 M46 56h26 M46 65h16', goal: 'Read memory and mission status. Summarize what is still open in a new memory note.' },
];

export default function DispatchDesk() {
  const [selected, select] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const brief = briefs[selected];
  async function send() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const { run } = await api<{ run: { id: string } }>('/api/runs', { method: 'POST', body: JSON.stringify({ agentId: brief.agent.toLowerCase(), goal: brief.goal, mode: 'demo' }) });
      navigate(`/runs/${run.id}`);
    } catch (e) { setError(e instanceof Error ? e.message : 'The brief could not be sent.'); setBusy(false); }
  }
  return <section className="dispatch">
    <header className="desk-mast"><span>KULETXAI <b>/</b> OPERATIONS</span><Link to="/overview">Workspace overview ↗</Link></header>
    <div className="desk-heading"><div><p className="desk-code">FIELD OFFICE &nbsp; / &nbsp; 01</p><h1>Dispatch desk<span>.</span></h1></div><p>Pick the work. An agent reads the evidence.<br />You decide what gets filed.</p></div>
    <div className="desk-board"><div className="desk-selector"><p className="desk-code">01 &nbsp; SELECT A BRIEF</p>
      {briefs.map((b,i) => <button type="button" key={b.agent} aria-pressed={i===selected} disabled={busy} onClick={() => { select(i); setError(''); }}><span className="desk-num">0{i+1}</span><span><small>{b.agent}</small><strong>{b.title}</strong></span><span aria-hidden="true">↗</span></button>)}
      <Link to="/runs">Write a custom brief →</Link></div>
      <article className="desk-ticket" aria-label="Selected brief"><div className="desk-ticket-top"><span>AGENT DISPATCH</span><span>KX—00{selected+1}</span></div>
      <div className="desk-paper"><div className="desk-seal" aria-hidden="true"><svg viewBox="0 0 120 120" fill="none" stroke="currentColor"><circle cx="60" cy="60" r="53" strokeWidth="2"/><circle cx="60" cy="60" r="48" strokeDasharray="2 4"/><path d={brief.shape} strokeWidth="3" strokeLinejoin="round"/></svg></div><p className="desk-code">DELIVERY ORDER</p><h2>{brief.title}</h2><p>{brief.goal}</p><dl><div><dt>ASSIGNED TO</dt><dd>{brief.agent}</dd></div><div><dt>DESTINATION</dt><dd>{brief.destination}</dd></div></dl></div>
      <div className="desk-stub"><button disabled={busy} onClick={() => void send()}>{busy ? 'Dispatching…' : 'Dispatch demo run'} <span aria-hidden="true">→</span></button><small>Scripted run · no model spend<br />Writes wait for your approval.</small></div>{error && <p role="alert" className="desk-error">{error}</p>}</article></div>
    <footer className="desk-footer"><span>READ &nbsp; → &nbsp; PROPOSE &nbsp; → &nbsp; REVIEW</span><Link to="/runs">Run history ↗</Link></footer>
  </section>;
}
