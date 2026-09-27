import "server-only";
import QRCode from "qrcode";

/** QR matrix as a single SVG path (dark modules), plus its size. */
export function qrPath(text: string): { d: string; size: number } {
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
  const size = qr.modules.size;
  const data = qr.modules.data;
  let d = "";
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (data[r * size + c]) d += `M${c} ${r}h1v1h-1z`;
  return { d, size };
}

export function qrSvgString(text: string): string {
  const { d, size } = qrPath(text);
  const q = 4;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-q} ${-q} ${size + 2 * q} ${size + 2 * q}" width="1024" height="1024" shape-rendering="crispEdges"><rect x="${-q}" y="${-q}" width="${size + 2 * q}" height="${size + 2 * q}" fill="#ffffff"/><path d="${d}" fill="#000000"/></svg>\n`;
}

export async function qrPng(text: string): Promise<Buffer> {
  return QRCode.toBuffer(text, { errorCorrectionLevel: "M", width: 1200, margin: 4, color: { dark: "#000000", light: "#ffffff" } });
}
