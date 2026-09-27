import "server-only";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { db } from "@/lib/db";
import { deleteObjects, putObject } from "@/lib/storage";

export const MAX_PHOTOS = 3;
/** Per file, before our re-encoding. The page shrinks photos first, so real uploads are far smaller. */
export const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 4.4 * 1024 * 1024; // stays under Vercel's 4.5 MB request limit
const MAX_SIDE = 1600;

export type PhotoError = "photo-count" | "photo-size" | "photo-type";

/** Checks the real file bytes, not the name or declared type. SVG and everything else is refused. */
export function sniffPhoto(buf: Buffer): "jpeg" | "png" | "webp" | null {
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (buf.length > 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "webp";
  return null;
}

export interface CleanPhoto {
  data: Buffer;
  width: number;
  height: number;
}

/**
 * Validates and re-encodes customer photos: fixes rotation, shrinks to 1600px,
 * and writes a fresh WebP. Re-encoding drops all metadata, including GPS location.
 */
export async function cleanPhotos(files: File[]): Promise<{ ok: true; photos: CleanPhoto[] } | { ok: false; error: PhotoError }> {
  if (files.length > MAX_PHOTOS) return { ok: false, error: "photo-count" };
  const total = files.reduce((n, f) => n + f.size, 0);
  if (files.some((f) => f.size > MAX_PHOTO_BYTES) || total > MAX_TOTAL_BYTES) return { ok: false, error: "photo-size" };
  const photos: CleanPhoto[] = [];
  for (const f of files) {
    const buf = Buffer.from(await f.arrayBuffer());
    if (!sniffPhoto(buf)) return { ok: false, error: "photo-type" };
    try {
      const { data, info } = await sharp(buf, { limitInputPixels: 50_000_000, failOn: "error" })
        .rotate()
        .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 75 })
        .toBuffer({ resolveWithObject: true });
      photos.push({ data, width: info.width, height: info.height });
    } catch {
      return { ok: false, error: "photo-type" };
    }
  }
  return { ok: true, photos };
}

/** Stores cleaned photos for a complaint. Keys are random; nothing about the customer is in them. */
export async function savePhotos(organizationId: string, reviewId: string, photos: CleanPhoto[]) {
  for (const p of photos) {
    const storageKey = `photos/${organizationId}/${reviewId}/${randomUUID()}.webp`;
    const storage = await putObject(storageKey, p.data, "image/webp");
    await db.reviewPhoto.create({ data: { organizationId, reviewId, storage, storageKey, bytes: p.data.length, width: p.width, height: p.height } });
  }
}

/** Deletes stored photo files, then their rows. */
export async function deletePhotos(where: { reviewId?: string; organizationId?: string; reviewIds?: string[] }) {
  if (!where.reviewId && !where.organizationId && !where.reviewIds) throw new Error("deletePhotos needs a filter");
  const rows = await db.reviewPhoto.findMany({
    where: { ...(where.reviewId ? { reviewId: where.reviewId } : {}), ...(where.organizationId ? { organizationId: where.organizationId } : {}), ...(where.reviewIds ? { reviewId: { in: where.reviewIds } } : {}) },
    select: { id: true, storage: true, storageKey: true },
  });
  if (rows.length === 0) return 0;
  await deleteObjects(rows);
  await db.reviewPhoto.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } });
  return rows.length;
}
