"use server";

import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAccess } from "@/lib/access";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { createQrCode } from "@/lib/data/qr";

const Range = z.object({ branchId: z.string().regex(/^[a-z0-9]{10,40}$/), from: z.coerce.number().int().min(1).max(500), to: z.coerce.number().int().min(1).max(500) });

export async function createTableCodes(form: FormData) {
  const a = await requireAccess({ ownerOnly: true });
  const v = Range.safeParse({ branchId: form.get("branchId"), from: form.get("from"), to: form.get("to") });
  if (!v.success || v.data.to < v.data.from || v.data.to - v.data.from > 99) return;
  const branch = await db.branch.findFirst({ where: { id: v.data.branchId, organizationId: a.org.id, archivedAt: null } });
  if (!branch) notFound();
  let created = 0;
  for (let t = v.data.from; t <= v.data.to; t++) {
    if (await createQrCode(branch, "TABLE", `table:${t}`, { tableLabel: String(t) })) created++;
  }
  await audit({ organizationId: a.org.id, actorUserId: a.user.id, actorEmail: a.user.email, action: "qr.tables.create", entity: "Branch", entityId: branch.id, meta: { from: v.data.from, to: v.data.to, created } });
  revalidatePath("/dashboard/qr");
}

export async function createStaffCodes(form: FormData) {
  const a = await requireAccess({ ownerOnly: true });
  const id = z.string().regex(/^[a-z0-9]{10,40}$/).safeParse(form.get("branchId"));
  if (!id.success) notFound();
  const branch = await db.branch.findFirst({ where: { id: id.data, organizationId: a.org.id, archivedAt: null }, include: { staff: { where: { active: true } } } });
  if (!branch) notFound();
  for (const s of branch.staff) await createQrCode(branch, "STAFF", `staff:${s.id}`, { staffId: s.id });
  revalidatePath("/dashboard/qr");
}
