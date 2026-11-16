import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

const ToastCtx = createContext<(text: string) => void>(() => {});
export function useToast() {
  return useContext(ToastCtx);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<{ id: number; text: string }[]>([]);
  const push = (text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, text }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800);
  };
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div className="toast" key={t.id}>
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function Page({
  kicker,
  title,
  sub,
  action,
  children,
}: {
  kicker: string;
  title: string;
  sub?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.section
      initial={reduce ? false : { x: 28, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 32, mass: 0.7 }}
    >
      <header className="page-head">
        <div>
          <div className="kicker">{kicker}</div>
          <h1>{title}</h1>
          {sub ? <p className="sub">{sub}</p> : null}
        </div>
        {action}
      </header>
      <div className="stack">{children}</div>
    </motion.section>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <article className={`card ${className}`}>{children}</article>;
}

export function Ribbon({ children, tone = "" }: { children: ReactNode; tone?: string }) {
  return (
    <div className={`ribbon ${tone}`}>
      <span>{children}</span>
    </div>
  );
}

export function Button({
  children,
  tone = "",
  small,
  onClick,
  disabled,
  type = "button",
}: {
  children: ReactNode;
  tone?: string;
  small?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <motion.button
      type={type}
      className="btn-hit"
      onClick={onClick}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.96 }}
    >
      <span className={`btn ${tone} ${small ? "small" : ""}`}>
        <span>{children}</span>
      </span>
    </motion.button>
  );
}

export function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (!data.length) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const w = 140;
  const h = 42;
  const pts = data.map((v, i) => {
    const x = (i / Math.max(1, data.length - 1)) * w;
    const y = h - ((v - min) / (max - min || 1)) * (h - 6) - 3;
    return [x, y] as const;
  });
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} aria-hidden>
      <path d={`${d} L${w},${h} L0,${h} Z`} fill={color} opacity="0.18" />
      <path d={d} fill="none" stroke={color} strokeWidth="2.4" strokeLinejoin="round" />
    </svg>
  );
}

export function Meter({ value, tone = "" }: { value: number; tone?: string }) {
  const reduce = useReducedMotion();
  return (
    <div className={`bar ${tone}`} aria-valuenow={value} role="meter" aria-valuemin={0} aria-valuemax={100}>
      <motion.i
        initial={reduce ? false : { scaleX: 0 }}
        animate={{ scaleX: Math.max(0.02, value / 100) }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        style={{ width: "100%" }}
      />
    </div>
  );
}

export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="menu" role="dialog" aria-modal="true" aria-label={title}>
      <motion.div
        className="menu-card"
        initial={{ y: 20, scale: 0.98, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 420, damping: 28 }}
      >
        <Ribbon>{title}</Ribbon>
        <div style={{ marginTop: 12 }}>{children}</div>
      </motion.div>
    </div>
  );
}

export function Loading({ label = "Linking" }: { label?: string }) {
  return (
    <div className="linking" role="status">
      {label}…
    </div>
  );
}

export function ErrorNote({ text, onRetry }: { text: string; onRetry?: () => void }) {
  return (
    <Card>
      <Ribbon tone="alert">Link failed</Ribbon>
      <p className="sub">{text}</p>
      {onRetry ? <Button onClick={onRetry}>Retry</Button> : null}
    </Card>
  );
}

export function useCount(target: number) {
  const reduce = useReducedMotion();
  const [v, setV] = useState(reduce ? target : 0);
  useEffect(() => {
    if (reduce) {
      setV(target);
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / 800);
      const e = 1 - (1 - p) ** 3;
      setV(target * e);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, reduce]);
  return v;
}
