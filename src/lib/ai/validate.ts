import type { Lang } from "./types";

const DEVANAGARI = /[ऀ-ॿ]/g;
const LATIN = /[A-Za-z]/g;
const FORBIDDEN = [/https?:\/\//i, /www\./i, /@/, /\d{6,}/, /#\w/, /<[^>]+>/, /\{\{(?!staff\}\})/];

export const MIN_LEN = 40;
export const MAX_LEN = 400;

/** Parses a model reply that should be a JSON array of strings (tolerates code fences and surrounding text). */
export function parseJsonArray(raw: string): string[] {
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start === -1 || end <= start) return [];
  try {
    const parsed: unknown = JSON.parse(raw.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Keeps only safe, on-language, well-formed suggestions. AI output is never trusted blindly. */
export function cleanSuggestions(candidates: string[], lang: Lang, max: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of candidates) {
    const text = c.replace(/\s+/g, " ").replace(/^["'“”]+|["'“”]+$/g, "").trim();
    if (text.length < MIN_LEN || text.length > MAX_LEN) continue;
    if (FORBIDDEN.some((re) => re.test(text))) continue;
    const withoutPlaceholder = text.replace(/\{\{staff\}\}/g, "");
    const deva = (withoutPlaceholder.match(DEVANAGARI) ?? []).length;
    const latin = (withoutPlaceholder.match(LATIN) ?? []).length;
    if (lang === "hi" && deva < latin * 2) continue;
    if (lang !== "hi" && deva > 0) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length >= max) break;
  }
  return out;
}
