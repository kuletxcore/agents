export function Mark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="7" fill="#12304F" />
      <path d="M6.5 24.5 L14.5 7 h3.1 L9.6 24.5 Z" fill="#4AC8FF" />
      <path d="M13.6 24.5 L21.6 7 h3.1 L16.7 24.5 Z" fill="#FFD84D" />
    </svg>
  );
}

export function Icon({ name, size = 22 }: { name: string; size?: number }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, "aria-hidden": true } as const;
  switch (name) {
    case "home":
      return <svg {...p}><path d="M4 11.5 12 4l8 7.5V20H4z" /><path d="M10 20v-6h4v6" /></svg>;
    case "moon":
      return <svg {...p}><path d="M15 3.5A8 8 0 1 0 20.5 14 6.5 6.5 0 0 1 15 3.5z" /></svg>;
    case "flag":
      return <svg {...p}><path d="M6 21V4" /><path d="M6 5h11l-2 3.5L17 12H6" /></svg>;
    case "hammer":
      return <svg {...p}><path d="M14 4l6 6-4 1-7 7-3-3 7-7z" /><path d="M4 20l4-4" /></svg>;
    case "ring":
      return <svg {...p}><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="8" /></svg>;
    case "cortex":
      return <svg {...p}><circle cx="12" cy="12" r="2" /><path d="M12 4v3M12 17v3M4 12h3M17 12h3M6.2 6.2l2.1 2.1M15.7 15.7l2.1 2.1M17.8 6.2l-2.1 2.1M8.3 15.7l-2.1 2.1" /></svg>;
    case "file":
      return <svg {...p}><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5" /></svg>;
    case "grid":
      return <svg {...p}><rect x="4" y="4" width="6" height="6" /><rect x="14" y="4" width="6" height="6" /><rect x="4" y="14" width="6" height="6" /><rect x="14" y="14" width="6" height="6" /></svg>;
    case "search":
      return <svg {...p}><circle cx="11" cy="11" r="6" /><path d="M16 16l4 4" /></svg>;
    case "bolt":
      return <svg {...p}><path d="M13 2 4 14h7l-1 8 9-12h-7z" fill="currentColor" stroke="none" /></svg>;
    case "token":
      return <svg {...p}><circle cx="12" cy="12" r="8" /><path d="M12 8v8M9 10.5h6M9 13.5h6" /></svg>;
    case "check":
      return <svg {...p}><circle cx="12" cy="12" r="8" /><path d="M8 12.5 11 15l5-6" /></svg>;
    case "users":
      return <svg {...p}><circle cx="9" cy="9" r="3" /><circle cx="16" cy="10" r="2.4" /><path d="M4 19c.6-2.6 2.6-4 5-4s4.4 1.4 5 4M14 15.2c1.6.2 3 .9 3.6 2.8" /></svg>;
    case "mic":
      return <svg {...p}><rect x="9" y="3" width="6" height="10" rx="3" /><path d="M6 11a6 6 0 0 0 12 0M12 17v4" /></svg>;
    case "sun":
      return <svg {...p}><circle cx="12" cy="12" r="3.5" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" /></svg>;
    default:
      return <svg {...p}><circle cx="12" cy="12" r="6" /></svg>;
  }
}

export function AgentGlyph({ glyph }: { glyph: string }) {
  return <Icon name={glyph === "route" ? "flag" : glyph === "anvil" ? "hammer" : glyph === "compass" ? "search" : glyph === "split" ? "grid" : glyph === "spark" ? "bolt" : glyph === "folio" ? "file" : glyph === "moon" ? "moon" : "ring"} size={26} />;
}
