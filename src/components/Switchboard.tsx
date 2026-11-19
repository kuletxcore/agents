import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../lib/api';
import { lines, matchStations } from '../lib/stations';
import { Icon } from './Glyph';

type Hit = { id: string; kind: string; title: string; href: string };
export default function Switchboard({ close }: { close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const { pathname } = useLocation();
  const [query, setQuery] = useState('');
  const [records, setRecords] = useState<{ term: string; hits: Hit[]; error?: boolean } | null>(null);
  const term = query.trim();
  const matches = matchStations(term);
  useEffect(() => {
    const node = dialog.current!;
    node.showModal(); input.current?.focus();
    return () => node.close();
  }, []);
  useEffect(() => {
    if (term.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const { hits } = await api<{ hits: Hit[] }>(`/api/search?q=${encodeURIComponent(term)}`, { signal: controller.signal });
        if (!controller.signal.aborted) setRecords({term, hits});
      } catch {
        if (!controller.signal.aborted) setRecords({term, hits: [], error: true});
      }
    }, 180);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [term]);
  return <dialog ref={dialog} className="switchboard" aria-labelledby="switch-title" onCancel={close} onClick={e => { if (e.target === dialog.current) close(); }}>
    <div className="switch-shell"><header><span className="switch-code">KX / ROUTE DIRECTORY</span><button aria-label="Close switchboard" onClick={close}>✕</button>
      <h2 id="switch-title">Switchboard</h2><p>Find a room by what you want to do.</p>
      <label className="switch-search"><Icon name="search"/><input ref={input} aria-label="Find a task, room or record" placeholder="Try “approve”, “memory”, or a document title" value={query} onChange={e => setQuery(e.target.value)}/></label>
    </header><div className="switch-body"><div className="switch-lines">{lines.map((line,i) => {
      const stops = matches.filter(s => s.line === line);
      return stops.length > 0 && <section key={line} data-line={i}><h3><b>0{i+1}</b>{line}</h3>{stops.map(s => <Link key={s.path} to={s.path} onClick={close} aria-current={pathname === s.path ? 'page' : undefined}><strong>{s.task}</strong><small>{s.room}{pathname === s.path ? ' · here' : ''}</small></Link>)}</section>;
    })}</div>{!matches.length && <p>No matching rooms.</p>}
    {term.length >= 2 && <section className="switch-records"><h3>Workspace records</h3><div role="status">{records?.term !== term ? 'Searching records…' : records.error ? 'Record search is unavailable. Room navigation still works.' : !records.hits.length ? 'No matching records.' : `${records.hits.length} matches`}</div>{records?.term === term && records.hits.map(h => <Link key={`${h.kind}:${h.id}`} to={h.href} onClick={close}><strong>{h.title}</strong><small>{h.kind}</small></Link>)}</section>}</div></div>
  </dialog>;
}
