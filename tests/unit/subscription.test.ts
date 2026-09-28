import { describe, expect, it } from "vitest";
import { addDays, dueReminder, isServiceable, renewedPeriodEnd, subscriptionInfo } from "@/lib/subscription";

const now = new Date("2026-09-27T06:00:00Z");

describe("subscription lifecycle", () => {
  it("is ACTIVE before the paid term ends", () => {
    const s = subscriptionInfo({ trialEndsAt: null, currentPeriodEnd: addDays(now, 10) }, now);
    expect(s.state).toBe("ACTIVE");
    expect(s.daysLeft).toBe(10);
    expect(isServiceable(s.state)).toBe(true);
  });

  it("gives a 7-day grace period after a paid term, then locks, then purges after 90 days", () => {
    const end = addDays(now, -3);
    expect(subscriptionInfo({ trialEndsAt: null, currentPeriodEnd: end }, now).state).toBe("GRACE");
    expect(subscriptionInfo({ trialEndsAt: null, currentPeriodEnd: end }, addDays(end, 7)).state).toBe("LOCKED");
    expect(subscriptionInfo({ trialEndsAt: null, currentPeriodEnd: end }, addDays(end, 7 + 89)).state).toBe("LOCKED");
    expect(subscriptionInfo({ trialEndsAt: null, currentPeriodEnd: end }, addDays(end, 7 + 90)).state).toBe("PURGE_DUE");
    const info = subscriptionInfo({ trialEndsAt: null, currentPeriodEnd: end }, now);
    expect(info.locksAt?.toISOString()).toBe(addDays(end, 7).toISOString());
    expect(info.purgeAt?.toISOString()).toBe(addDays(end, 97).toISOString());
  });

  it("locks straight after a free trial (no grace)", () => {
    expect(subscriptionInfo({ trialEndsAt: addDays(now, 2), currentPeriodEnd: null }, now).state).toBe("TRIAL");
    expect(subscriptionInfo({ trialEndsAt: addDays(now, -1), currentPeriodEnd: null }, now).state).toBe("LOCKED");
  });

  it("treats a missing subscription as locked", () => {
    expect(subscriptionInfo(null, now).state).toBe("LOCKED");
    expect(isServiceable("LOCKED")).toBe(false);
    expect(isServiceable("PURGE_DUE")).toBe(false);
  });

  it("a paid term wins over an old trial", () => {
    expect(subscriptionInfo({ trialEndsAt: addDays(now, -40), currentPeriodEnd: addDays(now, 300) }, now).state).toBe("ACTIVE");
  });

  it("renewing early extends from the current end; renewing late starts today", () => {
    const early = renewedPeriodEnd({ trialEndsAt: null, currentPeriodEnd: new Date("2026-12-01T00:00:00Z") }, now);
    expect(early.toISOString()).toBe("2027-12-01T00:00:00.000Z");
    const late = renewedPeriodEnd({ trialEndsAt: null, currentPeriodEnd: addDays(now, -30) }, now);
    expect(late.toISOString()).toBe("2027-09-27T06:00:00.000Z");
  });

  it("sends each reminder (30, 7, 1 days) once", () => {
    const sub = { trialEndsAt: null, currentPeriodEnd: addDays(now, 25) };
    const r = dueReminder(sub, [], now);
    expect(r?.days).toBe(30);
    expect(dueReminder(sub, [r!.key], now)).toBeNull();
    expect(dueReminder(sub, [r!.key], addDays(now, 19))?.days).toBe(7);
    expect(dueReminder(sub, [], addDays(now, 60))).toBeNull(); // no reminders once locked
  });
});
