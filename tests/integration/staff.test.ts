import sharp from "sharp";
import { beforeEach, describe, expect, it } from "vitest";
import { cookieJar, NotFoundError, RedirectError } from "../support/next-mocks";
import { makeTenant, resetDb } from "../support/db";
import { signInAs } from "../support/session";
import { removeStaffPhoto, updateStaff, uploadStaffPhoto } from "@/app/dashboard/staff/actions";
import { GET as staffPhoto } from "@/app/api/staff-photo/[id]/route";
import { decryptField } from "@/lib/crypto";
import { db } from "@/lib/db";
import { runSubscriptionJobs } from "@/lib/jobs";
import { codePrefix, nextEmployeeCode } from "@/lib/staff";

let T: Awaited<ReturnType<typeof makeTenant>>;
let staffId: string;

function form(values: Record<string, string | File>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.set(k, v);
  return f;
}
async function redirectOf(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    if (e instanceof RedirectError) return e.url;
    throw e;
  }
  return null;
}
const photoFile = async () =>
  new File([new Uint8Array(await sharp({ create: { width: 1200, height: 1200, channels: 3, background: "#4477aa" } }).jpeg().withExif({ IFD3: { GPSLatitudeRef: "N", GPSLatitude: "12/1 0/1 0/1" } }).toBuffer())], "me.jpg", { type: "image/jpeg" });
const getPhoto = (id: string) => staffPhoto(new Request(`http://localhost/api/staff-photo/${id}`), { params: Promise.resolve({ id }) });

beforeEach(async () => {
  await resetDb();
  cookieJar.clear();
  T = await makeTenant("Staffy");
  staffId = (await db.staff.create({ data: { organizationId: T.org.id, branchId: T.b1.id, name: "Ravi" } })).id;
});

describe("employee IDs", () => {
  it("builds a prefix from the business name and counts up", async () => {
    expect(codePrefix("Kesar & Clove")).toBe("KC");
    expect(codePrefix("Urban Fit Gyms")).toBe("UFG");
    expect(codePrefix("Tanishq")).toBe("TA");
    expect(await nextEmployeeCode(T.org.id, "Kesar & Clove")).toBe("KC-0001");
    await db.staff.update({ where: { id: staffId }, data: { employeeCode: "KC-0009" } });
    expect(await nextEmployeeCode(T.org.id, "Kesar & Clove")).toBe("KC-0010");
  });
});

describe("staff details", () => {
  it("saves details with the emergency contact encrypted and an automatic ID", async () => {
    await signInAs(T.owner.id);
    const url = await redirectOf(updateStaff(form({ staffId, name: "Ravi Kumar", designation: "Senior Waiter", employeeCode: "", bloodGroup: "B+", emergencyContact: "+91 99887 66554", validUntil: "2027-03-31" })));
    expect(url).toBe(`/dashboard/staff/${staffId}?saved=1`);
    const s = await db.staff.findUniqueOrThrow({ where: { id: staffId } });
    expect(s).toMatchObject({ name: "Ravi Kumar", designation: "Senior Waiter", bloodGroup: "B+", employeeCode: "SC-0001" });
    expect(s.emergencyContactEnc).not.toContain("9988766554");
    expect(decryptField(s.emergencyContactEnc)).toBe("9988766554");
  });

  it("rejects duplicate employee IDs and bad blood groups", async () => {
    await db.staff.create({ data: { organizationId: T.org.id, branchId: T.b1.id, name: "Sana", employeeCode: "SC-0005" } });
    await signInAs(T.owner.id);
    const base = { staffId, name: "Ravi", designation: "", bloodGroup: "", emergencyContact: "", validUntil: "" };
    expect(await redirectOf(updateStaff(form({ ...base, employeeCode: "sc-0005" })))).toContain("error=staff-code");
    expect(await redirectOf(updateStaff(form({ ...base, employeeCode: "", bloodGroup: "Z+" })))).toContain("error=staff-details");
  });

  it("only Client Owners of the same account can edit staff", async () => {
    await signInAs(T.admin.id);
    await expect(updateStaff(form({ staffId, name: "X", designation: "", employeeCode: "", bloodGroup: "", emergencyContact: "", validUntil: "" }))).rejects.toBeInstanceOf(NotFoundError);
    const other = await makeTenant("Other");
    await signInAs(other.owner.id);
    await expect(updateStaff(form({ staffId, name: "X", designation: "", employeeCode: "", bloodGroup: "", emergencyContact: "", validUntil: "" }))).rejects.toBeInstanceOf(NotFoundError);
    expect((await db.staff.findUniqueOrThrow({ where: { id: staffId } })).name).toBe("Ravi");
  });
});

describe("staff photos", () => {
  it("needs the employee's consent", async () => {
    await signInAs(T.owner.id);
    expect(await redirectOf(uploadStaffPhoto(form({ staffId, photo: await photoFile() })))).toContain("error=staff-consent");
  });

  it("stores a 600×750 portrait without metadata, private to owners", async () => {
    await signInAs(T.owner.id);
    expect(await redirectOf(uploadStaffPhoto(form({ staffId, consent: "on", photo: await photoFile() })))).toContain("saved=photo");
    const s = await db.staff.findUniqueOrThrow({ where: { id: staffId } });
    expect(s.photoConsentAt).not.toBeNull();
    const res = await getPhoto(staffId);
    expect(res.status).toBe(200);
    const meta = await sharp(Buffer.from(await res.arrayBuffer())).metadata();
    expect(meta).toMatchObject({ format: "webp", width: 600, height: 750 });
    expect(meta.exif).toBeUndefined();

    await signInAs(T.admin.id);
    expect((await getPhoto(staffId)).status).toBe(404);
    const other = await makeTenant("Other");
    await signInAs(other.owner.id);
    expect((await getPhoto(staffId)).status).toBe(404);
  });

  it("replacing or removing a photo deletes the old file", async () => {
    await signInAs(T.owner.id);
    await redirectOf(uploadStaffPhoto(form({ staffId, consent: "on", photo: await photoFile() })));
    await redirectOf(uploadStaffPhoto(form({ staffId, consent: "on", photo: await photoFile() })));
    expect(await db.storedBlob.count()).toBe(1);
    await redirectOf(removeStaffPhoto(form({ staffId })));
    expect(await db.storedBlob.count()).toBe(0);
  });

  it("refuses files that aren't photos", async () => {
    await signInAs(T.owner.id);
    const svg = new File(['<svg xmlns="http://www.w3.org/2000/svg"/>'], "a.jpg", { type: "image/jpeg" });
    expect(await redirectOf(uploadStaffPhoto(form({ staffId, consent: "on", photo: svg })))).toContain("error=logo-type");
  });

  it("deletes staff photo files when the account is purged", async () => {
    await signInAs(T.owner.id);
    await redirectOf(uploadStaffPhoto(form({ staffId, consent: "on", photo: await photoFile() })));
    await db.subscription.update({ where: { organizationId: T.org.id }, data: { currentPeriodEnd: new Date(Date.now() - 100 * 86_400_000) } });
    await runSubscriptionJobs();
    expect(await db.storedBlob.count()).toBe(0);
  });
});
