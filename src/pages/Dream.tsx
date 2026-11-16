import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { api } from "../lib/api";
import { rel } from "../lib/format";
import { Button, Card, Page, Ribbon, useToast } from "../components/ui";

type Item = {
  id: string;
  category: string;
  title: string;
  body: string;
  evidence: string[];
  try_command: string;
  impact: string;
  status: string;
  generated_at: string;
};

export default function Dream() {
  const [items, setItems] = useState<Item[]>([]);
  const [index, setIndex] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const toast = useToast();

  async function load() {
    const res = await api<{ items: Item[] }>("/api/dreams");
    setItems(res.items);
  }
  useEffect(() => {
    load().catch((e: Error) => toast(e.message));
  }, []);

  const open = items.filter((i) => i.status === "open");
  const view = showAll ? items : open;
  const card = view[Math.min(index, Math.max(0, view.length - 1))];

  async function ack(action: "apply" | "skip" | "restore", id: string) {
    await api(`/api/dreams/${id}/ack`, { method: "POST", body: JSON.stringify({ action }) });
    toast(action === "apply" ? "Applied and marked done" : action === "skip" ? "Skipped" : "Restored");
    await load();
  }

  return (
    <Page
      kicker="NIGHTWATCH"
      title="Dream"
      sub="Eight checks overnight, four cards on the desk. Skip or apply. Nothing here calls a provider unless you already set a worker secret."
      action={<Button onClick={() => api("/api/dreams/run", { method: "POST" }).then(() => load()).then(() => toast("Nightwatch ran"))}>Run now</Button>}
    >
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <Ribbon tone="cyan">{open.length} open · {items.length} filed</Ribbon>
          <button className="chip" onClick={() => setShowAll((v) => !v)}><span>{showAll ? "Open only" : "Include closed"}</span></button>
        </div>
        {!card ? (
          <p>The desk is clear. The next Nightwatch pass is 06:00 Asia/Manila.</p>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div key={card.id} initial={{ x: 24, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -24, opacity: 0 }}>
              <div style={{ marginTop: 12 }} className="muted mono">
                {card.category} {Math.min(index, view.length - 1) + 1}/{view.length} · {rel(card.generated_at)}
              </div>
              <h2 style={{ fontSize: 32, margin: "8px 0" }}>{card.title}</h2>
              <p style={{ maxWidth: "62ch", lineHeight: 1.5 }}>{card.body}</p>
              <h3>Why this card</h3>
              <ul>
                {card.evidence.map((e) => <li key={e}>{e}</li>)}
              </ul>
              {card.try_command ? (
                <div className="mono" style={{ background: "var(--navy)", color: "white", padding: 12, transform: "skewX(-6deg)" }}>
                  <span style={{ display: "block", transform: "skewX(6deg)" }}>{card.try_command}</span>
                </div>
              ) : null}
              <p><strong>{card.impact}</strong></p>
              <div className="pager">
                <div style={{ display: "flex", gap: 8 }}>
                  <Button tone="ghost" onClick={() => setIndex((i) => (i + view.length - 1) % view.length)}>Prev</Button>
                  <Button tone="ghost" onClick={() => setIndex((i) => (i + 1) % view.length)}>Next</Button>
                </div>
                <div className="dots">
                  {view.map((v, i) => (
                    <button key={v.id} className={i === index ? "on" : ""} aria-label={`Card ${i + 1}`} onClick={() => setIndex(i)} />
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {card.status === "open" ? (
                    <>
                      <Button tone="ghost" onClick={() => ack("skip", card.id)}>Skip</Button>
                      <Button onClick={() => ack("apply", card.id)}>Apply & mark done</Button>
                    </>
                  ) : (
                    <Button tone="yellow" onClick={() => ack("restore", card.id)}>Restore</Button>
                  )}
                </div>
              </div>
              <div className="muted" style={{ marginTop: 8 }}>Status: {card.status}</div>
            </motion.div>
          </AnimatePresence>
        )}
      </Card>
    </Page>
  );
}
