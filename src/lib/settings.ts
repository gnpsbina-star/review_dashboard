import "server-only";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import type { ProviderName } from "@/lib/ai/types";

const AI_PROVIDER_KEY = "ai.provider";
const PROVIDERS: ProviderName[] = ["GEMINI", "ANTHROPIC", "OPENAI", "MOCK"];

/** Active AI provider: the platform owner's choice in settings, else AI_PROVIDER from the environment. */
export async function getAiProviderName(): Promise<ProviderName> {
  const row = await db.platformSetting.findUnique({ where: { key: AI_PROVIDER_KEY } });
  const v = row?.value;
  if (typeof v === "string" && (PROVIDERS as string[]).includes(v)) return v as ProviderName;
  return env().AI_PROVIDER;
}

export async function setAiProviderName(name: ProviderName) {
  if (!PROVIDERS.includes(name)) throw new Error("Unknown provider");
  await db.platformSetting.upsert({ where: { key: AI_PROVIDER_KEY }, create: { key: AI_PROVIDER_KEY, value: name }, update: { value: name } });
}

export const AI_PROVIDERS = PROVIDERS;
