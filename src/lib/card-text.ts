import { familyOf, type BusinessType } from "./business-type";

/** Default QR card headline, in English with a Hindi line, for a business type. */
export function defaultHeadline(type: BusinessType): { en: string; hi: string } {
  if (familyOf(type) === "food") return { en: "Enjoyed your visit? Rate us!", hi: "हमें अपना अनुभव बताएं" };
  return { en: "How was your experience with us?", hi: "हमें अपना अनुभव बताएं" };
}

/** Personal headline for a staff member's own card. */
export function staffHeadline(type: BusinessType, name: string): { en: string; hi: string } {
  if (familyOf(type) === "education") return { en: `How was your class with ${name}?`, hi: `${name} के साथ आपकी क्लास कैसी रही?` };
  return { en: `How was your experience with ${name}?`, hi: `${name} के साथ आपका अनुभव कैसा रहा?` };
}
