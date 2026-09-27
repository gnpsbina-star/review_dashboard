"use server";

import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ORG_COOKIE, requirePlatformOwner } from "@/lib/access";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { AI_PROVIDERS, setAiProviderName } from "@/lib/settings";
import { addDays, renewedPeriodEnd } from "@/lib/subscription";
import type { ProviderName } from "@/lib/ai/types";

const Id = z.string().regex(/^[a-z0-9]{10,40}$/);

async function org(id: unknown) {
  const parsed = Id.safeParse(id);
  if (!parsed.success) notFound();
  const o = await db.organization.findUnique({ where: { id: parsed.data }, include: { subscription: true } });
  if (!o) notFound();
  return o;
}

const NewClient = z.object({
  name: z.string().trim().min(1).max(100),
  ownerEmail: z.string().trim().toLowerCase().email().max(200),
  planName: z.string().trim().min(1).max(40),
  maxBranches: z.coerce.number().int().min(1).max(500),
  start: z.enum(["trial", "paid"]),
  trialDays: z.coerce.number().int().min(1).max(60),
});

export async function createClient(form: FormData) {
  const me = await requirePlatformOwner();
  const v = NewClient.safeParse(Object.fromEntries(["name", "ownerEmail", "planName", "maxBranches", "start", "trialDays"].map((k) => [k, form.get(k) ?? undefined])));
  if (!v.success) redirect("/platform/clients/new?error=1");
  const now = new Date();
  const user = await db.user.upsert({ where: { email: v.data.ownerEmail }, create: { email: v.data.ownerEmail }, update: {} });
  const o = await db.organization.create({
    data: {
      name: v.data.name,
      subscription: {
        create: {
          planName: v.data.planName,
          maxBranches: v.data.maxBranches,
          trialEndsAt: v.data.start === "trial" ? addDays(now, v.data.trialDays) : null,
          currentPeriodEnd: v.data.start === "paid" ? renewedPeriodEnd(null, now) : null,
        },
      },
      memberships: { create: { userId: user.id, role: "CLIENT_OWNER", receiveAllAlerts: true } },
    },
  });
  await audit({ organizationId: o.id, actorUserId: me.id, actorEmail: me.email, action: "client.create", entity: "Organization", entityId: o.id, meta: { owner: v.data.ownerEmail, start: v.data.start } });
  redirect(`/platform/clients/${o.id}?saved=created`);
}

export async function renewYear(form: FormData) {
  const me = await requirePlatformOwner();
  const o = await org(form.get("orgId"));
  const end = renewedPeriodEnd(o.subscription);
  await db.subscription.upsert({
    where: { organizationId: o.id },
    create: { organizationId: o.id, currentPeriodEnd: end },
    update: { currentPeriodEnd: end, purgeWarningSentAt: null },
  });
  await audit({ organizationId: o.id, actorUserId: me.id, actorEmail: me.email, action: "subscription.renew", entity: "Organization", entityId: o.id, meta: { until: end.toISOString() } });
  revalidatePath("/platform", "layout");
  redirect(String(form.get("back") ?? "") === "list" ? "/platform?saved=renewed" : `/platform/clients/${o.id}?saved=renewed`);
}

export async function extendTrial(form: FormData) {
  const me = await requirePlatformOwner();
  const o = await org(form.get("orgId"));
  const days = z.coerce.number().int().min(1).max(60).parse(form.get("days") ?? 7);
  const base = o.subscription?.trialEndsAt && o.subscription.trialEndsAt > new Date() ? o.subscription.trialEndsAt : new Date();
  const end = addDays(base, days);
  await db.subscription.upsert({ where: { organizationId: o.id }, create: { organizationId: o.id, trialEndsAt: end }, update: { trialEndsAt: end } });
  await audit({ organizationId: o.id, actorUserId: me.id, actorEmail: me.email, action: "subscription.trial.extend", entity: "Organization", entityId: o.id, meta: { days } });
  redirect(`/platform/clients/${o.id}?saved=1`);
}

const Plan = z.object({ name: z.string().trim().min(1).max(100), planName: z.string().trim().min(1).max(40), maxBranches: z.coerce.number().int().min(1).max(500) });

export async function updateClient(form: FormData) {
  const me = await requirePlatformOwner();
  const o = await org(form.get("orgId"));
  const v = Plan.safeParse({ name: form.get("name"), planName: form.get("planName"), maxBranches: form.get("maxBranches") });
  if (!v.success) redirect(`/platform/clients/${o.id}?error=1`);
  await db.organization.update({ where: { id: o.id }, data: { name: v.data.name } });
  await db.subscription.upsert({
    where: { organizationId: o.id },
    create: { organizationId: o.id, planName: v.data.planName, maxBranches: v.data.maxBranches },
    update: { planName: v.data.planName, maxBranches: v.data.maxBranches },
  });
  await audit({ organizationId: o.id, actorUserId: me.id, actorEmail: me.email, action: "client.update", entity: "Organization", entityId: o.id, meta: v.data });
  redirect(`/platform/clients/${o.id}?saved=1`);
}

export async function setSuspended(form: FormData) {
  const me = await requirePlatformOwner();
  const o = await org(form.get("orgId"));
  const suspend = form.get("suspend") === "true";
  await db.organization.update({ where: { id: o.id }, data: { status: suspend ? "SUSPENDED" : "ACTIVE" } });
  await audit({ organizationId: o.id, actorUserId: me.id, actorEmail: me.email, action: suspend ? "client.suspend" : "client.resume", entity: "Organization", entityId: o.id });
  redirect(`/platform/clients/${o.id}?saved=1`);
}

/** Opens a client's dashboard as the platform owner. Every visit is audit-logged. */
export async function viewClientDashboard(form: FormData) {
  const me = await requirePlatformOwner();
  const o = await org(form.get("orgId"));
  (await cookies()).set(ORG_COOKIE, o.id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 8 });
  await audit({ organizationId: o.id, actorUserId: me.id, actorEmail: me.email, action: "client.dashboard.view", entity: "Organization", entityId: o.id });
  redirect("/dashboard");
}

export async function setProvider(form: FormData) {
  const me = await requirePlatformOwner();
  const name = String(form.get("provider"));
  if (!(AI_PROVIDERS as string[]).includes(name)) redirect("/platform/settings?error=1");
  await setAiProviderName(name as ProviderName);
  await audit({ actorUserId: me.id, actorEmail: me.email, action: "platform.ai_provider", entity: "PlatformSetting", entityId: "ai.provider", meta: { provider: name } });
  redirect("/platform/settings?saved=1");
}
