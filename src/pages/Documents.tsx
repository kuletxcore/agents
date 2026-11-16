import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { rel } from "../lib/format";
import { Button, Card, Page, Ribbon, useToast } from "../components/ui";

type Doc = { id: string; title: string; description: string; kind: string; bytes: number; updatedAt: string; body: string };

export default function Documents() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [kind, setKind] = useState("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Doc | null>(null);
  const toast = useToast();

  function load() {
    return api<{ documents: Doc[] }>("/api/documents").then((r) => setDocs(r.documents));
  }
  useEffect(() => { load().catch((e: Error) => toast(e.message)); }, []);
  const kinds = ["all", ...new Set(docs.map((d) => d.kind))];
  const shown = useMemo(
    () => docs.filter((d) => (kind === "all" || d.kind === kind) && (`${d.title} ${d.description}`.toLowerCase().includes(q.toLowerCase()))),
    [docs, kind, q],
  );
  const bytes = docs.reduce((a, d) => a + d.bytes, 0);
  const install = "Save artifacts into the KuletXAI archive with a title, a type, and a date. Do not leave the only copy inside a chat.";

  return (
    <Page kicker={`${docs.length} FILES · ${(bytes / 1024).toFixed(1)} KB`} title="Archive" sub="Invoices, notes, and prototypes stay here after the chat closes."
      action={<Button tone="ghost" onClick={() => { void navigator.clipboard.writeText(install); toast("Install prompt copied"); }}>Install prompt</Button>}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input className="field" style={{ maxWidth: 280 }} placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search documents" />
        {kinds.map((k) => <button key={k} className={`chip ${kind === k ? "on" : ""}`} onClick={() => setKind(k)}><span>{k}</span></button>)}
        <Button small tone="ghost" onClick={() => load().then(() => toast("Refreshed"))}>Refresh</Button>
      </div>
      <div className="grid-3">
        {shown.map((d) => (
          <button key={d.id} onClick={() => setOpen(d)} style={{ background: "none", border: 0, textAlign: "left", padding: 0 }}>
            <Card>
              <span className="tag">{d.kind}</span>
              <h3 style={{ fontSize: 22 }}>{d.title}</h3>
              <p>{d.description}</p>
              <div className="muted">{rel(d.updatedAt)} · {d.bytes} B</div>
            </Card>
          </button>
        ))}
      </div>
      {open ? (
        <div className="menu" onClick={() => setOpen(null)}>
          <div className="menu-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 720 }}>
            <Ribbon>{open.kind}</Ribbon>
            <h2 style={{ fontFamily: "var(--display)", fontStyle: "italic" }}>{open.title}</h2>
            <pre className="prose">{open.body}</pre>
            <Button tone="ghost" onClick={() => setOpen(null)}>Close</Button>
          </div>
        </div>
      ) : null}
    </Page>
  );
}
