import "server-only";
import { randomUUID } from "node:crypto";
import { businessTypeOf } from "@/lib/business-type";
import { db } from "@/lib/db";
import type { Branch, Business } from "@/generated/prisma/client";
import { getAiProviderName } from "@/lib/settings";
import { buildPrompt } from "./prompt";
import { getProvider } from "./providers";
import { templateSuggestions } from "./templates";
import { cleanSuggestions } from "./validate";
import type { BranchProfile, Lang } from "./types";

/** 100 suggestions per language per branch, split between 4★ and 5★ wording. */
export const PER_TIER = 50;
export const REFRESH_EVERY_DAYS = 7;

export interface RefreshResult {
  branchId: string;
  provider: string;
  aiCount: number;
  templateCount: number;
}

export function branchProfile(branch: Branch & { business: Business }): BranchProfile {
  return {
    businessName: branch.business.name,
    branchName: branch.name,
    cityArea: branch.cityArea,
    type: businessTypeOf(branch.business),
    category: branch.business.category,
    highlights: branch.highlights,
    tone: branch.business.brandTone,
  };
}

/** True while the saved pool predates the branch's current settings (or was never written). */
export function poolIsStale(branch: Pick<Branch, "aiSettingsUpdatedAt" | "suggestionsRefreshedAt">): boolean {
  return !branch.suggestionsRefreshedAt || branch.aiSettingsUpdatedAt > branch.suggestionsRefreshedAt;
}

/** Regenerates a branch's suggestion pool. The old pool is replaced, never appended to. */
export async function refreshBranchSuggestions(branchId: string): Promise<RefreshResult> {
  const branch = await db.branch.findUniqueOrThrow({ where: { id: branchId }, include: { business: true } });
  const profile = branchProfile(branch);
  const providerName = await getAiProviderName();
  const provider = providerName === "MOCK" ? null : getProvider(providerName);
  const langs = (branch.languages.length ? branch.languages : ["en"]) as Lang[];

  const rows: { language: Lang; ratingTier: number; text: string; mentionsStaff: boolean }[] = [];
  let aiCount = 0;
  let templateCount = 0;
  for (const language of langs) {
    for (const tier of [4, 5] as const) {
      let texts: string[] = [];
      if (provider) {
        try {
          const raw = await provider.generate(buildPrompt({ profile, language, ratingTier: tier, count: PER_TIER + 10 }));
          texts = cleanSuggestions(raw, language, PER_TIER);
          aiCount += texts.length;
        } catch (err) {
          console.error(`[ai] ${providerName} failed for branch ${branchId}:`, err instanceof Error ? err.message : err);
        }
      }
      if (texts.length < 10) {
        const extra = templateSuggestions(profile, language, tier, PER_TIER).filter((t) => !texts.includes(t));
        templateCount += Math.min(extra.length, PER_TIER - texts.length);
        texts = texts.concat(extra).slice(0, PER_TIER);
      }
      for (const text of texts) rows.push({ language, ratingTier: tier, text, mentionsStaff: text.includes("{{staff}}") });
    }
  }

  const batchId = randomUUID();
  await db.$transaction([
    db.aiSuggestion.deleteMany({ where: { branchId } }),
    db.aiSuggestion.createMany({
      data: rows.map((r) => ({ ...r, branchId, organizationId: branch.organizationId, batchId })),
    }),
    db.branch.update({ where: { id: branchId }, data: { suggestionsRefreshedAt: new Date() } }),
  ]);
  return { branchId, provider: provider ? providerName : "TEMPLATES", aiCount, templateCount };
}

export interface ShownSuggestion {
  id: string;
  language: Lang;
  text: string;
}

function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * A random sample from the pool for the customer page. Staff mentions are
 * filled in from the QR code's staff member, or skipped when there is none.
 * While the pool is out of date (new branch, or settings just changed), fresh
 * template wording for the business type is served until the rewrite lands.
 */
export async function sampleSuggestions(branch: Branch & { business: Business }, tier: 4 | 5, staffName: string | null, take = 24): Promise<ShownSuggestion[]> {
  const pool = poolIsStale(branch)
    ? templatePool(branch, tier)
    : await db.aiSuggestion.findMany({
        where: { branchId: branch.id, ratingTier: tier, ...(staffName ? {} : { mentionsStaff: false }) },
        select: { id: true, language: true, text: true },
      });
  return shuffle(pool.filter((s) => staffName || !s.text.includes("{{staff}}")))
    .slice(0, take)
    .map((s) => ({ id: s.id, language: s.language as Lang, text: staffName ? s.text.replaceAll("{{staff}}", staffName) : s.text }));
}

function templatePool(branch: Branch & { business: Business }, tier: 4 | 5) {
  const profile = branchProfile(branch);
  const langs = (branch.languages.length ? branch.languages : ["en"]) as Lang[];
  return langs.flatMap((language) => templateSuggestions(profile, language, tier, PER_TIER).map((text, i) => ({ id: `tpl-${language}-${tier}-${i}`, language, text })));
}
