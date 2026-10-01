/**
 * Floating review helper. Websites can't put anything on Google's review page,
 * but a picture-in-picture video window floats above other tabs and apps. We
 * draw the copied review and the paste steps onto a canvas, stream it into a
 * hidden video, and pop that video out when the customer goes to Google.
 *
 * Browser support varies (it's a trial), so every step fails quietly and the
 * normal copy-and-paste flow carries on.
 */

import { opensMapsApp } from "@/lib/google-link";

const W = 600;
const H = 450;

export interface FloatLabels {
  title: string;
  steps: string;
}

/**
 * Whether the helper can float above Google for this link on this device.
 * On Android, Chrome turns itself into the floating window, so Google must
 * open in the Maps app rather than in another Chrome tab.
 */
export function canFloatOver(googleUrl: string, userAgent: string): boolean {
  return !/Android/i.test(userAgent) || opensMapsApp(googleUrl);
}

/** Splits text into lines that fit `max` pixels, ending with "…" if it runs past `maxLines`. */
export function wrapLines(text: string, max: number, maxLines: number, measure: (s: string) => number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && measure(next) > max) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1];
  while (last && measure(`${last}…`) > max) last = last.slice(0, -1);
  kept[maxLines - 1] = `${last.trimEnd()}…`;
  return kept;
}

export class FloatingReview {
  private canvas: HTMLCanvasElement;
  private video: HTMLVideoElement;
  private timer: number;
  private text = "";
  private labels: FloatLabels = { title: "", steps: "" };

  static supported(): boolean {
    return (
      typeof document !== "undefined" &&
      !!document.pictureInPictureEnabled &&
      typeof HTMLCanvasElement.prototype.captureStream === "function" &&
      "requestPictureInPicture" in HTMLVideoElement.prototype
    );
  }

  constructor(private brand: string, onClose: () => void) {
    this.canvas = document.createElement("canvas");
    this.canvas.width = W;
    this.canvas.height = H;
    this.video = document.createElement("video");
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.setAttribute("playsinline", "");
    this.video.setAttribute("aria-hidden", "true");
    Object.assign(this.video.style, { position: "fixed", left: "0", bottom: "0", width: "1px", height: "1px", opacity: "0", pointerEvents: "none" });
    this.draw();
    this.video.srcObject = this.canvas.captureStream(2);
    this.video.addEventListener("leavepictureinpicture", onClose);
    document.body.appendChild(this.video);
    void this.video.play().catch(() => undefined);
    // Repaint so the stream keeps sending frames while the window floats.
    this.timer = window.setInterval(() => this.draw(), 1000);
  }

  get active(): boolean {
    return document.pictureInPictureElement === this.video;
  }

  /** Must run inside the customer's tap. Resolves to whether the window opened. */
  show(text: string, labels: FloatLabels): Promise<boolean> {
    this.text = text;
    this.labels = labels;
    this.draw();
    if (this.active) return Promise.resolve(true);
    if (this.video.readyState < 1) return Promise.resolve(false);
    try {
      return this.video.requestPictureInPicture().then(
        () => true,
        () => false,
      );
    } catch {
      return Promise.resolve(false);
    }
  }

  update(text: string) {
    this.text = text;
    this.draw();
  }

  close() {
    if (this.active) void document.exitPictureInPicture().catch(() => undefined);
  }

  destroy() {
    window.clearInterval(this.timer);
    this.close();
    (this.video.srcObject as MediaStream | null)?.getTracks().forEach((t) => t.stop());
    this.video.remove();
  }

  private draw() {
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;
    const font = getComputedStyle(document.body).fontFamily || "sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);
    // Header
    ctx.fillStyle = this.brand;
    ctx.fillRect(0, 0, W, 78);
    ctx.fillStyle = "#ffffff";
    ctx.font = `700 30px ${font}`;
    ctx.textBaseline = "middle";
    ctx.fillText(this.labels.title, 26, 40, W - 52);
    // Review text
    ctx.fillStyle = "#15201e";
    ctx.font = `500 27px ${font}`;
    ctx.textBaseline = "alphabetic";
    const lines = wrapLines(this.text, W - 52, 7, (s) => ctx.measureText(s).width);
    lines.forEach((line, i) => ctx.fillText(line, 26, 122 + i * 37));
    // Steps
    ctx.fillStyle = "#f1f4f3";
    ctx.fillRect(0, H - 74, W, 74);
    ctx.fillStyle = this.brand;
    ctx.font = `700 26px ${font}`;
    ctx.textBaseline = "middle";
    ctx.fillText(this.labels.steps, 26, H - 37, W - 52);
  }
}
