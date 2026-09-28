import { beforeEach, describe, expect, it } from "vitest";
import { cookieJar, NotFoundError, RedirectError } from "../support/next-mocks";
import { makeTenant, resetDb } from "../support/db";
import { signInAs } from "../support/session";
import { prepareIdCards } from "@/app/dashboard/id-cards/actions";
import { getAccess } from "@/lib/access";
import { encryptField } from "@/lib/crypto";
import { loadIdCards } from "@/lib/data/id-cards";
import { db } from "@/lib/db";

let A: Awaited<ReturnType<typeof makeTenant>>;
let B: Awaited<ReturnType<typeof makeTenant>>;

function form(ids: string[], layout = "a4") {
  const f = new FormData();
  ids.forEach((id) => f.append("staffIds", id));
  f.set("layout", layout);
  return f;
}

beforeEach(async () => {
  await resetDb();
  cookieJar.clear();
  A = await makeTenant("Alpha");
  B = await makeTenant("Bravo");
});

describe("ID cards", () => {
  it("creates missing staff QR codes and opens the print page", async () => {
    const s = await db.staff.create({ data: { organizationId: A.org.id, branchId: A.b1.id, name: "Ravi", employeeCode: "AC-0001" } });
    await signInAs(A.owner.id);
    const err = await prepareIdCards(form([s.id])).catch((e) => e);
    expect(err).toBeInstanceOf(RedirectError);
    expect(err.url).toBe(`/dashboard/id-cards/print?layout=a4&ids=${s.id}`);
    expect(await db.qrCode.count({ where: { staffId: s.id, kind: "STAFF" } })).toBe(1);
    await prepareIdCards(form([s.id])).catch(() => undefined);
    expect(await db.qrCode.count({ where: { staffId: s.id, kind: "STAFF" } })).toBe(1); // not duplicated
  });

  it("never prints another account's staff", async () => {
    const theirs = await db.staff.create({ data: { organizationId: B.org.id, branchId: B.b1.id, name: "Secret" } });
    await signInAs(A.owner.id);
    const err = await prepareIdCards(form([theirs.id])).catch((e) => e);
    expect(err.url).toBe("/dashboard/id-cards/print?layout=a4&ids=");
    expect(await db.qrCode.count({ where: { staffId: theirs.id } })).toBe(0);
    expect(await loadIdCards((await getAccess())!, [theirs.id])).toEqual([]);
  });

  it("is for Client Owners only", async () => {
    const s = await db.staff.create({ data: { organizationId: A.org.id, branchId: A.b1.id, name: "Ravi" } });
    await signInAs(A.admin.id);
    await expect(prepareIdCards(form([s.id]))).rejects.toBeInstanceOf(NotFoundError);
  });

  it("loads card details with the emergency contact decrypted and inactive staff skipped", async () => {
    const s = await db.staff.create({ data: { organizationId: A.org.id, branchId: A.b1.id, name: "Ravi", designation: "Waiter", bloodGroup: "B+", emergencyContactEnc: encryptField("9876543210") } });
    const off = await db.staff.create({ data: { organizationId: A.org.id, branchId: A.b1.id, name: "Gone", active: false } });
    await signInAs(A.owner.id);
    await prepareIdCards(form([s.id, off.id])).catch(() => undefined);
    const cards = await loadIdCards((await getAccess())!, [s.id, off.id]);
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({ name: "Ravi", designation: "Waiter", bloodGroup: "B+", emergency: "9876543210", photoUrl: null });
    expect(cards[0].qr?.url).toMatch(/\/r\/[A-Z0-9]{6}$/);
  });
});
