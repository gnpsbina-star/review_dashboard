import { describe, expect, it } from "vitest";
import { applyLevels, buildLevels, hexToRgb, portraitCrop, replaceBackground, smoothstep } from "@/lib/portrait";

describe("portrait crop", () => {
  it("frames a detected face like an ID photo (4:5, face ~42% high, room above)", () => {
    const c = portraitCrop(2000, 1500, { x: 900, y: 400, w: 200, h: 252 });
    expect(c.w / c.h).toBeCloseTo(0.8, 5);
    expect(252 / c.h).toBeCloseTo(0.42, 5);
    expect(c.x + c.w / 2).toBeCloseTo(1000, 5); // centred on the face
    expect((400 - c.y) / c.h).toBeCloseTo(0.3, 5); // face starts 30% down
  });
  it("falls back to a centred 4:5 crop without a face", () => {
    expect(portraitCrop(1600, 1000, null)).toEqual({ x: 400, y: 0, w: 800, h: 1000 });
    expect(portraitCrop(800, 2000, null)).toEqual({ x: 0, y: 0, w: 800, h: 1000 });
  });
});

describe("lighting", () => {
  it("brightens a dark photo and corrects a yellow cast", () => {
    const px = new Uint8ClampedArray(4 * 400);
    for (let i = 0; i < 400; i++) {
      px.set([70 + (i % 40), 62 + (i % 40), 45 + (i % 20), 255], i * 4); // dark, warm indoor light
    }
    const stats = () => {
      let r = 0, g = 0, b = 0;
      for (let i = 0; i < px.length; i += 4) { r += px[i]; g += px[i + 1]; b += px[i + 2]; }
      return { mean: (r + g + b) / 3 / (px.length / 4), cast: (r - b) / (r + g + b) };
    };
    const before = stats();
    applyLevels(px, buildLevels(px));
    const after = stats();
    expect(after.mean).toBeGreaterThan(before.mean * 1.3); // brighter
    expect(after.cast).toBeLessThan(before.cast * 0.6); // yellow cast clearly reduced
  });
  it("limits correction on extreme colours so clothing colours aren't erased", () => {
    const px = new Uint8ClampedArray(4 * 400);
    for (let i = 0; i < 400; i++) px.set([200, 40, 40, 255], i * 4); // a bright red shirt
    applyLevels(px, buildLevels(px));
    expect(px[0]).toBeGreaterThan(px[1] * 2); // still clearly red
  });
  it("leaves a well-exposed photo almost unchanged", () => {
    const px = new Uint8ClampedArray(4 * 256);
    for (let i = 0; i < 256; i++) px.set([i, i, i, 255], i * 4);
    const copy = new Uint8ClampedArray(px);
    applyLevels(px, buildLevels(px));
    let diff = 0;
    for (let i = 0; i < px.length; i++) diff = Math.max(diff, Math.abs(px[i] - copy[i]));
    expect(diff).toBeLessThanOrEqual(8);
  });
});

describe("background", () => {
  it("keeps the person and replaces the rest", () => {
    const px = new Uint8ClampedArray([10, 20, 30, 255, 10, 20, 30, 255]);
    replaceBackground(px, new Float32Array([1, 0]), hexToRgb("#FFFFFF"));
    expect([...px.slice(0, 3)]).toEqual([10, 20, 30]);
    expect([...px.slice(4, 7)]).toEqual([255, 255, 255]);
  });
  it("smoothstep feathers between thresholds", () => {
    expect(smoothstep(0.3, 0.7, 0.2)).toBe(0);
    expect(smoothstep(0.3, 0.7, 0.9)).toBe(1);
    expect(smoothstep(0.3, 0.7, 0.5)).toBeCloseTo(0.5);
  });
});
