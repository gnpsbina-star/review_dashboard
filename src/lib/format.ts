const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const TZ = "Asia/Kolkata";

export function relativeTime(d: Date, now = new Date()): string {
  const m = Math.max(0, Math.round((now.getTime() - d.getTime()) / 60_000));
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ${h === 1 ? "hour" : "hours"} ago`;
  const days = Math.floor(h / 24);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}

function istParts(d: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "numeric", month: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: false }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return { day: get("day"), month: get("month"), year: get("year"), hour: get("hour") % 24, minute: get("minute") };
}

/** e.g. "27 Sep 2026, 11:30 AM" in India time. */
export function exactTime(d: Date): string {
  const p = istParts(d);
  const h12 = p.hour % 12 || 12;
  return `${p.day} ${MONTHS[p.month - 1]} ${p.year}, ${h12}:${String(p.minute).padStart(2, "0")} ${p.hour >= 12 ? "PM" : "AM"}`;
}

export function shortDate(d: Date): string {
  const p = istParts(d);
  return `${p.day} ${MONTHS[p.month - 1]} ${p.year}`;
}

export function titleCase(s: string): string {
  return s.charAt(0) + s.slice(1).toLowerCase();
}
