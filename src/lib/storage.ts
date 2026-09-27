import "server-only";
import { AwsClient } from "aws4fetch";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

/**
 * Private object storage for customer photos. Uses Cloudflare R2 (S3 API) when
 * configured, otherwise a database table so development works without setup.
 * Objects are never public: they are served only through an access-checked route.
 */
export type Backend = "r2" | "db";

function r2() {
  const e = env();
  if (!e.R2_ACCOUNT_ID || !e.R2_ACCESS_KEY_ID || !e.R2_SECRET_ACCESS_KEY || !e.R2_BUCKET) return null;
  const client = new AwsClient({ accessKeyId: e.R2_ACCESS_KEY_ID, secretAccessKey: e.R2_SECRET_ACCESS_KEY, service: "s3", region: "auto" });
  const base = `https://${e.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${encodeURIComponent(e.R2_BUCKET)}`;
  return { client, url: (key: string) => `${base}/${key.split("/").map(encodeURIComponent).join("/")}` };
}

export function activeBackend(): Backend {
  return r2() ? "r2" : "db";
}

export async function putObject(key: string, data: Buffer, contentType: string): Promise<Backend> {
  const r = r2();
  if (r) {
    const res = await r.client.fetch(r.url(key), { method: "PUT", body: new Uint8Array(data), headers: { "Content-Type": contentType }, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`R2 upload failed with HTTP ${res.status}`);
    return "r2";
  }
  await db.reviewPhotoBlob.create({ data: { storageKey: key, data: new Uint8Array(data) } });
  return "db";
}

export async function getObject(backend: Backend, key: string): Promise<Buffer | null> {
  if (backend === "r2") {
    const r = r2();
    if (!r) return null;
    const res = await r.client.fetch(r.url(key), { signal: AbortSignal.timeout(15_000) });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`R2 download failed with HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
  const blob = await db.reviewPhotoBlob.findUnique({ where: { storageKey: key } });
  return blob ? Buffer.from(blob.data) : null;
}

export async function deleteObjects(items: { storage: string; storageKey: string }[]): Promise<void> {
  const r = r2();
  for (const it of items) {
    if (it.storage === "r2") {
      if (!r) continue;
      const res = await r.client.fetch(r.url(it.storageKey), { method: "DELETE", signal: AbortSignal.timeout(15_000) });
      if (!res.ok && res.status !== 404) throw new Error(`R2 delete failed with HTTP ${res.status}`);
    }
  }
  await db.reviewPhotoBlob.deleteMany({ where: { storageKey: { in: items.filter((i) => i.storage === "db").map((i) => i.storageKey) } } });
}
