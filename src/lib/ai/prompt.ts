import type { GenerateRequest } from "./types";

const LANGUAGE_RULES = {
  en: "Write in natural, simple Indian English.",
  hi: "Write in Hindi using Devanagari script only (no English letters except the business name).",
  hinglish: "Write in Hinglish: Hindi words written in Roman (English) letters, mixed with common English words, the way people text in India. Do not use Devanagari.",
} as const;

/** Builds the generation prompt. Only business settings go in; never customer data. */
export function buildPrompt(req: GenerateRequest): string {
  const p = req.profile;
  const tierRule =
    req.ratingTier === 5
      ? "The customer gave 5 stars: sound delighted and enthusiastic, but believable."
      : "The customer gave 4 stars: sound happy and positive, and a few may mention one small, gentle drawback (like a short wait or a busy evening).";
  const highlights = p.highlights.length ? p.highlights.join(", ") : "good service";
  return [
    `You write short sample Google reviews that real customers can pick and edit before posting.`,
    `Business: ${p.businessName}, ${p.branchName} (${p.cityArea}). Category: ${p.category}. Brand tone: ${p.tone}.`,
    `Things customers often like here: ${highlights}.`,
    tierRule,
    LANGUAGE_RULES[req.language],
    `Write ${req.count} different reviews. Each must be 1 to 3 sentences and 60 to 280 characters.`,
    `Vary the openings, length and which highlight is mentioned. Sound like different real people, not marketing copy.`,
    `About a quarter of them should thank the staff member using exactly the placeholder {{staff}} (for example "{{staff}} was very helpful"). The others must not mention any staff name.`,
    `Do not invent facts, prices, dishes or services that are not listed. No hashtags, emojis, links, phone numbers or quotation marks.`,
    `Return only a JSON array of strings.`,
  ].join("\n");
}
