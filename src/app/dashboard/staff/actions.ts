"use server";

import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAccess, type Access } from "@/lib/access";
import { audit } from "@/lib/audit";
import { encryptField } from "@/lib/crypto";
import { normalizeIndianMobile } from "@/lib/customer-i18n";
import { db } from "@/lib/db";
import { BLOOD_GROUPS, nextEmployeeCode, processStaffPhoto, removeStaffPhotoFile, replaceStaffPhoto } from "@/lib/staff";

const Id = z.string().regex(/^[a-z0-9]{10,40}$/);

async function ownerStaff(a: Access, id: unknown) {
  const parsed = Id.safeParse(id);
  if (!parsed.success) notFound();
  const s = await db.staff.findFirst({ where: { id: parsed.data, organizationId: a.org.id }, include: { branch: { include: { business: true } } } });
  if (!s) notFound();
  return s;
}

const Details = z.object({
  name: z.string().trim().min(1).max(40),
  designation: z.string().trim().max(40).transform((v) => v || null),
  employeeCode: z.string().trim().toUpperCase().max(20).regex(/^[A-Z0-9-]*$/).transform((v) => v || null),
  bloodGroup: z.union([z.enum(BLOOD_GROUPS), z.literal("")]).transform((v) => v || null),
  emergencyContact: z.string().trim().max(20),
  validUntil: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("")]),
});

export async function updateStaff(form: FormData) {
  const a = await requireAccess({ ownerOnly: true });
  const s = await ownerStaff(a, form.get("staffId"));
  const v = Details.safeParse(Object.fromEntries(["name", "designation", "employeeCode", "bloodGroup", "emergencyContact", "validUntil"].map((k) => [k, String(form.get(k) ?? "")])));
  if (!v.success) redirect(`/dashboard/staff/${s.id}?error=staff-details`);
  const phone = v.data.emergencyContact ? normalizeIndianMobile(v.data.emergencyContact) : null;
  if (v.data.emergencyContact && !phone) redirect(`/dashboard/staff/${s.id}?error=staff-phone`);
  const code = v.data.employeeCode ?? s.employeeCode ?? (await nextEmployeeCode(a.org.id, s.branch.business.name));
  const clash = await db.staff.findFirst({ where: { organizationId: a.org.id, employeeCode: code, id: { not: s.id } }, select: { id: true } });
  if (clash) redirect(`/dashboard/staff/${s.id}?error=staff-code`);
  await db.staff.update({
    where: { id: s.id },
    data: {
      name: v.data.name,
      designation: v.data.designation,
      employeeCode: code,
      bloodGroup: v.data.bloodGroup,
      emergencyContactEnc: phone ? encryptField(phone) : null,
      validUntil: v.data.validUntil ? new Date(`${v.data.validUntil}T23:59:59+05:30`) : null,
    },
  });
  await audit({ organizationId: a.org.id, actorUserId: a.user.id, actorEmail: a.user.email, action: "staff.update", entity: "Staff", entityId: s.id });
  revalidatePath(`/dashboard/branches/${s.branchId}`);
  redirect(`/dashboard/staff/${s.id}?saved=1`);
}

export async function uploadStaffPhoto(form: FormData) {
  const a = await requireAccess({ ownerOnly: true });
  const s = await ownerStaff(a, form.get("staffId"));
  if (form.get("consent") !== "on") redirect(`/dashboard/staff/${s.id}?error=staff-consent`);
  const file = form.get("photo");
  if (!(file instanceof File) || file.size === 0) redirect(`/dashboard/staff/${s.id}?error=logo-missing`);
  const result = await processStaffPhoto(file);
  if (result === "size") redirect(`/dashboard/staff/${s.id}?error=staff-photo-size`);
  if (result === "type") redirect(`/dashboard/staff/${s.id}?error=logo-type`);
  await replaceStaffPhoto(s, result);
  await audit({ organizationId: a.org.id, actorUserId: a.user.id, actorEmail: a.user.email, action: "staff.photo", entity: "Staff", entityId: s.id });
  redirect(`/dashboard/staff/${s.id}?saved=photo`);
}

export async function removeStaffPhoto(form: FormData) {
  const a = await requireAccess({ ownerOnly: true });
  const s = await ownerStaff(a, form.get("staffId"));
  await removeStaffPhotoFile(s);
  await audit({ organizationId: a.org.id, actorUserId: a.user.id, actorEmail: a.user.email, action: "staff.photo.remove", entity: "Staff", entityId: s.id });
  redirect(`/dashboard/staff/${s.id}?saved=photo-removed`);
}

/** Hides a staff member everywhere. Their past ratings stay, and their printed QR code becomes a branch code. */
export async function removeStaff(form: FormData) {
  const a = await requireAccess({ ownerOnly: true });
  const s = await ownerStaff(a, form.get("staffId"));
  if (!s.removedAt) {
    await db.staff.update({ where: { id: s.id }, data: { removedAt: new Date(), active: false } });
    await audit({ organizationId: a.org.id, actorUserId: a.user.id, actorEmail: a.user.email, action: "staff.remove", entity: "Staff", entityId: s.id });
  }
  revalidatePath(`/dashboard/branches/${s.branchId}`);
  revalidatePath("/dashboard/qr");
  redirect(`/dashboard/branches/${s.branchId}?saved=staff-removed`);
}

export async function restoreStaff(form: FormData) {
  const a = await requireAccess({ ownerOnly: true });
  const s = await ownerStaff(a, form.get("staffId"));
  if (s.removedAt) {
    await db.staff.update({ where: { id: s.id }, data: { removedAt: null, active: true } });
    await audit({ organizationId: a.org.id, actorUserId: a.user.id, actorEmail: a.user.email, action: "staff.restore", entity: "Staff", entityId: s.id });
  }
  revalidatePath(`/dashboard/branches/${s.branchId}`);
  revalidatePath("/dashboard/qr");
  redirect(`/dashboard/branches/${s.branchId}?saved=staff-restored`);
}
