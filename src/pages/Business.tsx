import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { money, pct } from "../lib/format";
import { Card, Meter, Page, Ribbon, useToast } from "../components/ui";

type Win = { id: string; provider: string; label: string; used: number; cap: number; unit: string };

export default function Business() {
  const [data, setData] = useState<{ demo: boolean; cash: number; income: number; target: number; note: string; windows: Win[] } | null>(null);
  const toast = useToast();
  useEffect(() => {
    api<NonNullable<typeof data>>("/api/business").then(setData).catch((e: Error) => toast(e.message));
  }, []);
  if (!data) return <div className="linking">Opening ledger…</div>;
  const ring = Math.round((data.income / data.target) * 100);
  return (
    <Page kicker="DEMO LEDGER" title="Ledger" sub={data.note}>
      <div className="grid-3">
        <Card><Ribbon>Cash on hand</Ribbon><div className="stat">{money(data.cash, 0)}</div></Card>
        <Card><Ribbon tone="cyan">Monthly income</Ribbon><div className="stat">{money(data.income, 0)}</div></Card>
        <Card>
          <Ribbon tone="yellow">Revenue target</Ribbon>
          <div className="stat">{ring}%</div>
          <Meter value={ring} />
          <div className="muted">{money(data.income, 0)} of {money(data.target, 0)}</div>
        </Card>
      </div>
      <Card>
        <h3>Room on plan windows</h3>
        {data.windows.map((w) => (
          <div key={w.id} style={{ marginTop: 8 }}>
            <div className="row" style={{ border: 0 }}><span>{w.provider} · {w.label}</span><span>{pct(w.used, w.cap)}% used</span></div>
            <Meter value={pct(w.used, w.cap)} tone="cyan" />
          </div>
        ))}
      </Card>
    </Page>
  );
}
