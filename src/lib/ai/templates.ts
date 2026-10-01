import { familyOf, type Family } from "@/lib/business-type";
import type { BranchProfile, Lang } from "./types";

/**
 * Offline suggestion generator. Used in development, in tests, as a safety net
 * when the AI provider is unavailable, and while a branch's pool is being
 * rewritten, so customers always see suggestions worded for the business type.
 */
type Voice = { open: string[]; mid: string[]; staff: string[]; close: string[] };
type Bank = { 4: Voice[]; 5: Voice[] };

// ---------- Schools and coaching: half parents, half students ----------
const EDU_EN: Bank = {
  5: [
    {
      open: ["Very happy that we chose {biz} for our child.", "My daughter studies at {biz}, {branch} and we are very happy.", "As a parent, I am really satisfied with {biz}.", "Joining {biz} in {area} was the best decision for our son.", "{biz} has made a real difference for my child."],
      mid: ["The {h} stood out for us.", "We especially appreciate the {h}.", "Special mention for the {h}.", "The {h} made a big difference."],
      staff: ["{{staff}} is very patient and caring with the children.", "Thanks to {{staff}} for the personal attention."],
      close: ["Highly recommended for every parent.", "We are glad we chose them.", "Thank you to the whole team!", "Five stars from our family."],
    },
    {
      open: ["Joining {biz} was the best decision for my studies.", "Really enjoying my classes at {biz}, {branch}.", "{biz} is one of the best places to study in {area}.", "Learnt so much at {biz}.", "My confidence has grown a lot since joining {biz}."],
      mid: ["The {h} really helped me.", "Loved the {h}.", "The {h} made studying much easier.", "Special mention for the {h}."],
      staff: ["{{staff}} explains every concept so clearly.", "Thank you {{staff}} for clearing all my doubts."],
      close: ["Highly recommended to every student.", "Five stars from me!", "Grateful to all the teachers.", "Would recommend it to all my friends."],
    },
  ],
  4: [
    {
      open: ["Good experience with {biz} so far.", "We are happy with {biz}, {branch}.", "{biz} is a good choice in {area}.", "Our child is doing well at {biz}."],
      mid: ["We really value the {h}.", "We liked the {h}.", "The {h} helped a lot."],
      staff: ["{{staff}} keeps us well informed.", "{{staff}} is supportive and approachable."],
      close: ["Fees are a little high, but worth it.", "Pickup time gets a bit crowded, but overall good.", "Recommended.", "Overall a good experience."],
    },
    {
      open: ["Good place to study at {biz}.", "Classes at {biz}, {branch} are quite good.", "Nice learning experience at {biz}.", "Happy with my time at {biz} in {area}."],
      mid: ["The {h} helped me a lot.", "Liked the {h}.", "Found the {h} really useful."],
      staff: ["{{staff}} is helpful whenever I have doubts.", "{{staff}} teaches really well."],
      close: ["Batches can be a bit crowded, but worth it.", "Would recommend.", "Overall a good experience.", "Recommended for serious students."],
    },
  ],
};
const EDU_HINGLISH: Bank = {
  5: [
    {
      open: ["{biz} choose karna hamare bachche ke liye best decision tha.", "Meri beti {branch} wale {biz} mein padhti hai, hum bahut khush hain.", "Parent ke taur par {biz} se poori tarah satisfied hain.", "{area} mein {biz} sabse accha option hai."],
      mid: ["{h} se bahut farak pada.", "{h} ki khaas tareef banti hai.", "{h} ekdum top class hai."],
      staff: ["{{staff}} bachchon ka bahut dhyan rakhte hain.", "{{staff}} ka personal attention bahut accha hai."],
      close: ["Sabhi parents ko recommend karenge.", "Poori team ko thank you!", "Hamari family ki taraf se five stars."],
    },
    {
      open: ["{biz} join karna meri padhai ke liye best decision tha.", "{branch} wale {biz} mein padhai ka maza aa raha hai.", "{area} mein padhai ke liye {biz} best hai.", "{biz} mein bahut kuch seekhne ko mila."],
      mid: ["{h} se bahut help mili.", "{h} ekdum top class hai.", "{h} ki wajah se padhai easy ho gayi."],
      staff: ["{{staff}} har concept bahut clearly samjhate hain.", "{{staff}} ne mere saare doubts clear kiye."],
      close: ["Har student ke liye recommended.", "Five stars!", "Sabhi teachers ko dil se thank you."],
    },
  ],
  4: [
    {
      open: ["{biz} ka experience ab tak accha raha.", "{branch} wale {biz} se hum khush hain.", "{area} mein {biz} ek accha option hai."],
      mid: ["{h} ek bada plus point hai.", "{h} se kaafi fayda hua.", "{h} se hum khush hain."],
      staff: ["{{staff}} hamein hamesha update rakhte hain.", "{{staff}} kaafi supportive hain."],
      close: ["Fees thodi zyada hai, par worth it.", "Overall accha experience.", "Recommended."],
    },
    {
      open: ["{biz} padhai ke liye acchi jagah hai.", "{branch} wale {biz} ki classes kaafi acchi hain.", "{biz} mein accha learning experience raha."],
      mid: ["{h} se kaafi help mili.", "{h} ek bada plus point hai.", "{h} kaafi useful hai."],
      staff: ["{{staff}} doubts mein hamesha help karte hain.", "{{staff}} bahut accha padhate hain."],
      close: ["Batch thoda bada hai, par worth it.", "Overall accha experience.", "Recommended."],
    },
  ],
};
const EDU_HI: Bank = {
  5: [
    {
      open: ["{biz} चुनना हमारे बच्चे के लिए सबसे अच्छा फ़ैसला रहा।", "अभिभावक के रूप में हम {biz} से पूरी तरह संतुष्ट हैं।", "{area} में {biz} सबसे अच्छा विकल्प है।"],
      mid: ["{h} से बहुत फ़र्क पड़ा।", "{h} की ख़ास तारीफ़ करनी होगी।", "{h} सच में बेहतरीन है।"],
      staff: ["{{staff}} बच्चों का बहुत ध्यान रखते हैं।", "{{staff}} का व्यक्तिगत ध्यान सराहनीय है।"],
      close: ["सभी अभिभावकों को इसकी सलाह देंगे।", "पूरी टीम का धन्यवाद!", "हमारे परिवार की ओर से पूरे पांच स्टार।"],
    },
    {
      open: ["{biz} से जुड़ना मेरी पढ़ाई के लिए सबसे अच्छा फ़ैसला था।", "{area} में पढ़ाई के लिए {biz} सबसे अच्छी जगह है।", "{biz} में बहुत कुछ सीखने को मिला।"],
      mid: ["{h} से बहुत मदद मिली।", "{h} सच में बेहतरीन है।", "{h} की वजह से पढ़ाई आसान हो गई।"],
      staff: ["{{staff}} हर बात बहुत अच्छे से समझाते हैं।", "{{staff}} ने मेरे सारे डाउट दूर किए।"],
      close: ["हर विद्यार्थी के लिए बढ़िया जगह।", "पूरे पांच स्टार!", "सभी शिक्षकों का दिल से धन्यवाद।"],
    },
  ],
  4: [
    {
      open: ["{biz} के साथ अब तक का अनुभव अच्छा रहा।", "{area} में {biz} एक अच्छा विकल्प है।", "हम {biz} से संतुष्ट हैं।"],
      mid: ["{h} एक बड़ी ख़ूबी है।", "{h} से काफ़ी फ़ायदा हुआ।", "{h} से हम ख़ुश हैं।"],
      staff: ["{{staff}} हमेशा जानकारी देते रहते हैं।", "{{staff}} काफ़ी मददगार हैं।"],
      close: ["फ़ीस थोड़ी ज़्यादा है, पर कुल मिलाकर अच्छा।", "कुल मिलाकर अच्छा अनुभव।", "ज़रूर विचार करें।"],
    },
    {
      open: ["{biz} पढ़ाई के लिए अच्छी जगह है।", "{biz} की क्लास काफ़ी अच्छी हैं।", "{biz} में सीखने का अनुभव अच्छा रहा।"],
      mid: ["{h} से काफ़ी मदद मिली।", "{h} एक बड़ी ख़ूबी है।", "{h} बहुत उपयोगी है।"],
      staff: ["{{staff}} डाउट में हमेशा मदद करते हैं।", "{{staff}} बहुत अच्छा पढ़ाते हैं।"],
      close: ["बैच थोड़ा बड़ा है, पर ठीक है।", "कुल मिलाकर अच्छा अनुभव।", "ज़रूर विचार करें।"],
    },
  ],
};

// ---------- Restaurants and cafés ----------
const FOOD_EN: Bank = {
  5: [{
    open: ["Absolutely loved my visit to {biz}.", "Wonderful experience at {biz}, {branch}.", "One of the best places in {area}.", "Had a fantastic time at {biz} today.", "Really impressed with {biz}."],
    mid: ["The {h} was excellent.", "Loved the {h}.", "The {h} really stood out.", "Special mention for the {h}."],
    staff: ["{{staff}} took great care of us.", "Thanks to {{staff}} for the warm service."],
    close: ["Will definitely come back!", "Highly recommended.", "Can't wait to visit again.", "Five stars from me."],
  }],
  4: [{
    open: ["Good experience at {biz}, {branch}.", "Nice visit to {biz} today.", "Pleasant time at {biz} in {area}.", "Really liked {biz}."],
    mid: ["The {h} was very good.", "Enjoyed the {h}.", "The {h} was the highlight for me."],
    staff: ["{{staff}} was friendly and helpful.", "{{staff}} looked after us well."],
    close: ["It was a little busy, but worth it.", "Would visit again.", "Recommended.", "Overall a good experience."],
  }],
};
const FOOD_HINGLISH: Bank = {
  5: [{
    open: ["{biz} ka experience ekdum mast tha!", "{branch} wala {biz} best hai.", "Aaj {biz} mein bahut maza aaya.", "{area} mein isse accha option nahi milega."],
    mid: ["{h} toh must-try hai.", "{h} bahut badhiya tha.", "{h} ne dil khush kar diya."],
    staff: ["{{staff}} ki service bahut friendly thi.", "{{staff}} ne bahut acche se dhyan rakha."],
    close: ["Zaroor dobara aayenge!", "Highly recommend karta hoon.", "Full paisa vasool!"],
  }],
  4: [{
    open: ["{biz} mein accha experience raha.", "{branch} wala {biz} kaafi accha hai.", "Aaj {biz} gaye, accha laga."],
    mid: ["{h} accha tha.", "{h} kaafi tasty tha.", "{h} pasand aaya."],
    staff: ["{{staff}} kaafi helpful the.", "{{staff}} ki service achhi thi."],
    close: ["Thoda rush tha, par overall accha.", "Phir se aayenge.", "Recommended."],
  }],
};
const FOOD_HI: Bank = {
  5: [{
    open: ["{biz} में आज का अनुभव शानदार रहा।", "{area} में {biz} सबसे बढ़िया जगह है।", "{biz} आकर बहुत अच्छा लगा।"],
    mid: ["{h} बहुत बढ़िया था।", "{h} ज़रूर आज़माएं।", "{h} का कोई जवाब नहीं।"],
    staff: ["{{staff}} ने बहुत अच्छी सेवा की।", "{{staff}} का व्यवहार बहुत विनम्र था।"],
    close: ["ज़रूर दोबारा आएंगे!", "सबको सलाह दूंगा।", "पूरे पांच स्टार।"],
  }],
  4: [{
    open: ["{biz} में अच्छा अनुभव रहा।", "{biz} आकर अच्छा लगा।", "{area} में यह अच्छी जगह है।"],
    mid: ["{h} अच्छा था।", "{h} पसंद आया।", "{h} काफ़ी अच्छा लगा।"],
    staff: ["{{staff}} काफ़ी मददगार थे।", "{{staff}} की सेवा अच्छी थी।"],
    close: ["थोड़ी भीड़ थी, पर कुल मिलाकर अच्छा।", "फिर आएंगे।", "ज़रूर जाएं।"],
  }],
};

// ---------- Everything else: neutral wording, nothing about food ----------
const GEN_EN: Bank = {
  5: [{
    open: ["Absolutely loved my experience at {biz}.", "Wonderful experience at {biz}, {branch}.", "One of the best places in {area}.", "Really impressed with {biz}.", "Had a great experience at {biz} today."],
    mid: ["The {h} stood out.", "Loved the {h}.", "Special mention for the {h}.", "Really impressed by the {h}."],
    staff: ["{{staff}} took great care of me.", "Thanks to {{staff}} for the excellent service."],
    close: ["Highly recommended.", "Will definitely come back!", "Five stars from me.", "Very happy overall."],
  }],
  4: [{
    open: ["Good experience at {biz}, {branch}.", "Nice experience at {biz} today.", "Pleasant experience at {biz} in {area}.", "Really liked {biz}."],
    mid: ["Liked the {h}.", "The {h} was the highlight for me.", "Happy with the {h}."],
    staff: ["{{staff}} was friendly and helpful.", "{{staff}} looked after me well."],
    close: ["Had to wait a little, but worth it.", "Would visit again.", "Recommended.", "Overall a good experience."],
  }],
};
const GEN_HINGLISH: Bank = {
  5: [{
    open: ["{biz} ka experience ekdum mast tha!", "{branch} wala {biz} best hai.", "{area} mein isse accha option nahi milega.", "{biz} se bahut khush hoon."],
    mid: ["{h} ekdum top class hai.", "{h} ki khaas tareef banti hai.", "{h} se dil khush ho gaya."],
    staff: ["{{staff}} ki service bahut friendly thi.", "{{staff}} ne bahut acche se dhyan rakha."],
    close: ["Zaroor dobara aayenge!", "Highly recommended.", "Dil se recommend!"],
  }],
  4: [{
    open: ["{biz} mein accha experience raha.", "{branch} wala {biz} kaafi accha hai.", "{area} mein {biz} accha option hai."],
    mid: ["{h} ek plus point hai.", "{h} se khush hoon.", "{h} kaafi accha laga."],
    staff: ["{{staff}} kaafi helpful the.", "{{staff}} ki service achhi thi."],
    close: ["Thoda wait karna pada, par overall accha.", "Phir se aayenge.", "Recommended."],
  }],
};
const GEN_HI: Bank = {
  5: [{
    open: ["{biz} में आज का अनुभव शानदार रहा।", "{area} में {biz} सबसे बढ़िया जगह है।", "{biz} से बहुत ख़ुश हूं।"],
    mid: ["{h} की ख़ास तारीफ़ करनी होगी।", "{h} सच में बेहतरीन है।", "{h} का कोई जवाब नहीं।"],
    staff: ["{{staff}} ने बहुत अच्छी सेवा की।", "{{staff}} का व्यवहार बहुत विनम्र था।"],
    close: ["ज़रूर दोबारा आएंगे!", "सबको सलाह दूंगा।", "पूरे पांच स्टार।"],
  }],
  4: [{
    open: ["{biz} में अच्छा अनुभव रहा।", "{biz} आकर अच्छा लगा।", "{area} में यह अच्छी जगह है।"],
    mid: ["{h} से संतुष्ट हूं।", "{h} एक बड़ी ख़ूबी है।", "{h} काफ़ी अच्छा लगा।"],
    staff: ["{{staff}} काफ़ी मददगार थे।", "{{staff}} की सेवा अच्छी थी।"],
    close: ["थोड़ा इंतज़ार करना पड़ा, पर कुल मिलाकर अच्छा।", "फिर आएंगे।", "ज़रूर जाएं।"],
  }],
};

const BANKS: Record<Family, Record<Lang, Bank>> = {
  education: { en: EDU_EN, hinglish: EDU_HINGLISH, hi: EDU_HI },
  food: { en: FOOD_EN, hinglish: FOOD_HINGLISH, hi: FOOD_HI },
  general: { en: GEN_EN, hinglish: GEN_HINGLISH, hi: GEN_HI },
};

/** Used for {h} when the branch has no highlights. */
const DEFAULT_HIGHLIGHT: Record<Family, { latin: string; hi: string }> = {
  education: { latin: "teaching", hi: "पढ़ाई" },
  food: { latin: "service", hi: "सेवा" },
  general: { latin: "service", hi: "सेवा" },
};

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "Experienced faculty" reads as "the experienced faculty" mid-sentence; "CBSE board" keeps its capitals. */
function inSentence(h: string): string {
  return /^[A-Z][a-z]/.test(h) ? h.charAt(0).toLowerCase() + h.slice(1) : h;
}

function fill(t: string, p: BranchProfile, h: string): string {
  const hh = t.startsWith("{h}") ? h : inSentence(h);
  return t.replaceAll("{biz}", p.businessName).replaceAll("{branch}", p.branchName).replaceAll("{area}", p.cityArea).replaceAll("{h}", hh);
}

function combos(voice: Voice, p: BranchProfile, highlights: string[]): string[] {
  // Every combination of opening, highlight line, optional staff thanks and closing.
  const out: string[] = [];
  for (const [oi, open] of voice.open.entries())
    for (const [mi, mid] of voice.mid.entries())
      for (const [hi, h] of highlights.entries())
        for (const [ci, close] of voice.close.entries()) {
          const withStaff = (oi + mi + hi + ci) % 4 === 3;
          const parts = [open, mid, ...(withStaff ? [voice.staff[(oi + ci) % voice.staff.length]] : []), close];
          out.push(parts.map((part) => capitalize(fill(part, p, h))).join(" "));
        }
  return out;
}

/** Picks a spread-out sample so neighbours differ in several parts. */
function spread(list: string[], count: number): string[] {
  const out: string[] = [];
  const step = 7; // co-prime with typical sizes
  for (let i = 0, j = 0; i < list.length && out.length < count; i++, j = (j + step) % list.length) {
    let k = j;
    while (out.includes(list[k])) k = (k + 1) % list.length;
    out.push(list[k]);
  }
  return out;
}

export function templateSuggestions(p: BranchProfile, lang: Lang, tier: 4 | 5, count: number): string[] {
  const family = familyOf(p.type);
  const voices = BANKS[family][lang][tier];
  const fallback = DEFAULT_HIGHLIGHT[family];
  const highlights = p.highlights.length ? p.highlights : [lang === "hi" ? fallback.hi : fallback.latin];
  // Alternate voices (parent, student, parent…) so the list is a mix.
  const perVoice = voices.map((v) => spread(combos(v, p, highlights), Math.ceil(count / voices.length) + 5));
  const out: string[] = [];
  for (let i = 0; out.length < count && perVoice.some((l) => i < l.length); i++)
    for (const list of perVoice) if (i < list.length && out.length < count && !out.includes(list[i])) out.push(list[i]);
  return out;
}
