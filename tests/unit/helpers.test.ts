import { describe, expect, it, vi } from "vitest";
import { buildPrompt } from "@/lib/ai/prompt";
import { templateSuggestions } from "@/lib/ai/templates";
import { guessType } from "@/lib/business-type";
import { cleanSuggestions, parseJsonArray } from "@/lib/ai/validate";
import { contrastWithWhite, readableBrandColor } from "@/lib/contrast";
import { normalizeIndianMobile } from "@/lib/customer-i18n";
import { decryptField, encryptField, keyedHash } from "@/lib/crypto";
import { isShortCode, newShortCode, slugify } from "@/lib/shortcode";

const profile = { businessName: "Kesar & Clove", branchName: "Indiranagar", cityArea: "Indiranagar, Bengaluru", type: "RESTAURANT" as const, category: "Restaurant", highlights: ["filter coffee", "paneer tikka"], tone: "Warm" };
const school = { businessName: "Bright Minds", branchName: "Jayanagar", cityArea: "Jayanagar, Bengaluru", type: "COACHING" as const, category: "NEET coaching", highlights: ["Experienced faculty", "Weekly tests"], tone: "Professional and caring" };
const FOOD_WORDS = /\b(food|tasty|dish|dishes|menu|meal|dining|paisa vasool|must-try|khaana|khana|waiter)\b|खाना|स्वाद/i;

describe("field encryption", () => {
  it("round-trips and uses a fresh IV each time", () => {
    const a = encryptField("9876543210");
    const b = encryptField("9876543210");
    expect(a).not.toBe(b);
    expect(a).not.toContain("9876543210");
    expect(decryptField(a)).toBe("9876543210");
  });
  it("rejects tampered ciphertext", () => {
    const a = encryptField("9876543210");
    const parts = a.split(".");
    parts[3] = Buffer.from("tampered").toString("base64url");
    expect(decryptField(parts.join("."))).toBeNull();
    expect(decryptField("garbage")).toBeNull();
  });
  it("hashes deterministically without exposing the input", () => {
    expect(keyedHash("1.2.3.4")).toBe(keyedHash("1.2.3.4"));
    expect(keyedHash("1.2.3.4")).not.toContain("1.2.3.4");
  });
});

describe("brand colours", () => {
  it("darkens pale colours until white text passes WCAG AA", () => {
    const r = readableBrandColor("#F5D547");
    expect(r.adjusted).toBe(true);
    expect(contrastWithWhite(r.color)).toBeGreaterThanOrEqual(4.5);
  });
  it("keeps colours that already pass", () => {
    expect(readableBrandColor("#0E6B63")).toMatchObject({ adjusted: false });
  });
  it("falls back on invalid input", () => {
    expect(readableBrandColor("red; background:url(x)").color).toMatch(/^#[0-9A-F]{6}$/);
  });
});

describe("short codes and slugs", () => {
  it("generates readable 6-character codes", () => {
    for (let i = 0; i < 200; i++) expect(isShortCode(newShortCode())).toBe(true);
    expect(isShortCode("ABC0O1")).toBe(false);
    expect(isShortCode("../etc")).toBe(false);
  });
  it("slugifies names", () => {
    expect(slugify("Kesar & Clove Indiranagar")).toBe("kesar-clove-indiranagar");
  });
});

describe("phone numbers", () => {
  it.each([
    ["98765 43210", "9876543210"],
    ["+91 98765-43210", "9876543210"],
    ["098765 43210", "9876543210"],
    ["12345", null],
    ["5876543210", null],
  ])("%s → %s", (input, out) => expect(normalizeIndianMobile(input)).toBe(out));
});

describe("AI suggestions", () => {
  it("parses JSON arrays from chatty replies", () => {
    expect(parseJsonArray('Sure!\n```json\n["a","b"]\n```')).toEqual(["a", "b"]);
    expect(parseJsonArray("no json")).toEqual([]);
  });
  it("drops unsafe or off-language output", () => {
    const good = "Loved the filter coffee and the friendly service here. Will come back soon!";
    const out = cleanSuggestions(
      [
        good,
        good, // duplicate
        "Visit https://evil.example for a discount on your next meal, amazing place!",
        "Call me on 9876543210 for more details about this lovely little place today",
        "Great <script>alert(1)</script> food and nice people all around the place",
        "Too short",
        "खाना बहुत अच्छा था और सेवा भी शानदार थी, ज़रूर आइए।", // Hindi in an English pool
        "{{staff}} was so helpful and the paneer tikka was perfectly cooked tonight.",
        "{{hack}} injected placeholder that should not survive the cleaner at all ok",
      ],
      "en",
      50,
    );
    expect(out).toEqual([good, "{{staff}} was so helpful and the paneer tikka was perfectly cooked tonight."]);
  });
  it("keeps Hindi only in Devanagari pools", () => {
    const hi = "केसर एंड क्लोव का खाना बहुत बढ़िया था, सेवा भी तेज़ थी। ज़रूर आएंगे।";
    expect(cleanSuggestions([hi], "hi", 5)).toEqual([hi]);
    expect(cleanSuggestions([hi], "hinglish", 5)).toEqual([]);
  });
  it("prompts contain only business settings", () => {
    const p = buildPrompt({ profile, language: "hinglish", ratingTier: 5, count: 60 });
    expect(p).toContain("Kesar & Clove");
    expect(p).toContain("filter coffee");
    expect(p).toContain("Roman");
    expect(p).toMatch(/JSON array/);
  });
  it("template fallback produces enough distinct suggestions", () => {
    for (const p of [profile, school, { ...school, type: "CLINIC" as const, highlights: [] }])
      for (const lang of ["en", "hi", "hinglish"] as const)
        for (const tier of [4, 5] as const) {
          const t = templateSuggestions(p, lang, tier, 50);
          expect(new Set(t).size).toBe(t.length);
          expect(t.length).toBeGreaterThanOrEqual(20);
          expect(t.every((x) => cleanSuggestions([x.replaceAll("{{staff}}", "Ravi")], lang, 1).length === 1 || lang === "hi")).toBe(true);
        }
  });
  it("schools, coaching and other businesses never get food wording", () => {
    for (const type of ["SCHOOL", "COACHING", "CLINIC", "SALON", "GYM", "RETAIL", "OTHER"] as const)
      for (const lang of ["en", "hi", "hinglish"] as const)
        for (const tier of [4, 5] as const)
          for (const text of templateSuggestions({ ...school, type, highlights: [] }, lang, tier, 50)) expect(text).not.toMatch(FOOD_WORDS);
  });
  it("education suggestions mix parent and student voices", () => {
    const t = templateSuggestions(school, "en", 5, 50);
    expect(t.filter((x) => /parent|our child|our son|my daughter|my child/i.test(x)).length).toBeGreaterThan(10);
    expect(t.filter((x) => /my studies|to study|learnt|my confidence|my classes/i.test(x)).length).toBeGreaterThan(10);
    expect(t.some((x) => x.includes("the experienced faculty"))).toBe(true);
  });
  it("prompts are worded for the business type", () => {
    const edu = buildPrompt({ profile: school, language: "en", ratingTier: 4, count: 60 });
    expect(edu).toContain("Coaching institute (NEET coaching)");
    expect(edu).toMatch(/parents and students/);
    expect(edu).toMatch(/Never mention food/);
    expect(edu).not.toMatch(/busy evening|Do not invent dishes/);
    expect(buildPrompt({ profile, language: "en", ratingTier: 4, count: 60 })).toMatch(/busy evening/);
  });
  it("guesses a business type from older free-text categories", () => {
    const cases: [string, string][] = [
      ["CBSE school", "SCHOOL"], ["Play school", "SCHOOL"], ["NEET coaching", "COACHING"], ["Sharma Tuition Classes", "COACHING"],
      ["Family restaurant", "RESTAURANT"], ["Bakery and café", "RESTAURANT"], ["Cafe", "RESTAURANT"], ["Coffee shop", "RESTAURANT"],
      ["Medical store", "RETAIL"], ["Jewellery showroom", "RETAIL"], ["Dental clinic", "CLINIC"], ["Multi-speciality hospital", "CLINIC"],
      ["Unisex salon", "SALON"], ["Barber shop", "RETAIL"], ["Gym", "GYM"], ["Yoga studio", "GYM"], ["Local business", "OTHER"],
    ];
    for (const [cat, type] of cases) expect([cat, guessType(cat)]).toEqual([cat, type]);
  });
});

describe("privacy contact", () => {
  it("shows SUPPORT_EMAIL only when it is a valid address", async () => {
    const { supportEmail } = await import("@/lib/env");
    vi.stubEnv("SUPPORT_EMAIL", " privacy@mygnps.com ");
    expect(supportEmail()).toBe("privacy@mygnps.com");
    vi.stubEnv("SUPPORT_EMAIL", "not an email");
    expect(supportEmail()).toBeUndefined();
    vi.stubEnv("SUPPORT_EMAIL", "");
    expect(supportEmail()).toBeUndefined();
    vi.unstubAllEnvs();
  });
});
