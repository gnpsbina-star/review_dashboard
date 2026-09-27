"use client";

import type { FaceDetector, ImageSegmenter } from "@mediapipe/tasks-vision";
import { applyLevels, buildLevels, hexToRgb, PORTRAIT_H, PORTRAIT_W, portraitCrop, replaceBackground, sharpen } from "@/lib/portrait";

/**
 * Staff photo "Auto-enhance", entirely in the browser: the photo never leaves
 * this device until the owner saves it. Uses Google's free on-device MediaPipe
 * models (face detection + person segmentation), served from our own domain.
 */
export type Background = "white" | "grey" | "brand" | "original";
export interface EnhanceOptions { background: Background; brandColor: string; fixLighting: boolean }
export interface EnhanceResult { blob: Blob; faceFound: boolean; backgroundReplaced: boolean; modelsAvailable: boolean }

let vision: Promise<{ face: FaceDetector; segmenter: ImageSegmenter } | null> | null = null;

function loadVision() {
  vision ??= (async () => {
    try {
      const { FilesetResolver, FaceDetector, ImageSegmenter } = await import("@mediapipe/tasks-vision");
      const files = await FilesetResolver.forVisionTasks("/mediapipe");
      const [face, segmenter] = await Promise.all([
        FaceDetector.createFromOptions(files, { baseOptions: { modelAssetPath: "/models/blaze_face_short_range.tflite", delegate: "CPU" }, runningMode: "IMAGE", minDetectionConfidence: 0.5 }),
        ImageSegmenter.createFromOptions(files, { baseOptions: { modelAssetPath: "/models/selfie_segmenter.tflite", delegate: "CPU" }, runningMode: "IMAGE", outputConfidenceMasks: true, outputCategoryMask: false }),
      ]);
      return { face, segmenter };
    } catch (e) {
      console.warn("Photo enhancement models unavailable", e);
      return null;
    }
  })();
  return vision;
}

const BG: Record<Exclude<Background, "original" | "brand">, string> = { white: "#FFFFFF", grey: "#E9ECEB" };

export async function enhancePhoto(file: File | Blob, opts: EnhanceOptions): Promise<EnhanceResult> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  // Work on a copy no larger than 1600px for speed.
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const work = document.createElement("canvas");
  work.width = Math.round(bitmap.width * scale);
  work.height = Math.round(bitmap.height * scale);
  work.getContext("2d")!.drawImage(bitmap, 0, 0, work.width, work.height);
  bitmap.close();

  const models = await loadVision();
  let faceBox = null;
  if (models) {
    const faces = models.face.detect(work).detections.map((d) => d.boundingBox).filter((b): b is NonNullable<typeof b> => !!b);
    const biggest = faces.sort((a, b) => b.width * b.height - a.width * a.height)[0];
    if (biggest) faceBox = { x: biggest.originX, y: biggest.originY, w: biggest.width, h: biggest.height };
  }

  const bgHex = opts.background === "brand" ? opts.brandColor : opts.background === "original" ? "#FFFFFF" : BG[opts.background];
  const out = document.createElement("canvas");
  out.width = PORTRAIT_W;
  out.height = PORTRAIT_H;
  const ctx = out.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = bgHex;
  ctx.fillRect(0, 0, PORTRAIT_W, PORTRAIT_H);
  const c = portraitCrop(work.width, work.height, faceBox);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(work, c.x, c.y, c.w, c.h, 0, 0, PORTRAIT_W, PORTRAIT_H);

  const img = ctx.getImageData(0, 0, PORTRAIT_W, PORTRAIT_H);
  let mask: Float32Array | null = null;
  if (models) {
    const res = models.segmenter.segment(out);
    const m = res.confidenceMasks?.[0];
    if (m && m.width === PORTRAIT_W && m.height === PORTRAIT_H) mask = new Float32Array(m.getAsFloat32Array());
    res.close();
  }
  const replace = opts.background !== "original" && !!mask;
  if (opts.fixLighting) applyLevels(img.data, buildLevels(img.data, mask));
  if (replace) replaceBackground(img.data, mask!, hexToRgb(bgHex));
  if (opts.fixLighting) sharpen(img.data, PORTRAIT_W, PORTRAIT_H);
  ctx.putImageData(img, 0, 0);

  const blob = await new Promise<Blob>((resolve, reject) => out.toBlob((b) => (b ? resolve(b) : reject(new Error("encode"))), "image/jpeg", 0.92));
  return { blob, faceFound: !!faceBox, backgroundReplaced: replace, modelsAvailable: !!models };
}
