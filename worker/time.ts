export function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3600 * 1000).toISOString();
}

export function daysAgo(d: number): string {
  return new Date(Date.now() - d * 86400 * 1000).toISOString();
}

export function manilaHour(date = new Date()): number {
  const h = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    hour: "2-digit",
    hourCycle: "h23",
  }).format(date);
  return Number(h);
}

/** Next instant for a Manila wall-clock time. hour < 0 means "next top of the hour". */
export function nextManila(hour: number, minute: number, isoDow?: number): string {
  const now = new Date();
  if (hour < 0) {
    const next = new Date(now);
    next.setUTCMinutes(0, 0, 0);
    next.setUTCHours(next.getUTCHours() + 1);
    return next.toISOString();
  }
  const shifted = new Date(now.getTime() + 8 * 3600 * 1000);
  for (let add = 0; add < 14; add++) {
    const wall = new Date(
      Date.UTC(
        shifted.getUTCFullYear(),
        shifted.getUTCMonth(),
        shifted.getUTCDate() + add,
        hour,
        minute,
        0,
      ),
    );
    const utc = new Date(wall.getTime() - 8 * 3600 * 1000);
    if (utc.getTime() <= now.getTime() + 15_000) continue;
    if (isoDow) {
      const manila = new Date(utc.getTime() + 8 * 3600 * 1000);
      const dow = manila.getUTCDay();
      const iso = dow === 0 ? 7 : dow;
      if (iso !== isoDow) continue;
    }
    return utc.toISOString();
  }
  return new Date(now.getTime() + 86400 * 1000).toISOString();
}

export function dayKey(offsetFromToday: number): string {
  const shifted = new Date(Date.now() + 8 * 3600 * 1000);
  const d = new Date(
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate() - offsetFromToday),
  );
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
