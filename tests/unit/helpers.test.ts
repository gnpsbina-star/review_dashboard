import { describe, expect, it, vi } from "vitest";
import { buildPrompt } from "@/lib/ai/prompt";
import { templateSuggestions } from "@/lib/ai/templates";
import { cleanSuggestions, parseJsonArray } from "@/lib/ai/validate";
import { contrastWithWhite, readableBrandColor } from "@/lib/contrast";
import { normalizeIndianMobile } from "@/lib/customer-i18n";
import { decryptField, encryptField, keyedHash } from "@/lib/crypto";
import { isShortCode, newShortCode, slugify } from "@/lib/shortcode";

const profile = { businessName: "Kesar & Clove", branchName: "Indiranagar", cityArea: "Indiranagar, Bengaluru", category: "Restaurant", highlights: ["filter coffee", "paneer tikka"], tone: "Warm" };

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
    for (const lang of ["en", "hi", "hinglish"] as const) {
      const t = templateSuggestions(profile, lang, 5, 50);
      expect(new Set(t).size).toBe(t.length);
      expect(t.length).toBeGreaterThanOrEqual(20);
    }
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
