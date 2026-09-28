/**
 * Image maths for the staff photo "Auto-enhance". Pure functions (no DOM), so
 * they run in the browser and in tests. Nothing here changes facial features:
 * only framing, lighting/colour balance and the background.
 */

export const PORTRAIT_W = 600;
export const PORTRAIT_H = 750; // 4:5, passport style

export interface Box { x: number; y: number; w: number; h: number }

/**
 * Crop rectangle (in source pixels, 4:5) that frames the face like an ID photo:
 * face about 42% of the height, forehead/hair room above. May extend past the
 * image edges; the caller fills that with the background colour.
 */
export function portraitCrop(imgW: number, imgH: number, face?: Box | null): Box {
  const ratio = PORTRAIT_W / PORTRAIT_H;
  if (face && face.w > 0 && face.h > 0) {
    const h = face.h / 0.42;
    const w = h * ratio;
    return { x: face.x + face.w / 2 - w / 2, y: face.y - h * 0.3, w, h };
  }
  // No face found: the largest 4:5 area, centred, keeping the top (heads are usually near the top).
  if (imgW / imgH > ratio) {
    const w = imgH * ratio;
    return { x: (imgW - w) / 2, y: 0, w, h: imgH };
  }
  return { x: 0, y: 0, w: imgW, h: imgW / ratio };
}

export function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

function percentile(hist: Float64Array, total: number, p: number): number {
  let acc = 0;
  for (let i = 0; i < 256; i++) {
    acc += hist[i];
    if (acc >= total * p) return i;
  }
  return 255;
}

/**
 * Lighting fix: grey-world white balance (removes colour casts such as yellow
 * indoor light, with limited gains), then a brightness stretch on luminance and
 * a gentle lift for dark photos. Measured on the person only when a mask is given.
 */
export function buildLevels(rgba: Uint8ClampedArray, weights?: Float32Array | null): [Uint8Array, Uint8Array, Uint8Array] {
  const mean = [0, 0, 0];
  let total = 0;
  for (let i = 0, p = 0; i < rgba.length; i += 4, p++) {
    if (weights && weights[p] < 0.5) continue;
    mean[0] += rgba[i];
    mean[1] += rgba[i + 1];
    mean[2] += rgba[i + 2];
    total++;
  }
  if (total < 100) return [identity(), identity(), identity()];
  for (let c = 0; c < 3; c++) mean[c] = Math.max(1, mean[c] / total);
  const grey = (mean[0] + mean[1] + mean[2]) / 3;
  const gains = mean.map((m) => Math.min(1.35, Math.max(0.8, grey / m)));

  const hist = new Float64Array(256);
  for (let i = 0, p = 0; i < rgba.length; i += 4, p++) {
    if (weights && weights[p] < 0.5) continue;
    const y = 0.299 * rgba[i] * gains[0] + 0.587 * rgba[i + 1] * gains[1] + 0.114 * rgba[i + 2] * gains[2];
    hist[Math.min(255, Math.round(y))]++;
  }
  const lo = Math.min(percentile(hist, total, 0.01), 25);
  const hi = Math.max(percentile(hist, total, 0.99), 160, lo + 1); // at most ~1.6× brighter
  let m = 0;
  for (let i = 0; i < 256; i++) m += hist[i] * Math.min(1, Math.max(0, (i - lo) / (hi - lo)));
  const meanY = m / total;
  const gamma = meanY < 0.42 ? Math.min(1, Math.max(0.7, Math.log(0.5) / Math.log(Math.max(meanY, 0.01)))) : 1;

  return gains.map((g) => {
    const lut = new Uint8Array(256);
    for (let i = 0; i < 256; i++) lut[i] = Math.round(255 * Math.pow(Math.min(1, Math.max(0, (i * g - lo) / (hi - lo))), gamma));
    return lut;
  }) as [Uint8Array, Uint8Array, Uint8Array];
}

function identity(): Uint8Array {
  return Uint8Array.from({ length: 256 }, (_, i) => i);
}

export function applyLevels(rgba: Uint8ClampedArray, luts: [Uint8Array, Uint8Array, Uint8Array]) {
  for (let i = 0; i < rgba.length; i += 4) {
    rgba[i] = luts[0][rgba[i]];
    rgba[i + 1] = luts[1][rgba[i + 1]];
    rgba[i + 2] = luts[2][rgba[i + 2]];
  }
}

/** Replaces the background with a plain colour, feathering the edge of the person. */
export function replaceBackground(rgba: Uint8ClampedArray, confidence: Float32Array, bg: [number, number, number]) {
  for (let i = 0, p = 0; i < rgba.length; i += 4, p++) {
    const a = smoothstep(0.45, 0.8, confidence[p]); // tighter edge: less background fringe around hair
    rgba[i] = rgba[i] * a + bg[0] * (1 - a);
    rgba[i + 1] = rgba[i + 1] * a + bg[1] * (1 - a);
    rgba[i + 2] = rgba[i + 2] * a + bg[2] * (1 - a);
  }
}

/** Light unsharp mask (3×3), so print looks crisp without halos. */
export function sharpen(rgba: Uint8ClampedArray, w: number, h: number, amount = 0.35) {
  const src = new Uint8ClampedArray(rgba);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        const blur = (src[i - 4 + c] + src[i + 4 + c] + src[i - w * 4 + c] + src[i + w * 4 + c] + 4 * src[i + c]) / 8;
        rgba[i + c] = src[i + c] + amount * (src[i + c] - blur);
      }
    }
  }
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = /^#[0-9a-f]{6}$/i.test(hex) ? hex.slice(1) : "ffffff";
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}
