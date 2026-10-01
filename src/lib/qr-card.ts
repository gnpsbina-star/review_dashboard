/**
 * Printable QR card design, shared by the on-screen studio (rendered as React
 * SVG) and the downloads (serialised to a standalone SVG, then PNG/PDF in the
 * browser). One portrait layout in millimetres that scales to A6, A5 and A4,
 * which all share the same √2 shape.
 *
 * The QR itself is always black on a white panel so it scans in any light.
 */
import type { BusinessType } from "./business-type";

export type CardSize = "a6" | "a5" | "a4";
export const PAPER: Record<CardSize, { w: number; h: number; label: string; use: string }> = {
  a6: { w: 105, h: 148, label: "A6", use: "Table tent" },
  a5: { w: 148, h: 210, label: "A5", use: "Counter stand" },
  a4: { w: 210, h: 297, label: "A4", use: "Poster" },
};
export const CARD_SIZES = Object.keys(PAPER) as CardSize[];

export interface CardData {
  id: string;
  kind: "BRANCH" | "TABLE" | "STAFF";
  code: string;
  url: string;
  qr: { d: string; size: number };
  type: BusinessType;
  businessName: string;
  branchName: string;
  color: string; // already darkened for white text
  logoUrl: string | null;
  headline: { en: string; hi: string };
  label: string | null; // "Table 5"
  staff: { name: string; designation: string | null; photoUrl: string | null } | null;
}

export type Font = "display" | "deva";
export interface Node {
  tag: string;
  attrs?: Record<string, string | number>;
  children?: (Node | string)[];
  font?: Font;
}

const W = 105;
const H = 148.5;
const M = 8; // side margin
const INK = "#15201e";
const GOLD = "#FFC83D";

// Sora advance widths (per 1000 em) for ASCII 32–126, measured in Chromium.
const SORA_700 = [210,317,495,722,651,891,731,268,393,393,570,596,273,509,273,407,763,428,632,632,672,644,687,607,667,687,273,273,596,590,596,563,1127,782,692,800,781,594,560,833,800,332,643,752,558,971,876,864,667,864,730,667,618,776,740,1071,722,657,647,393,407,393,617,590,300,594,703,611,703,624,382,686,652,334,339,639,315,983,652,681,703,703,421,556,434,645,597,922,601,570,502,393,376,393,543];
const SORA_600 = [216,310,473,712,651,877,717,266,387,387,569,594,269,507,269,386,756,425,627,626,662,637,678,596,657,678,269,269,594,590,594,559,1126,773,688,799,785,596,560,832,801,326,642,728,553,954,867,865,658,865,720,674,610,780,729,1062,713,655,650,387,386,387,602,585,300,588,699,610,699,620,381,683,648,325,332,617,305,978,648,679,699,699,417,549,431,639,584,897,587,562,497,387,375,387,527];

/** Estimated text width in mm. Devanagari is measured generously, so it never overflows. */
export function textWidth(s: string, size: number, weight: 600 | 700 = 700): number {
  const table = weight === 700 ? SORA_700 : SORA_600;
  let units = 0;
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    if (c >= 32 && c < 127) units += table[c - 32];
    else if (c >= 0x0900 && c <= 0x097f) units += 480;
    else units += 640;
  }
  return (units / 1000) * size;
}

function wrap(text: string, size: number, max: number, weight: 600 | 700 = 700): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && textWidth(next, size, weight) > max) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function isDeva(s: string) {
  return /[ऀ-ॿ]/.test(s);
}

function text(x: number, y: number, size: number, content: string, o: { weight?: 600 | 700; fill?: string; anchor?: "start" | "middle" | "end"; max?: number; opacity?: number; spacing?: number } = {}): Node {
  const weight = o.weight ?? 700;
  const attrs: Record<string, string | number> = { x: r(x), y: r(y), "font-size": r(size), "font-weight": weight, fill: o.fill ?? "#fff" };
  if (o.anchor && o.anchor !== "start") attrs["text-anchor"] = o.anchor;
  if (o.opacity !== undefined) attrs["fill-opacity"] = o.opacity;
  if (o.spacing) attrs["letter-spacing"] = r(o.spacing);
  // Squeeze, never overflow: only kicks in for very long names.
  if (o.max && textWidth(content, size, weight) > o.max) {
    attrs.textLength = r(o.max);
    attrs.lengthAdjust = "spacingAndGlyphs";
  }
  return { tag: "text", attrs, font: isDeva(content) ? "deva" : "display", children: [content] };
}

const r = (n: number) => Math.round(n * 100) / 100;

/** Picks the largest headline size that fits the space above the QR panel. */
function fitHeadline(en: string, hi: string, max: number, room: number) {
  for (const size of [8.4, 7.6, 6.8, 6.1, 5.5, 5]) {
    const lines = wrap(en, size, max);
    if (lines.length > 3) continue;
    const hiSize = Math.min(4.3, size * 0.56);
    let hiLines = hi ? wrap(hi, hiSize, max, 600) : [];
    if (hiLines.length > 1) hiLines = [hi]; // one line, squeezed if needed
    const height = size * 0.78 + (lines.length - 1) * size * 1.1 + (hiLines.length ? 2.2 + hiSize : 0);
    if (height <= room) return { size, lines, hiSize, hiLines };
  }
  return { size: 5, lines: wrap(en, 5, max).slice(0, 3), hiSize: 3, hiLines: hi ? [hi] : [] };
}

function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.round(amount < 0 ? v * (1 + amount) : v + (255 - v) * amount);
  const [rr, gg, bb] = [ch((n >> 16) & 255), ch((n >> 8) & 255), ch(n & 255)];
  return `#${((1 << 24) | (rr << 16) | (gg << 8) | bb).toString(16).slice(1)}`;
}

function initials(name: string): string {
  return name.split(/\s+/).filter((w) => /^[\p{L}\p{N}]/u.test(w)).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "•";
}

// 24×24 icons (Material Design, Apache 2.0) for the category accent.
const ICONS: Record<BusinessType, string> = {
  SCHOOL: "M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3 1 9l11 6 9-4.91V17h2V9L12 3z",
  COACHING: "M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3 1 9l11 6 9-4.91V17h2V9L12 3z",
  CLINIC: "M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7z",
  SALON: "M9.64 7.64c.23-.5.36-1.05.36-1.64 0-2.21-1.79-4-4-4S2 3.79 2 6s1.79 4 4 4c.59 0 1.14-.13 1.64-.36L10 12l-2.36 2.36C7.14 14.13 6.59 14 6 14c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4c0-.59-.13-1.14-.36-1.64L12 14l7 7h3v-1L9.64 7.64zM6 8c-1.1 0-2-.89-2-2s.9-2 2-2 2 .89 2 2-.9 2-2 2zm0 12c-1.1 0-2-.89-2-2s.9-2 2-2 2 .89 2 2-.9 2-2 2zM19 3l-6 6 2 2 7-7V3z",
  GYM: "M20.57 14.86 22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29z",
  RESTAURANT: "M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z",
  RETAIL: "M18 6h-2c0-2.21-1.79-4-4-4S8 3.79 8 6H6c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6-2c1.1 0 2 .9 2 2h-4c0-1.1.9-2 2-2zm6 16H6V8h2v2c0 .55.45 1 1 1s1-.45 1-1V8h4v2c0 .55.45 1 1 1s1-.45 1-1V8h2v12z",
  OTHER: "M12 2.5l2.94 6.1 6.56.9-4.78 4.57 1.17 6.53L12 17.4l-5.89 3.2 1.17-6.53L2.5 9.5l6.56-.9z",
};
const STAR = "M12 2.5l2.94 6.1 6.56.9-4.78 4.57 1.17 6.53L12 17.4l-5.89 3.2 1.17-6.53L2.5 9.5l6.56-.9z";

function stars(cx: number, baseline: number, size: number, caption: string, captionSize: number): Node[] {
  const gap = size * 0.22;
  const starsW = 5 * size + 4 * gap;
  const capW = textWidth(caption, captionSize, 600);
  const total = starsW + size * 0.6 + capW;
  const x0 = cx - total / 2;
  const top = baseline - captionSize * 0.72 - (size - captionSize * 0.72) / 2;
  const out: Node[] = [];
  for (let i = 0; i < 5; i++) {
    out.push({ tag: "path", attrs: { d: STAR, fill: GOLD, transform: `translate(${r(x0 + i * (size + gap))} ${r(top)}) scale(${r(size / 24)})` } });
  }
  out.push(text(x0 + starsW + size * 0.6, baseline, captionSize, caption, { weight: 600, opacity: 0.92 }));
  return out;
}

/** The card as an SVG element tree (viewBox in millimetres). */
export function cardTree(c: CardData): Node {
  const id = (s: string) => `${s}-${c.code}`;
  const dark = shade(c.color, -0.35);
  const kids: Node[] = [];

  // Background: brand colour with soft shapes and the category icon as an accent.
  kids.push({ tag: "rect", attrs: { width: W, height: H, fill: c.color } });
  kids.push({ tag: "circle", attrs: { cx: 101, cy: 4, r: 36, fill: "#fff", "fill-opacity": 0.09 } });
  kids.push({ tag: "circle", attrs: { cx: 101, cy: 4, r: 24, fill: "#fff", "fill-opacity": 0.07 } });
  kids.push({ tag: "circle", attrs: { cx: -4, cy: 152, r: 40, fill: dark, "fill-opacity": 0.45 } });
  kids.push({ tag: "path", attrs: { d: ICONS[c.type], fill: "#fff", "fill-opacity": 0.2, transform: "translate(80.5 4.5) scale(0.82)" } });

  // Header: logo, business and branch.
  kids.push({ tag: "rect", attrs: { x: M, y: 8, width: 13, height: 13, rx: 3.2, fill: "#fff" } });
  if (c.logoUrl) {
    kids.push({ tag: "clipPath", attrs: { id: id("logo") }, children: [{ tag: "rect", attrs: { x: M + 0.9, y: 8.9, width: 11.2, height: 11.2, rx: 2.4 } }] });
    kids.push({ tag: "image", attrs: { href: c.logoUrl, x: M + 0.9, y: 8.9, width: 11.2, height: 11.2, preserveAspectRatio: "xMidYMid slice", "clip-path": `url(#${id("logo")})` } });
  } else {
    kids.push(text(M + 6.5, 16.3, 4.8, initials(c.businessName), { fill: c.color, anchor: "middle" }));
  }
  kids.push(text(M + 16.5, 13.6, 4.3, c.businessName, { max: 66 }));
  kids.push(text(M + 16.5, 19, 3, c.branchName, { weight: 600, opacity: 0.82, max: 66 }));

  // Headline and Hindi line.
  const head = fitHeadline(c.headline.en, c.headline.hi, W - 2 * M, 22.5);
  let y = 27 + head.size * 0.78;
  for (const line of head.lines) {
    kids.push(text(M, y, head.size, line, { max: W - 2 * M }));
    y += head.size * 1.1;
  }
  if (head.hiLines.length) kids.push(text(M, y - head.size * 1.1 + 2.2 + head.hiSize, head.hiSize, head.hiLines[0], { weight: 600, opacity: 0.9, max: W - 2 * M }));

  // QR on a white panel with a soft shadow.
  const px = 19, py = 51, pw = 67, ph = 71;
  kids.push({ tag: "rect", attrs: { x: px, y: py + 1.4, width: pw, height: ph, rx: 5.5, fill: "#000", "fill-opacity": 0.18 } });
  kids.push({ tag: "rect", attrs: { x: px, y: py, width: pw, height: ph, rx: 5.5, fill: "#fff" } });
  const qs = 55;
  kids.push({ tag: "path", attrs: { d: c.qr.d, fill: "#000", transform: `translate(${px + 6} ${py + 6}) scale(${r(qs / c.qr.size)})`, "shape-rendering": "crispEdges" } });
  kids.push(text(W / 2, py + ph - 3.6, 2.9, "Scan with your phone camera", { weight: 600, fill: c.color, anchor: "middle" }));

  // Footer: who or where this code is for, then the stars.
  if (c.kind === "STAFF" && c.staff) {
    const s = c.staff;
    const nameW = textWidth(s.name, 4.2);
    const desW = s.designation ? textWidth(s.designation, 3, 600) : 0;
    const pillW = Math.min(W - 2 * M, 4 + 11 + 3 + Math.max(nameW, desW) + 5);
    const x0 = (W - pillW) / 2;
    kids.push({ tag: "rect", attrs: { x: r(x0), y: 125.5, width: r(pillW), height: 12.5, rx: 6.25, fill: "#fff" } });
    const cx = x0 + 2 + 5.5, cy = 131.75;
    if (s.photoUrl) {
      kids.push({ tag: "clipPath", attrs: { id: id("photo") }, children: [{ tag: "circle", attrs: { cx: r(cx), cy, r: 5.2 } }] });
      kids.push({ tag: "image", attrs: { href: s.photoUrl, x: r(cx - 5.2), y: cy - 6.5, width: 10.4, height: 13, preserveAspectRatio: "xMidYMin slice", "clip-path": `url(#${id("photo")})` } });
    } else {
      kids.push({ tag: "circle", attrs: { cx: r(cx), cy, r: 5.2, fill: c.color } });
      kids.push(text(cx, cy + 1.45, 4, initials(s.name), { anchor: "middle" }));
    }
    const tx = x0 + 2 + 11 + 3;
    const tmax = pillW - (tx - x0) - 4;
    kids.push(text(tx, s.designation ? 130.9 : 133.3, 4.2, s.name, { fill: INK, max: tmax }));
    if (s.designation) kids.push(text(tx, 135.6, 3, s.designation, { weight: 600, fill: "#56645f", max: tmax }));
    kids.push(...stars(W / 2, 143.6, 3.4, "Takes 30 seconds", 2.8));
  } else if (c.kind === "TABLE" && c.label) {
    const label = c.label.toUpperCase();
    const lw = Math.min(W - 2 * M, textWidth(label, 4.4) + label.length * 0.35 + 12);
    kids.push({ tag: "rect", attrs: { x: r((W - lw) / 2), y: 126.5, width: r(lw), height: 9.5, rx: 4.75, fill: "#fff" } });
    kids.push(text(W / 2, 132.9, 4.4, label, { fill: c.color, anchor: "middle", spacing: 0.35 }));
    kids.push(...stars(W / 2, 143.4, 3.6, "Takes 30 seconds", 3));
  } else {
    kids.push(...stars(W / 2, 132.2, 4.6, "Takes 30 seconds · No app needed", 3.4));
    kids.push(text(W / 2, 139.6, 2.7, c.url.replace(/^https?:\/\//, ""), { weight: 600, opacity: 0.7, anchor: "middle" }));
  }

  return {
    tag: "svg",
    // geometricPrecision stops Chrome snapping glyphs when small cards are shown on screen.
    attrs: { xmlns: "http://www.w3.org/2000/svg", viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: "xMidYMid slice", "text-rendering": "geometricPrecision" },
    children: kids,
  };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export const CARD_FONT_FAMILY: Record<Font, string> = { display: "CardSora, CardDeva, sans-serif", deva: "CardDeva, CardSora, sans-serif" };

/**
 * Standalone SVG for downloads. `images` swaps image URLs for data URIs and
 * `fontCss` embeds the fonts, so the file looks the same anywhere.
 */
export function toSvgString(root: Node, o: { width: string; height: string; images?: Record<string, string>; fontCss?: string }): string {
  const render = (n: Node | string): string => {
    if (typeof n === "string") return esc(n);
    const attrs = { ...n.attrs };
    if (n.tag === "image" && typeof attrs.href === "string" && o.images?.[attrs.href]) attrs.href = o.images[attrs.href];
    if (n.font) attrs["font-family"] = CARD_FONT_FAMILY[n.font];
    if (n === root) Object.assign(attrs, { width: o.width, height: o.height });
    const a = Object.entries(attrs).map(([k, v]) => ` ${k}="${esc(String(v))}"`).join("");
    const inner = (n === root && o.fontCss ? `<style>${o.fontCss}</style>` : "") + (n.children ?? []).map(render).join("");
    return `<${n.tag}${a}>${inner}</${n.tag}>`;
  };
  return `<?xml version="1.0" encoding="UTF-8"?>\n${render(root)}\n`;
}
