import type { BranchProfile, Lang } from "./types";

/**
 * Offline suggestion generator. Used in development, in tests, and as a safety
 * net when the AI provider is unavailable, so customers always see suggestions.
 */
const EN = {
  5: {
    open: ["Absolutely loved my visit to {biz}.", "Wonderful experience at {biz}, {branch}.", "One of the best places in {area}.", "Had a fantastic time at {biz} today.", "Really impressed with {biz}."],
    mid: ["The {h} was excellent.", "Loved the {h}.", "The {h} really stood out.", "Special mention for the {h}."],
    staff: ["{{staff}} took great care of us.", "Thanks to {{staff}} for the warm service."],
    close: ["Will definitely come back!", "Highly recommended.", "Can't wait to visit again.", "Five stars from me."],
  },
  4: {
    open: ["Good experience at {biz}, {branch}.", "Nice visit to {biz} today.", "Pleasant time at {biz} in {area}.", "Really liked {biz}."],
    mid: ["The {h} was very good.", "Enjoyed the {h}.", "The {h} was the highlight for me."],
    staff: ["{{staff}} was friendly and helpful.", "{{staff}} looked after us well."],
    close: ["It was a little busy, but worth it.", "Would visit again.", "Recommended.", "Overall a good experience."],
  },
};
const HINGLISH = {
  5: {
    open: ["{biz} ka experience ekdum mast tha!", "{branch} wala {biz} best hai.", "Aaj {biz} mein bahut maza aaya.", "{area} mein isse accha option nahi milega."],
    mid: ["{h} toh must-try hai.", "{h} bahut badhiya tha.", "{h} ne dil khush kar diya."],
    staff: ["{{staff}} ki service bahut friendly thi.", "{{staff}} ne bahut acche se dhyan rakha."],
    close: ["Zaroor dobara aayenge!", "Highly recommend karta hoon.", "Full paisa vasool!"],
  },
  4: {
    open: ["{biz} mein accha experience raha.", "{branch} wala {biz} kaafi accha hai.", "Aaj {biz} gaye, accha laga."],
    mid: ["{h} accha tha.", "{h} kaafi tasty tha.", "{h} pasand aaya."],
    staff: ["{{staff}} kaafi helpful the.", "{{staff}} ki service achhi thi."],
    close: ["Thoda rush tha, par overall accha.", "Phir se aayenge.", "Recommended."],
  },
};
const HI = {
  5: {
    open: ["{biz} में आज का अनुभव शानदार रहा।", "{area} में {biz} सबसे बढ़िया जगह है।", "{biz} आकर बहुत अच्छा लगा।"],
    mid: ["{h} बहुत बढ़िया था।", "{h} ज़रूर आज़माएं।", "{h} का कोई जवाब नहीं।"],
    staff: ["{{staff}} ने बहुत अच्छी सेवा की।", "{{staff}} का व्यवहार बहुत विनम्र था।"],
    close: ["ज़रूर दोबारा आएंगे!", "सबको सलाह दूंगा।", "पूरे पांच स्टार।"],
  },
  4: {
    open: ["{biz} में अच्छा अनुभव रहा।", "{biz} आकर अच्छा लगा।", "{area} में यह अच्छी जगह है।"],
    mid: ["{h} अच्छा था।", "{h} पसंद आया।", "{h} काफ़ी अच्छा लगा।"],
    staff: ["{{staff}} काफ़ी मददगार थे।", "{{staff}} की सेवा अच्छी थी।"],
    close: ["थोड़ी भीड़ थी, पर कुल मिलाकर अच्छा।", "फिर आएंगे।", "ज़रूर जाएं।"],
  },
};

const BANKS = { en: EN, hinglish: HINGLISH, hi: HI } as const;

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function fill(t: string, p: BranchProfile, h: string): string {
  return t.replaceAll("{biz}", p.businessName).replaceAll("{branch}", p.branchName).replaceAll("{area}", p.cityArea).replaceAll("{h}", h);
}

export function templateSuggestions(p: BranchProfile, lang: Lang, tier: 4 | 5, count: number): string[] {
  const bank = BANKS[lang][tier];
  const highlights = p.highlights.length ? p.highlights : lang === "hi" ? ["सेवा"] : ["service"];
  // Every combination of opening, highlight line, optional staff thanks and closing, in a spread-out order.
  const combos: string[] = [];
  for (const [oi, open] of bank.open.entries())
    for (const [mi, mid] of bank.mid.entries())
      for (const [hi, h] of highlights.entries())
        for (const [ci, close] of bank.close.entries()) {
          const withStaff = (oi + mi + hi + ci) % 4 === 3;
          const parts = [open, mid, ...(withStaff ? [bank.staff[(oi + ci) % bank.staff.length]] : []), close];
          combos.push(parts.map((part) => capitalize(fill(part, p, h))).join(" "));
        }
  const out: string[] = [];
  const step = 7; // co-prime with typical sizes, so neighbours differ in several parts
  for (let i = 0, j = 0; i < combos.length && out.length < count; i++, j = (j + step) % combos.length) {
    let k = j;
    while (out.includes(combos[k])) k = (k + 1) % combos.length;
    out.push(combos[k]);
  }
  return out;
}
