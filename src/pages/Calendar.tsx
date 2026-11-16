import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { when } from "../lib/format";
import { Card, Page, Ribbon, useToast } from "../components/ui";

type Ev = { id: string; title: string; at: string; kind: string; owner: string };
type Sch = { id: string; name: string; cadence: string; nextRun: string; status: string };

export default function Calendar() {
  const [events, setEvents] = useState<Ev[]>([]);
  const [schedules, setSchedules] = useState<Sch[]>([]);
  const toast = useToast();
  useEffect(() => {
    api<{ events: Ev[]; schedules: Sch[] }>("/api/calendar").then((r) => {
      setEvents(r.events);
      setSchedules(r.schedules);
    }).catch((e: Error) => toast(e.message));
  }, []);
  return (
    <Page kicker="ASIA/MANILA" title="Calendar" sub="Handshake dates and the patrol timetable. Times render in Manila.">
      <div className="grid-2">
        <Card>
          <Ribbon>Coming up</Ribbon>
          {events.map((e) => (
            <div className="row" key={e.id}>
              <div><strong>{e.title}</strong><div className="muted">{e.kind} · {e.owner}</div></div>
              <span className="mono">{when(e.at)}</span>
            </div>
          ))}
        </Card>
        <Card>
          <Ribbon tone="yellow">Patrol</Ribbon>
          {schedules.map((s) => (
            <div className="row" key={s.id}>
              <div><strong>{s.name}</strong><div className="muted">{s.cadence}</div></div>
              <span className={`tag ${s.status === "ok" ? "ok" : "bad"}`}>{when(s.nextRun)}</span>
            </div>
          ))}
        </Card>
      </div>
    </Page>
  );
}
