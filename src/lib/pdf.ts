/**
 * Minimal PDF writer for print sheets: each page holds JPEG images at exact
 * millimetre positions, plus optional thin cut lines. No fonts, no scripts.
 */
export interface PdfImage {
  jpeg: Uint8Array;
  pxW: number;
  pxH: number;
  x: number; // mm from the left
  y: number; // mm from the top
  w: number;
  h: number;
}
export interface PdfPage {
  w: number; // mm
  h: number;
  images: PdfImage[];
  cuts?: [number, number, number, number][]; // mm, x1 y1 x2 y2 from the top-left
}

const PT = 72 / 25.4;
const n = (v: number) => (Math.round(v * PT * 100) / 100).toString();

export function buildPdf(pages: PdfPage[]): Uint8Array {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (b: Uint8Array | string) => {
    const bytes = typeof b === "string" ? enc.encode(b) : b;
    chunks.push(bytes);
    length += bytes.length;
  };
  const obj = (id: number, body: () => void) => {
    offsets[id] = length;
    push(`${id} 0 obj\n`);
    body();
    push("\nendobj\n");
  };

  push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  // Object ids: 1 catalog, 2 page tree, then per page: page, content, one per image.
  let next = 3;
  const layout = pages.map((p) => {
    const page = next++;
    const content = next++;
    const images = p.images.map(() => next++);
    return { page, content, images };
  });

  obj(1, () => push("<< /Type /Catalog /Pages 2 0 R >>"));
  obj(2, () => push(`<< /Type /Pages /Kids [${layout.map((l) => `${l.page} 0 R`).join(" ")}] /Count ${pages.length} >>`));
  pages.forEach((p, i) => {
    const l = layout[i];
    const xobjects = l.images.map((id, k) => `/Im${k} ${id} 0 R`).join(" ");
    obj(l.page, () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${n(p.w)} ${n(p.h)}] /Resources << /XObject << ${xobjects} >> >> /Contents ${l.content} 0 R >>`));
    let ops = "";
    p.images.forEach((im, k) => {
      ops += `q ${n(im.w)} 0 0 ${n(im.h)} ${n(im.x)} ${n(p.h - im.y - im.h)} cm /Im${k} Do Q\n`;
    });
    if (p.cuts?.length) {
      ops += "q 0.4 w 0.7 G [2 2] 0 d\n";
      for (const [x1, y1, x2, y2] of p.cuts) ops += `${n(x1)} ${n(p.h - y1)} m ${n(x2)} ${n(p.h - y2)} l S\n`;
      ops += "Q\n";
    }
    const stream = enc.encode(ops);
    obj(l.content, () => {
      push(`<< /Length ${stream.length} >>\nstream\n`);
      push(stream);
      push("\nendstream");
    });
    p.images.forEach((im, k) => {
      obj(l.images[k], () => {
        push(`<< /Type /XObject /Subtype /Image /Width ${im.pxW} /Height ${im.pxH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.jpeg.length} >>\nstream\n`);
        push(im.jpeg);
        push("\nendstream");
      });
    });
  });

  const xref = length;
  push(`xref\n0 ${next}\n0000000000 65535 f \n`);
  for (let id = 1; id < next; id++) push(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
  push(`trailer\n<< /Size ${next} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  const out = new Uint8Array(length);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}
