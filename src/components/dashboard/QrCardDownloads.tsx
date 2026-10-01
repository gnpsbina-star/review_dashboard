"use client";

import { useState } from "react";
import { buildPdf, type PdfPage } from "@/lib/pdf";
import { cardTree, PAPER, toSvgString, type CardData, type CardSize } from "@/lib/qr-card";

const DPI = 300;
const FONT_FILES: [string, string, number][] = [
  ["CardSora", "/fonts/card-sora-600.woff2", 600],
  ["CardSora", "/fonts/card-sora-700.woff2", 700],
  ["CardDeva", "/fonts/card-deva-600.woff2", 600],
  ["CardDeva", "/fonts/card-deva-700.woff2", 700],
];

async function dataUrl(res: Response): Promise<string> {
  if (!res.ok) throw new Error(`Could not load ${res.url}`);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

let fontCss: Promise<string> | null = null;
function loadFontCss(): Promise<string> {
  fontCss ??= Promise.all(
    FONT_FILES.map(async ([family, url, weight]) => `@font-face{font-family:${family};font-weight:${weight};src:url(${await dataUrl(await fetch(url))}) format("woff2")}`),
  ).then((rules) => rules.join(""));
  fontCss.catch(() => (fontCss = null));
  return fontCss;
}

/** A self-contained SVG of the card: fonts, logo and photo are embedded. */
async function standaloneSvg(card: CardData, wMm: number, hMm: number, unit: "mm" | "px", scale = 1): Promise<string> {
  const urls = [card.logoUrl, card.staff?.photoUrl].filter((u): u is string => !!u);
  const [css, ...images] = await Promise.all([loadFontCss(), ...urls.map(async (u) => dataUrl(await fetch(u)))]);
  const size = (mm: number) => (unit === "mm" ? `${mm}mm` : `${Math.round(mm * scale)}`);
  return toSvgString(cardTree(card), { width: size(wMm), height: size(hMm), fontCss: css, images: Object.fromEntries(urls.map((u, i) => [u, images[i]])) });
}

async function rasterize(card: CardData, wMm: number, hMm: number, pxPerMm: number, type: "image/png" | "image/jpeg"): Promise<{ blob: Blob; w: number; h: number }> {
  const w = Math.round(wMm * pxPerMm);
  const h = Math.round(hMm * pxPerMm);
  const svg = await standaloneSvg(card, wMm, hMm, "px", pxPerMm);
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    // Embedded fonts can finish loading just after decode on some browsers.
    await new Promise((r) => setTimeout(r, 60));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.95));
    if (!blob) throw new Error("Could not create the image");
    return { blob, w, h };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function fileName(card: CardData, size: CardSize, ext: string) {
  const who = card.kind === "TABLE" ? card.label : card.kind === "STAFF" ? card.staff?.name : "branch";
  return `${slug(`${card.businessName}-${card.branchName}-${who}-${size}`)}.${ext}`;
}

/** Sheets: 4 A6 cards or 2 A5 cards on an A4 page with dashed cut lines, or one A4 poster per page. */
const SHEET: Record<CardSize, { page: [number, number]; slot: [number, number]; cols: number; rows: number }> = {
  a6: { page: [210, 297], slot: [105, 148.5], cols: 2, rows: 2 },
  a5: { page: [297, 210], slot: [148.5, 210], cols: 2, rows: 1 },
  a4: { page: [210, 297], slot: [210, 297], cols: 1, rows: 1 },
};

async function jpegBytes(card: CardData, w: number, h: number) {
  const { blob, w: pxW, h: pxH } = await rasterize(card, w, h, DPI / 25.4, "image/jpeg");
  return { jpeg: new Uint8Array(await blob.arrayBuffer()), pxW, pxH };
}

async function sheetPdf(cards: CardData[], size: CardSize, onProgress: (done: number) => void): Promise<Blob> {
  const s = SHEET[size];
  const per = s.cols * s.rows;
  const pages: PdfPage[] = [];
  for (let i = 0; i < cards.length; i += per) {
    const page: PdfPage = { w: s.page[0], h: s.page[1], images: [], cuts: [] };
    for (let k = 0; k < per && i + k < cards.length; k++) {
      const col = k % s.cols;
      const row = Math.floor(k / s.cols);
      page.images.push({ ...(await jpegBytes(cards[i + k], s.slot[0], s.slot[1])), x: col * s.slot[0], y: row * s.slot[1], w: s.slot[0], h: s.slot[1] });
      onProgress(i + k + 1);
    }
    for (let c = 1; c < s.cols; c++) page.cuts!.push([c * s.slot[0], 0, c * s.slot[0], s.page[1]]);
    for (let r = 1; r < s.rows; r++) page.cuts!.push([0, r * s.slot[1], s.page[0], r * s.slot[1]]);
    pages.push(page);
  }
  return new Blob([buildPdf(pages) as BlobPart], { type: "application/pdf" });
}

async function cardPdf(card: CardData, size: CardSize): Promise<Blob> {
  const { w, h } = PAPER[size];
  const image = await jpegBytes(card, w, h);
  return new Blob([buildPdf([{ w, h, images: [{ ...image, x: 0, y: 0, w, h }] }]) as BlobPart], { type: "application/pdf" });
}

function useBusy() {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function run(label: string, job: () => Promise<void>) {
    setBusy(label);
    setError(null);
    try {
      await job();
    } catch (e) {
      console.error(e);
      setError("Couldn’t create the file. Please try again, or use Print instead.");
    } finally {
      setBusy(null);
    }
  }
  return { busy, error, run };
}

/** PDF, PNG and SVG downloads for one card. */
export function CardDownloads({ card, size }: { card: CardData; size: CardSize }) {
  const { busy, error, run } = useBusy();
  const { w, h } = PAPER[size];
  return (
    <div style={{ display: "grid", gap: 4, justifyItems: "center" }}>
      <div className="toolbar" style={{ justifyContent: "center" }}>
        <button type="button" className="btn-ghost btn-sm" disabled={!!busy} onClick={() => run("pdf", async () => save(await cardPdf(card, size), fileName(card, size, "pdf")))}>
          {busy === "pdf" ? "Preparing…" : "PDF"}
        </button>
        <button
          type="button"
          className="btn-ghost btn-sm"
          disabled={!!busy}
          title="4000 pixels tall, for printers and flex banners"
          onClick={() => run("png", async () => save((await rasterize(card, w, h, 4000 / h, "image/png")).blob, fileName(card, size, "png")))}
        >
          {busy === "png" ? "Preparing…" : "PNG"}
        </button>
        <button type="button" className="btn-ghost btn-sm" disabled={!!busy} title="Vector file for designers" onClick={() => run("svg", async () => save(new Blob([await standaloneSvg(card, w, h, "mm")], { type: "image/svg+xml" }), fileName(card, size, "svg")))}>
          {busy === "svg" ? "Preparing…" : "SVG"}
        </button>
      </div>
      {error && <span className="err" role="alert">{error}</span>}
    </div>
  );
}

/** One print-ready PDF with every card shown, laid out on A4 pages. */
export function SheetDownload({ cards, size }: { cards: CardData[]; size: CardSize }) {
  const { busy, error, run } = useBusy();
  const [done, setDone] = useState(0);
  return (
    <>
      <button
        type="button"
        className="btn"
        disabled={!!busy || cards.length === 0}
        onClick={() =>
          run("sheet", async () => {
            setDone(0);
            save(await sheetPdf(cards, size, setDone), `${slug(`${cards[0].businessName}-${cards[0].branchName}-${size}-sheet`)}.pdf`);
          })
        }
      >
        {busy ? `Preparing ${done} of ${cards.length}…` : "Download PDF"}
      </button>
      {error && <span className="err" role="alert">{error}</span>}
    </>
  );
}
