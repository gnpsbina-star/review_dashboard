/**
 * Business types drive the wording customers see: review suggestions, complaint
 * topics, the rating question and QR card text. Shared by server and browser code.
 */
export const BUSINESS_TYPES = ["SCHOOL", "COACHING", "CLINIC", "SALON", "GYM", "RESTAURANT", "RETAIL", "OTHER"] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];

/** Wording families. Types in one family share templates and complaint topics. */
export type Family = "education" | "food" | "general";

export const TYPE_LABELS: Record<BusinessType, string> = {
  SCHOOL: "School",
  COACHING: "Coaching institute",
  CLINIC: "Clinic / hospital",
  SALON: "Salon / spa",
  GYM: "Gym / fitness",
  RESTAURANT: "Restaurant / café",
  RETAIL: "Retail shop",
  OTHER: "Other",
};

export function familyOf(type: BusinessType): Family {
  if (type === "SCHOOL" || type === "COACHING") return "education";
  if (type === "RESTAURANT") return "food";
  return "general";
}

/** Example highlights shown as the placeholder on the branch form. */
export const HIGHLIGHT_EXAMPLES: Record<BusinessType, string> = {
  SCHOOL: "Caring teachers, Safe campus, Sports and activities, Smart classrooms",
  COACHING: "Experienced faculty, Regular tests, Doubt-clearing sessions, Study material",
  CLINIC: "Experienced doctors, Clean clinic, Short waiting time, Clear explanations",
  SALON: "Skilled stylists, Hygiene, Relaxing ambience, Value for money",
  GYM: "Expert trainers, Modern equipment, Clean changing rooms, Flexible timings",
  RESTAURANT: "Filter coffee, Paneer tikka, Polite staff, Fast service",
  RETAIL: "Wide range, Helpful staff, Fair prices, Easy returns",
  OTHER: "Helpful staff, Quick service, Fair prices, Friendly atmosphere",
};

// Checked in order, so "medical store" is retail and "coffee shop" is food.
const GUESSES: [BusinessType, RegExp][] = [
  ["SCHOOL", /\b(schools?|vidyalaya|vidyalay|vidyapeeth|vidya mandir|kindergarten|pre-?school|playschool|play school|montessori|college|university|gurukul|convent)\b/i],
  ["COACHING", /\b(coaching|tuitions?|tutors?|tutorials?|classes|academy|institute|iit|jee|neet|upsc|ias|ssc|ielts|education|learning|study cent(er|re))\b/i],
  ["RESTAURANT", /\b(restaurants?|caf[eé]s?|dhaba|bakery|bakers|food|kitchen|dining|diner|bistro|eatery|sweets?|mithai|pizza|pizzeria|biryani|bar|pub|brewery|tea|chai|coffee|juice|ice ?cream|caterers?|catering|canteen|mess|tiffin|thali|grill|lounge)\b/i],
  ["RETAIL", /\b(stores?|shops?|mart|supermarket|showroom|boutique|jewell?ers?|jewell?ery|retail|electronics|mobiles?|furniture|opticals?|garments?|textiles?|fashion|footwear|pharmacy|chemists?|medicals|hardware|stationery|bookstore|emporium)\b/i],
  ["CLINIC", /\b(clinics?|hospitals?|dental|dentists?|doctors?|diagnostics?|pathology|labs?|physio|physiotherapy|medical|nursing|healthcare|health care|ayurved\w*|homeopath\w*|eye care|derma\w*|maternity|ortho\w*|pediatric\w*|paediatric\w*|vet|veterinary)\b/i],
  ["SALON", /\b(salons?|spa|parlou?r|beauty|barbers?|hair|makeup|make-up|nails?|grooming|unisex|bridal)\b/i],
  ["GYM", /\b(gyms?|fitness|yoga|crossfit|zumba|pilates|martial arts|karate|boxing|health club|aerobics)\b/i],
];

/** Best guess from a free-text category, for businesses saved before types existed. */
export function guessType(category: string): BusinessType {
  for (const [type, re] of GUESSES) if (re.test(category)) return type;
  return "OTHER";
}

export function isBusinessType(v: unknown): v is BusinessType {
  return typeof v === "string" && (BUSINESS_TYPES as readonly string[]).includes(v);
}

/** The saved type, or a guess from the category text when none was saved yet. */
export function businessTypeOf(b: { type: BusinessType | null; category: string }): BusinessType {
  return b.type ?? guessType(b.category);
}
