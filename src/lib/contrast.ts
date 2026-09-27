/** Brand colour helpers, shared by server and client. */

export function isHexColor(v: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(v);
}

function channels(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

function luminance([r, g, b]: [number, number, number]): number {
  const f = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrastWithWhite(hex: string): number {
  return 1.05 / (luminance(channels(hex)) + 0.05);
}

/**
 * Darkens a brand colour until white text on it meets WCAG AA (4.5:1).
 * Clients can pick any colour; customers always get readable buttons.
 */
export function readableBrandColor(hex: string): { color: string; adjusted: boolean; ratio: number } {
  if (!isHexColor(hex)) hex = "#0E6B63";
  let rgb = channels(hex);
  let steps = 0;
  while (contrastWithWhite(toHex(rgb)) < 4.5 && steps < 60) {
    rgb = rgb.map((v) => Math.round(v * 0.94)) as [number, number, number];
    steps++;
  }
  const color = toHex(rgb);
  return { color, adjusted: steps > 0, ratio: contrastWithWhite(color) };
}

function toHex(rgb: [number, number, number]): string {
  return "#" + rgb.map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
}
