/** Yearly subscription lifecycle. Pure functions: state is always computed from dates. */

export const GRACE_DAYS = 7;
export const PURGE_AFTER_LOCK_DAYS = 90;
export const REMINDER_DAYS = [30, 7, 1] as const;
const DAY = 86_400_000;

export type SubState = "TRIAL" | "ACTIVE" | "GRACE" | "LOCKED" | "PURGE_DUE";

export interface SubDates {
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
}

export interface SubInfo {
  state: SubState;
  /** When the current trial or paid term ends. */
  endsAt: Date | null;
  /** When access locks (end of grace; for trials, the trial end). */
  locksAt: Date | null;
  /** When data is deleted. */
  purgeAt: Date | null;
  daysLeft: number | null;
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * DAY);
}

export function addYear(d: Date): Date {
  const x = new Date(d);
  x.setFullYear(x.getFullYear() + 1);
  return x;
}

export function subscriptionInfo(sub: SubDates | null, now = new Date()): SubInfo {
  if (!sub || (!sub.trialEndsAt && !sub.currentPeriodEnd)) {
    return { state: "LOCKED", endsAt: null, locksAt: null, purgeAt: null, daysLeft: null };
  }
  const paid = sub.currentPeriodEnd;
  // A paid term always wins over a trial.
  const endsAt = paid ?? sub.trialEndsAt!;
  const locksAt = paid ? addDays(paid, GRACE_DAYS) : endsAt; // no grace period after a free trial
  const purgeAt = addDays(locksAt, PURGE_AFTER_LOCK_DAYS);
  const daysUntil = (d: Date) => Math.ceil((d.getTime() - now.getTime()) / DAY);

  let state: SubState;
  if (now < endsAt) state = paid ? "ACTIVE" : "TRIAL";
  else if (now < locksAt) state = "GRACE";
  else if (now < purgeAt) state = "LOCKED";
  else state = "PURGE_DUE";

  const daysLeft =
    state === "ACTIVE" || state === "TRIAL" ? daysUntil(endsAt) : state === "GRACE" ? daysUntil(locksAt) : state === "LOCKED" ? daysUntil(purgeAt) : 0;
  return { state, endsAt, locksAt, purgeAt, daysLeft };
}

/** Customer-facing features (AI suggestions, complaint form) work in these states. */
export function isServiceable(state: SubState): boolean {
  return state === "TRIAL" || state === "ACTIVE" || state === "GRACE";
}

/** New term end when the platform owner clicks "Renew 1 year". */
export function renewedPeriodEnd(sub: SubDates | null, now = new Date()): Date {
  const info = subscriptionInfo(sub, now);
  // Renewing early extends from the current end; otherwise the year starts today.
  if (info.state === "ACTIVE" && sub?.currentPeriodEnd) return addYear(sub.currentPeriodEnd);
  return addYear(now);
}

/** Which reminder (30/7/1 days) is due now, if any, and its dedupe key. */
export function dueReminder(sub: SubDates, sent: string[], now = new Date()): { days: number; key: string } | null {
  const info = subscriptionInfo(sub, now);
  if ((info.state !== "ACTIVE" && info.state !== "TRIAL") || !info.endsAt || info.daysLeft === null) return null;
  const endKey = info.endsAt.toISOString().slice(0, 10);
  for (const days of [...REMINDER_DAYS].sort((a, b) => a - b)) {
    if (info.daysLeft <= days) {
      const key = `${endKey}:${days}`;
      return sent.includes(key) ? null : { days, key };
    }
  }
  return null;
}
