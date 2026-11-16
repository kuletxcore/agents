import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { api, type Health } from "../lib/api";
import { money } from "../lib/format";
import { Icon, Mark } from "./Glyph";
import { Button, useToast } from "./ui";

const DOCK = [
  { to: "/", label: "Lobby", sub: "Home", icon: "home" },
  { to: "/dream", label: "Dream", sub: "Review", icon: "moon" },
  { to: "/missions", label: "Missions", sub: "Goals", icon: "flag" },
  { to: "/skills", label: "Craft", sub: "Skills", icon: "hammer" },
  { to: "/agents", label: "ARONA", sub: "Agents", icon: "ring" },
  { to: "/memory", label: "Cortex", sub: "Memory", icon: "cortex" },
  { to: "/documents", label: "Archive", sub: "Docs", icon: "file" },
];

const MENU = [
  { to: "/runs", title: "Runs", sub: "Agents at work" },
  { to: "/graphs", title: "Map", sub: "Knowledge graphs" },
  { to: "/automations", title: "Patrol", sub: "Schedules" },
  { to: "/integrations", title: "Links", sub: "Integrations" },
  { to: "/activity", title: "Log", sub: "Activity" },
  { to: "/inbox", title: "Inbox", sub: "Triage" },
  { to: "/calendar", title: "Calendar", sub: "Handshakes" },
  { to: "/business", title: "Ledger", sub: "Demo finance" },
  { to: "/settings", title: "Settings", sub: "Operator" },
  { to: "/setup", title: "Briefing", sub: "Setup wizard" },
];

function clock() {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Manila",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(new Date());
}

export default function Shell() {
  const [health, setHealth] = useState<Health | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [palette, setPalette] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<{ kind: string; title: string; href: string }[]>([]);
  const [arona, setArona] = useState(false);
  const [line, setLine] = useState("");
  const [chat, setChat] = useState<{ role: string; body: string }[]>([
    { role: "agent", body: "Link is stable. Ask for a room, or tell Marshal what to dispatch." },
  ]);
  const [now, setNow] = useState(clock());
  const [theme, setTheme] = useState(document.documentElement.dataset.theme === "night" ? "night" : "day");
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    api<Health>("/api/health")
      .then(setHealth)
      .catch((e: Error) => setErr(e.message));
  }, []);

  useEffect(() => {
    const t = window.setInterval(() => setNow(clock()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA") {
        e.preventDefault();
        setPalette(true);
      }
      if (e.key === "Escape") {
        setMenu(false);
        setPalette(false);
        setArona(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!palette || query.trim().length < 2) {
      setHits([]);
      return;
    }
    const handle = window.setTimeout(() => {
      api<{ hits: { kind: string; title: string; href: string }[] }>(`/api/search?q=${encodeURIComponent(query)}`)
        .then((r) => setHits(r.hits))
        .catch(() => setHits([]));
    }, 180);
    return () => window.clearTimeout(handle);
  }, [query, palette]);

  const hud = health?.hud;
  const sparks = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => ({
        left: `${8 + ((i * 37) % 84)}%`,
        top: `${10 + ((i * 23) % 70)}%`,
        delay: `${i * 0.4}s`,
      })),
    [],
  );

  function toggleTheme() {
    const next = theme === "night" ? "day" : "night";
    setTheme(next);
    if (next === "night") document.documentElement.dataset.theme = "night";
    else delete document.documentElement.dataset.theme;
    localStorage.setItem("kx-theme", next);
  }

  async function askArona(text: string) {
    const prompt = text.trim();
    if (!prompt) return;
    setChat((c) => [...c, { role: "user", body: prompt }]);
    setLine("");
    const rooms: [string, string][] = [
      ["lobby", "/"],
      ["dream", "/dream"],
      ["mission", "/missions"],
      ["craft", "/skills"],
      ["skill", "/skills"],
      ["cortex", "/memory"],
      ["memory", "/memory"],
      ["archive", "/documents"],
      ["document", "/documents"],
      ["map", "/graphs"],
      ["graph", "/graphs"],
      ["patrol", "/automations"],
      ["inbox", "/inbox"],
      ["calendar", "/calendar"],
      ["setting", "/settings"],
      ["agent", "/agents"],
    ];
    const hit = rooms.find(([word]) => prompt.toLowerCase().includes(word) && /open|go|take|show/.test(prompt.toLowerCase()));
    try {
      const res = await api<{ messages: { role: string; body: string }[] }>(`/api/agents/arona/messages`, {
        method: "POST",
        body: JSON.stringify({ body: prompt }),
      });
      const reply = res.messages.find((m) => m.role === "agent");
      setChat((c) => [...c, { role: "agent", body: reply?.body ?? "Standing by." }]);
      if (hit) navigate(hit[1]);
    } catch (e) {
      setChat((c) => [...c, { role: "agent", body: e instanceof Error ? e.message : "Link failed." }]);
    }
  }

  function listen() {
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) {
      toast("This browser has no speech API. Type to ARONA instead.");
      setArona(true);
      return;
    }
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.onresult = (ev) => {
      const said = ev.results[0]?.[0]?.transcript ?? "";
      setArona(true);
      void askArona(said);
    };
    rec.onerror = () => toast("Speech didn’t start. Type to ARONA instead.");
    rec.start();
    toast("Listening…");
  }

  return (
    <div className="app">
      <div className="sparkles" aria-hidden>
        {sparks.map((s, i) => (
          <i key={i} style={{ left: s.left, top: s.top, animationDelay: s.delay }} />
        ))}
      </div>
      <header className="topbar">
        <div className="brand-plate">
          <div className="mark">
            <Mark size={32} />
          </div>
          <div className="who">
            <strong>
              KuletXAI <span className="live"><b /> LIVE</span>
            </strong>
            <small>{hud?.workspace ?? "~/kuletx/agents"} · {hud?.env ?? "demo"}</small>
          </div>
        </div>
        <div className="pills">
          <div className="pill" title="OpenRouter credit left">
            <div className="ic"><Icon name="bolt" size={16} /></div>
            <div className="tx"><em>BUDGET</em><b>{hud ? money(hud.budgetLeft, 0) : "—"}</b></div>
          </div>
          <div className="pill">
            <div className="ic"><Icon name="token" size={16} /></div>
            <div className="tx"><em>TOKENS</em><b>{hud ? `${Math.round(hud.tokensToday / 1000)}k` : "—"}</b></div>
          </div>
          <div className="pill">
            <div className="ic"><Icon name="check" size={16} /></div>
            <div className="tx"><em>TASKS</em><b>{hud ? `${hud.tasksDone}/${hud.tasksTotal}` : "—"}</b></div>
          </div>
          <div className="pill">
            <div className="ic"><Icon name="users" size={16} /></div>
            <div className="tx"><em>SQUAD</em><b>{hud?.agentsActive ?? "—"}</b></div>
          </div>
          <button className="icon-btn" aria-label="Search" onClick={() => setPalette(true)}><Icon name="search" size={18} /></button>
          <button className="icon-btn" aria-label="Voice" onClick={listen}><Icon name="mic" size={18} /></button>
          <button className="icon-btn" aria-label="Theme" onClick={toggleTheme}><Icon name="sun" size={18} /></button>
        </div>
      </header>

      <main className="main">
        {err ? (
          <p className="sub">The worker link failed: {err}. Refresh to retry the seed.</p>
        ) : (
          <Outlet context={{ health }} />
        )}
      </main>

      <button className="arona-fab pulse" aria-label="Open ARONA" onClick={() => setArona((v) => !v)}>
        AR
      </button>

      <footer className="dock-wrap">
        <div className="runtime-row">
          {(health?.runtimes ?? []).map((r) => (
            <span key={r.id} className={`tag ${r.status === "live" ? "ok" : r.status === "offline" ? "bad" : ""}`} title={r.detail}>
              {r.name}
            </span>
          ))}
        </div>
        <div className="dock-line">
        <nav className="dock" aria-label="Primary">
          {DOCK.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === "/"} className={({ isActive }) => (isActive ? "on" : "")}>
              <span className="orb"><Icon name={item.icon} /></span>
              <small>{item.label}</small>
              <span className="sublabel">{item.sub}</span>
            </NavLink>
          ))}
          <button className={`dock-item ${menu ? "on" : ""}`} onClick={() => setMenu(true)} aria-label="Open menu">
            <span className="orb"><Icon name="grid" /></span>
            <small>Menu</small>
            <span className="sublabel">System</span>
          </button>
        </nav>
        <div className="clock-plate">
          <div className="inner">
            <div className="glyphs" aria-hidden>△ ✕ ＋ ○</div>
            <strong>{now.split(",")[1] ?? now}</strong>
            <div className="credit">{now.split(",")[0]} · MNL · by KuletXCore</div>
          </div>
        </div>
        </div>
      </footer>

      <AnimatePresence>
        {menu ? (
          <motion.div className="menu" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMenu(false)}>
            <motion.div className="menu-card" onClick={(e) => e.stopPropagation()} initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
              <div className="kicker">SYSTEM</div>
              <h2 style={{ fontFamily: "var(--display)", fontStyle: "italic", fontWeight: 800, fontSize: 36, margin: "4px 0 8px" }}>Menu</h2>
              {MENU.map((item) => (
                <div className="menu-row" key={item.to}>
                  <div>
                    <strong>{item.title}</strong>
                    <div className="muted">{item.sub}</div>
                  </div>
                  <Button small onClick={() => { setMenu(false); navigate(item.to); }}>Open</Button>
                </div>
              ))}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {palette ? (
          <motion.div className="palette" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setPalette(false)}>
            <div className="palette-card" onClick={(e) => e.stopPropagation()}>
              <div className="kicker">SEARCH</div>
              <input className="search-input" autoFocus placeholder="Skills, agents, documents…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search KuletXAI" />
              <div style={{ marginTop: 10 }}>
                {hits.map((h) => (
                  <button key={h.href + h.title} className="menu-row" style={{ width: "100%", background: "none", borderLeft: 0, borderRight: 0, borderTop: 0, textAlign: "left" }} onClick={() => { setPalette(false); navigate(h.href); }}>
                    <div>
                      <strong style={{ fontSize: 18 }}>{h.title}</strong>
                      <div className="muted">{h.kind}</div>
                    </div>
                  </button>
                ))}
                {query.length > 1 && hits.length === 0 ? <p className="muted">No matches in the demo index.</p> : null}
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {arona ? (
          <motion.aside className="sheet" role="dialog" aria-label="ARONA" initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 40, opacity: 0 }}>
            <div className="kicker">CONSOLE GUIDE</div>
            <h2 style={{ fontFamily: "var(--display)", fontStyle: "italic", margin: "4px 0 8px" }}>ARONA</h2>
            <div className="chat">
              {chat.map((m, i) => (
                <div key={i} className={`bubble ${m.role === "user" ? "user" : ""}`}>{m.body}</div>
              ))}
            </div>
            <form
              style={{ display: "flex", gap: 8, marginTop: 10 }}
              onSubmit={(e) => {
                e.preventDefault();
                void askArona(line);
              }}
            >
              <input className="composer" value={line} onChange={(e) => setLine(e.target.value)} placeholder="Ask, or say where to go…" aria-label="Message ARONA" />
              <Button type="submit">Send</Button>
            </form>
          </motion.aside>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

type SpeechRec = {
  lang: string;
  start: () => void;
  onresult: (ev: { results: { 0: { 0: { transcript: string } } } }) => void;
  onerror: () => void;
};
