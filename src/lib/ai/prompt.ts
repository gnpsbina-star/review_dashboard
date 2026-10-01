import { familyOf, TYPE_LABELS, type Family } from "@/lib/business-type";
import type { GenerateRequest } from "./types";

const LANGUAGE_RULES = {
  en: "Write in natural, simple Indian English.",
  hi: "Write in Hindi using Devanagari script only (no English letters except the business name).",
  hinglish: "Write in Hinglish: Hindi words written in Roman (English) letters, mixed with common English words, the way people text in India. Do not use Devanagari.",
} as const;

/** Who writes the reviews and what they talk about, per kind of business. */
const FAMILY_RULES: Record<Family, { voice: string; drawback: string; staff: string; avoid: string }> = {
  education: {
    voice:
      "Reviews come from a mix of parents and students: write about half as a parent (for example \"my son\", \"my daughter's teachers\") and half as a student (for example \"the faculty explains concepts clearly\", \"helped me prepare for my exams\"). Talk about teaching, teachers, learning, progress, results, discipline, care and facilities.",
    drawback: "one small, gentle drawback (like fees being a little high, or the rush at pickup time)",
    staff: "{{staff}} explains every concept very patiently",
    avoid: "Never mention food, dishes, taste, menus, meals, dining or waiters.",
  },
  food: {
    voice: "Reviews come from customers who ate or ordered here. Talk about the food, taste, service and ambience.",
    drawback: "one small, gentle drawback (like a short wait or a busy evening)",
    staff: "{{staff}} was very helpful",
    avoid: "Do not invent dishes or prices that are not listed.",
  },
  general: {
    voice: "Reviews come from customers who used this business. Talk about the service, the staff, the experience and value, as fits the category.",
    drawback: "one small, gentle drawback (like a short wait)",
    staff: "{{staff}} was very helpful",
    avoid: "Never mention food, dishes, taste or menus unless they appear in the highlights.",
  },
};

/** Builds the generation prompt. Only business settings go in; never customer data. */
export function buildPrompt(req: GenerateRequest): string {
  const p = req.profile;
  const family = FAMILY_RULES[familyOf(p.type)];
  const tierRule =
    req.ratingTier === 5
      ? "The customer gave 5 stars: sound delighted and enthusiastic, but believable."
      : `The customer gave 4 stars: sound happy and positive, and a few may mention ${family.drawback}.`;
  const highlights = p.highlights.length ? p.highlights.join(", ") : "good service";
  const category = p.category === TYPE_LABELS[p.type] ? p.category : `${TYPE_LABELS[p.type]} (${p.category})`;
  return [
    `You write short sample Google reviews that real customers can pick and edit before posting.`,
    `Business: ${p.businessName}, ${p.branchName} (${p.cityArea}). Type of business: ${category}. Brand tone: ${p.tone}.`,
    family.voice,
    `Things customers often like here: ${highlights}.`,
    tierRule,
    LANGUAGE_RULES[req.language],
    `Write ${req.count} different reviews. Each must be 1 to 3 sentences and 60 to 280 characters.`,
    `Vary the openings, length and which highlight is mentioned. Sound like different real people, not marketing copy.`,
    `About a quarter of them should thank the staff member using exactly the placeholder {{staff}} (for example "${family.staff}"). The others must not mention any staff name.`,
    `Do not invent facts, prices, products or services that are not listed. ${family.avoid} No hashtags, emojis, links, phone numbers or quotation marks.`,
    `Return only a JSON array of strings.`,
  ].join("\n");
}
