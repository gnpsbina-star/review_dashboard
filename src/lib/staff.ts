import "server-only";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { db } from "@/lib/db";
import { sniffPhoto } from "@/lib/photos";
import { deleteObjects, putObject } from "@/lib/storage";

export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;
export const STAFF_PHOTO = { width: 600, height: 750 }; // 4:5 passport-style portrait
const MAX_UPLOAD = 4 * 1024 * 1024; // Vercel caps request bodies at 4.5 MB

/** Two or three capital letters from the business name, e.g. "Kesar & Clove" → "KC". */
export function codePrefix(businessName: string): string {
  const words = businessName.replace(/[^A-Za-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  const p = (words.length >= 2 ? words.slice(0, 3).map((w) => w[0]) : [...(words[0] ?? "ST").slice(0, 2)]).join("").toUpperCase();
  return p || "ST";
}

/** Next free employee ID in the account, e.g. KC-0007. */
export async function nextEmployeeCode(organizationId: string, businessName: string): Promise<string> {
  const prefix = codePrefix(businessName);
  const existing = await db.staff.findMany({ where: { organizationId, employeeCode: { startsWith: `${prefix}-` } }, select: { employeeCode: true } });
  const max = existing.reduce((m, s) => Math.max(m, Number(s.employeeCode?.split("-")[1]) || 0), 0);
  return `${prefix}-${String(max + 1).padStart(4, "0")}`;
}

/** Checks the file bytes and re-encodes a clean portrait (metadata removed). */
export async function processStaffPhoto(file: File): Promise<Buffer | "size" | "type"> {
  if (file.size > MAX_UPLOAD) return "size";
  const buf = Buffer.from(await file.arrayBuffer());
  if (!sniffPhoto(buf)) return "type";
  try {
    return await sharp(buf, { limitInputPixels: 50_000_000, failOn: "error" })
      .rotate()
      .resize({ ...STAFF_PHOTO, fit: "cover", position: sharp.strategy.attention })
      .webp({ quality: 88 })
      .toBuffer();
  } catch {
    return "type";
  }
}

/** Stores a new staff photo privately and removes the previous file. */
export async function replaceStaffPhoto(staff: { id: string; organizationId: string; photoKey: string | null; photoStorage: string | null }, data: Buffer) {
  const key = `staff/${staff.organizationId}/${staff.id}/${randomUUID()}.webp`;
  const storage = await putObject(key, data, "image/webp");
  await db.staff.update({ where: { id: staff.id }, data: { photoKey: key, photoStorage: storage, photoVersion: { increment: 1 }, photoConsentAt: new Date() } });
  if (staff.photoKey && staff.photoStorage) await deleteObjects([{ storage: staff.photoStorage, storageKey: staff.photoKey }]);
}

export async function removeStaffPhotoFile(staff: { id: string; photoKey: string | null; photoStorage: string | null }) {
  if (staff.photoKey && staff.photoStorage) await deleteObjects([{ storage: staff.photoStorage, storageKey: staff.photoKey }]);
  await db.staff.update({ where: { id: staff.id }, data: { photoKey: null, photoStorage: null, photoConsentAt: null } });
}

/** Deletes every staff photo file of an account (used before an account is purged). */
export async function deleteOrgStaffPhotos(organizationId: string) {
  const rows = await db.staff.findMany({ where: { organizationId, photoKey: { not: null } }, select: { photoKey: true, photoStorage: true } });
  if (rows.length) await deleteObjects(rows.map((r) => ({ storage: r.photoStorage!, storageKey: r.photoKey! })));
}
