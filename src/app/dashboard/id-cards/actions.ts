"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAccess } from "@/lib/access";
import { audit } from "@/lib/audit";
import { MAX_CARDS } from "@/lib/data/id-cards";
import { createQrCode } from "@/lib/data/qr";
import { db } from "@/lib/db";

const Input = z.object({
  staffIds: z.array(z.string().regex(/^[a-z0-9]{10,40}$/)).min(1).max(MAX_CARDS),
  layout: z.enum(["a4", "single"]),
});

/** Makes sure every chosen staff member has their review QR code, then opens the print page. */
export async function prepareIdCards(form: FormData) {
  const a = await requireAccess({ ownerOnly: true });
  const v = Input.safeParse({ staffIds: form.getAll("staffIds").map(String), layout: form.get("layout") });
  if (!v.success) redirect(`/dashboard/id-cards?error=pick${form.get("branch") ? `&branch=${encodeURIComponent(String(form.get("branch")))}` : ""}`);
  const staff = await db.staff.findMany({
    where: { id: { in: v.data.staffIds }, organizationId: a.org.id, active: true },
    include: { branch: { select: { id: true, organizationId: true } } },
  });
  for (const s of staff) await createQrCode(s.branch, "STAFF", `staff:${s.id}`, { staffId: s.id });
  await audit({ organizationId: a.org.id, actorUserId: a.user.id, actorEmail: a.user.email, action: "id_cards.print", entity: "Staff", meta: { count: staff.length, layout: v.data.layout } });
  redirect(`/dashboard/id-cards/print?layout=${v.data.layout}&ids=${staff.map((s) => s.id).join(",")}`);
}
