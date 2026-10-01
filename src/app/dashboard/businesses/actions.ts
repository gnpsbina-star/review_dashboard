"use server";

import { after } from "next/server";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import sharp from "sharp";
import { z } from "zod";
import { requireAccess, type Access } from "@/lib/access";
import { refreshBranchSuggestions } from "@/lib/ai/pool";
import { audit } from "@/lib/audit";
import { BUSINESS_TYPES, TYPE_LABELS } from "@/lib/business-type";
import { isHexColor } from "@/lib/contrast";
import { createQrCode } from "@/lib/data/qr";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { slugify } from "@/lib/shortcode";
import { nextEmployeeCode } from "@/lib/staff";

const Id = z.string().regex(/^[a-z0-9]{10,40}$/);
const text = (max: number) => z.string().trim().min(1).max(max);
const optText = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null);

const GOOGLE_HOSTS = ["search.google.com", "www.google.com", "google.com", "g.page", "maps.app.goo.gl", "maps.google.com", "goo.gl", "g.co"];
const BusinessInput = z
  .object({
    name: text(80),
    type: z.enum(BUSINESS_TYPES),
    category: optText(80),
    address: optText(200),
    brandColor: z.string().refine(isHexColor, "Pick a colour"),
    brandTone: text(60),
    deviceLimitHours: z.coerce.number().int().min(1).max(24),
    qrHeadline: optText(60),
    qrHeadlineHi: optText(60),
  })
  // The description is optional; the type's name stands in for it.
  .transform((v) => ({ ...v, category: v.category ?? TYPE_LABELS[v.type] }));

function fields(form: FormData, keys: string[]) {
  return Object.fromEntries(keys.map((k) => [k, form.get(k) ?? undefined]));
}

async function ownerBusiness(a: Access, id: unknown) {
  const parsed = Id.safeParse(id);
  if (!parsed.success) notFound();
  const business = await db.business.findFirst({ where: { id: parsed.data, organizationId: a.org.id, archivedAt: null } });
  if (!business) notFound();
  return business;
}

async function ownerBranch(a: Access, id: unknown) {
  const parsed = Id.safeParse(id);
  if (!parsed.success) notFound();
  const branch = await db.branch.findFirst({ where: { id: parsed.data, organizationId: a.org.id, archivedAt: null } });
  if (!branch) notFound();
  return branch;
}

function log(a: Access, action: string, entity: string, entityId: string, meta?: Record<string, string | number | boolean | null>) {
  return audit({ organizationId: a.org.id, actorUserId: a.user.id, actorEmail: a.user.email, action, entity, entityId, meta });
}

export async function createBusiness(form: FormData) {
  const a = await requireAccess({ ownerOnly: true });
  const v = BusinessInput.safeParse({ ...fields(form, ["name", "type", "category", "address", "brandColor", "brandTone"]), deviceLimitHours: form.get("deviceLimitHours") ?? 2 });
  if (!v.success) redirect("/dashboard/businesses?error=business");
  const b = await db.business.create({ data: { ...v.data, organizationId: a.org.id } });
  await log(a, "business.create", "Business", b.id);
  redirect(`/dashboard/businesses/${b.id}?saved=created`);
}

export async function updateBusiness(form: FormData) {
  const a = await requireAccess({ ownerOnly: true });
  const b = await ownerBusiness(a, form.get("businessId"));
  const v = BusinessInput.safeParse(fields(form, ["name", "type", "category", "address", "brandColor", "brandTone", "deviceLimitHours", "qrHeadline", "qrHeadlineHi"]));
  if (!v.success) redirect(`/dashboard/businesses/${b.id}?error=business`);
  const aiChanged = v.data.name !== b.name || v.data.type !== b.type || v.data.category !== b.category || v.data.brandTone !== b.brandTone;
  await db.business.update({ where: { id: b.id }, data: v.data });
  if (aiChanged) {
    await db.branch.updateMany({ where: { businessId: b.id }, data: { aiSettingsUpdatedAt: new Date() } });
    const branches = await db.branch.findMany({ where: { businessId: b.id, archivedAt: null }, select: { id: true } });
    after(async () => {
      for (const br of branches) await refreshBranchSuggestions(br.id).catch((e) => console.error("[ai] refresh failed", e instanceof Error ? e.message : e));
    });
  }
  await log(a, "business.update", "Business", b.id, { aiChanged });
  revalidatePath("/dashboard", "layout");
  redirect(`/dashboard/businesses/${b.id}?saved=1`);
}

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
function sniffImage(buf: Buffer): "png" | "jpeg" | "webp" | null {
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (buf.length > 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "webp";
  return null;
}

/** Accepts PNG, JPEG or WebP only (never SVG), checks the real file bytes, and re-encodes to a clean 256×256 PNG. */
export async function uploadLogo(form: FormData) {
  const a = await requireAccess({ ownerOnly: true });
  const b = await ownerBusiness(a, form.get("businessId"));
  const file = form.get("logo");
  if (!(file instanceof File) || file.size === 0) redirect(`/dashboard/businesses/${b.id}?error=logo-missing`);
  if (file.size > MAX_LOGO_BYTES) redirect(`/dashboard/businesses/${b.id}?error=logo-size`);
  const buf = Buffer.from(await file.arrayBuffer());
  if (!sniffImage(buf)) redirect(`/dashboard/businesses/${b.id}?error=logo-type`);
  let png: Buffer;
  try {
    png = await sharp(buf, { limitInputPixels: 40_000_000 }).rotate().resize(256, 256, { fit: "cover" }).png({ compressionLevel: 9 }).toBuffer();
  } catch {
    redirect(`/dashboard/businesses/${b.id}?error=logo-type`);
  }
  await db.businessLogo.upsert({ where: { businessId: b.id }, create: { businessId: b.id, data: new Uint8Array(png) }, update: { data: new Uint8Array(png) } });
  await db.business.update({ where: { id: b.id }, data: { logoVersion: { increment: 1 } } });
  await log(a, "business.logo", "Business", b.id);
  revalidatePath("/dashboard", "layout");
  redirect(`/dashboard/businesses/${b.id}?saved=logo`);
}

export async function removeLogo(form: FormData) {
  const a = await requireAccess({ ownerOnly: true });
  const b = await ownerBusiness(a, form.get("businessId"));
  await db.businessLogo.deleteMany({ where: { businessId: b.id } });
  await db.business.update({ where: { id: b.id }, data: { logoVersion: 0 } });
  redirect(`/dashboard/businesses/${b.id}?saved=logo`);
}

export async function archiveBusiness(form: FormData) {
  const a = await requireAccess({ ownerOnly: true });
  const b = await ownerBusiness(a, form.get("businessId"));
  const now = new Date();
  await db.$transaction([
    db.business.update({ where: { id: b.id }, data: { archivedAt: now } }),
    db.branch.updateMany({ where: { businessId: b.id, archivedAt: null }, data: { archivedAt: now } }),
  ]);
  await log(a, "business.archive", "Business", b.id);
  revalidatePath("/dashboard", "layout");
  redirect("/dashboard/businesses?saved=archived");
}

const LANGS = ["en", "hi", "hinglish"] as const;
const BranchInput = z.object({
  name: text(60),
  cityArea: text(100),
  googleReviewUrl: z.string().trim().max(500).refine((v) => isGoogleReviewUrlSync(v), "Use your Google review link"),
  googlePlaceId: optText(200),
  facebookReviewUrl: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => v || null)
    .refine((v) => v === null || isFacebookUrl(v), "Use your Facebook page link"),
  languages: z.array(z.enum(LANGS)).min(1),
  highlights: z.array(z.string().trim().min(1).max(40)).max(5),
  floatingHelper: z.boolean(),
});

const FACEBOOK_HOSTS = ["facebook.com", "www.facebook.com", "m.facebook.com", "fb.com", "www.fb.com", "fb.me"];
/** Only real Facebook links are accepted for the optional Facebook button. */
function isFacebookUrl(v: string) {
  try {
    const u = new URL(v);
    return u.protocol === "https:" && FACEBOOK_HOSTS.includes(u.hostname);
  } catch {
    return false;
  }
}

/** Only real Google review links are accepted, so a QR can never send customers elsewhere. */
function isGoogleReviewUrlSync(v: string) {
  try {
    const u = new URL(v);
    return u.protocol === "https:" && GOOGLE_HOSTS.includes(u.hostname);
  } catch {
    return false;
  }
}

function branchFields(form: FormData) {
  return {
    name: form.get("name") ?? undefined,
    cityArea: form.get("cityArea") ?? undefined,
    googleReviewUrl: form.get("googleReviewUrl") ?? undefined,
    googlePlaceId: form.get("googlePlaceId") ?? undefined,
    facebookReviewUrl: form.get("facebookReviewUrl") ?? undefined,
    languages: form.getAll("languages").map(String),
    floatingHelper: form.get("floatingHelper") === "on",
    highlights: String(form.get("highlights") ?? "")
      .split(/[,\n]/)
      .map((h) => h.trim())
      .filter(Boolean),
  };
}

async function uniqueSlug(base: string): Promise<string> {
  const root = slugify(base) || "branch";
  for (let i = 1; i < 100; i++) {
    const slug = i === 1 ? root : `${root}-${i}`;
    if (!(await db.branch.findUnique({ where: { slug }, select: { id: true } }))) return slug;
  }
  throw new Error("Could not create a unique branch address");
}

export async function createBranch(form: FormData) {
  const a = await requireAccess({ ownerOnly: true });
  const b = await ownerBusiness(a, form.get("businessId"));
  const active = await db.branch.count({ where: { organizationId: a.org.id, archivedAt: null } });
  if (active >= a.plan.maxBranches) redirect(`/dashboard/businesses/${b.id}?error=branch-limit`);
  const v = BranchInput.safeParse(branchFields(form));
  if (!v.success) redirect(`/dashboard/businesses/${b.id}?error=branch`);
  const branch = await db.branch.create({
    data: { ...v.data, organizationId: a.org.id, businessId: b.id, slug: await uniqueSlug(`${b.name} ${v.data.name}`) },
  });
  await createQrCode(branch, "BRANCH", "branch");
  await log(a, "branch.create", "Branch", branch.id);
  after(() => refreshBranchSuggestions(branch.id).catch((e) => console.error("[ai] initial pool failed", e instanceof Error ? e.message : e)));
  revalidatePath("/dashboard", "layout");
  redirect(`/dashboard/branches/${branch.id}?saved=created`);
}

export async function updateBranch(form: FormData) {
  const a = await requireAccess({ ownerOnly: true });
  const br = await ownerBranch(a, form.get("branchId"));
  const v = BranchInput.safeParse(branchFields(form));
  if (!v.success) redirect(`/dashboard/branches/${br.id}?error=branch`);
  const aiChanged =
    v.data.name !== br.name ||
    v.data.cityArea !== br.cityArea ||
    v.data.languages.join() !== br.languages.join() ||
    v.data.highlights.join("|") !== br.highlights.join("|");
  // The slug never changes: printed QR codes depend on it.
  await db.branch.update({ where: { id: br.id }, data: { ...v.data, ...(aiChanged ? { aiSettingsUpdatedAt: new Date() } : {}) } });
  await log(a, "branch.update", "Branch", br.id, { aiChanged });
  if (aiChanged) after(() => refreshBranchSuggestions(br.id).catch((e) => console.error("[ai] refresh failed", e instanceof Error ? e.message : e)));
  revalidatePath("/dashboard", "layout");
  redirect(`/dashboard/branches/${br.id}?saved=${aiChanged ? "ai" : "1"}`);
}

export async function archiveBranch(form: FormData) {
  const a = await requireAccess({ ownerOnly: true });
  const br = await ownerBranch(a, form.get("branchId"));
  await db.branch.update({ where: { id: br.id }, data: { archivedAt: new Date() } });
  await log(a, "branch.archive", "Branch", br.id);
  revalidatePath("/dashboard", "layout");
  redirect(`/dashboard/businesses/${br.businessId}?saved=branch-archived`);
}

export async function regenerateSuggestions(form: FormData) {
  const a = await requireAccess({ ownerOnly: true });
  const br = await ownerBranch(a, form.get("branchId"));
  if (!(await rateLimit(`regen:${br.id}`, 3, 3_600_000))) redirect(`/dashboard/branches/${br.id}?error=regen-limit`);
  await refreshBranchSuggestions(br.id);
  await log(a, "branch.suggestions.refresh", "Branch", br.id);
  redirect(`/dashboard/branches/${br.id}?saved=regenerated`);
}

export async function addStaff(form: FormData) {
  const a = await requireAccess({ ownerOnly: true });
  const br = await ownerBranch(a, form.get("branchId"));
  const name = text(40).safeParse(form.get("name"));
  if (!name.success) redirect(`/dashboard/branches/${br.id}?error=staff`);
  const business = await db.business.findUniqueOrThrow({ where: { id: br.businessId }, select: { name: true } });
  const s = await db.staff.create({ data: { organizationId: a.org.id, branchId: br.id, name: name.data, employeeCode: await nextEmployeeCode(a.org.id, business.name) } });
  await createQrCode(br, "STAFF", `staff:${s.id}`, { staffId: s.id });
  await log(a, "staff.create", "Staff", s.id);
  revalidatePath(`/dashboard/branches/${br.id}`);
}

export async function setStaffActive(form: FormData) {
  const a = await requireAccess({ ownerOnly: true });
  const id = Id.safeParse(form.get("staffId"));
  if (!id.success) notFound();
  // Removed staff come back only through Restore.
  const s = await db.staff.findFirst({ where: { id: id.data, organizationId: a.org.id, removedAt: null } });
  if (!s) notFound();
  const active = form.get("active") === "true";
  await db.staff.update({ where: { id: s.id }, data: { active } });
  await log(a, active ? "staff.activate" : "staff.deactivate", "Staff", s.id);
  revalidatePath(`/dashboard/branches/${s.branchId}`);
}
