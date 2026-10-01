import { describe, expect, it } from "vitest";
import { buildPdf } from "@/lib/pdf";
import { cardTree, textWidth, toSvgString, type CardData } from "@/lib/qr-card";

const card: CardData = {
  id: "c1",
  kind: "STAFF",
  code: "ABC123",
  url: "https://go.example.com/r/ABC123",
  qr: { d: "M0 0h7v1h-7z", size: 25 },
  type: "COACHING",
  businessName: `Tom & "Jerry" <script>alert(1)</script>`,
  branchName: "Jayanagar",
  color: "#5B2A86",
  logoUrl: "/api/logo/x?v=1",
  headline: { en: "How was your class with Mrs. Sharma?", hi: "Mrs. Sharma के साथ आपकी क्लास कैसी रही?" },
  label: null,
  staff: { name: "Mrs. Sharma", designation: "Physics", photoUrl: null },
};

describe("QR card", () => {
  it("escapes every piece of business text in the SVG", () => {
    const svg = toSvgString(cardTree(card), { width: "105mm", height: "148mm", images: { "/api/logo/x?v=1": "data:image/png;base64,AAAA" } });
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("Tom &amp; &quot;Jerry&quot; &lt;script&gt;");
    expect(svg).toContain('href="data:image/png;base64,AAAA"');
    expect(svg).toContain('width="105mm"');
  });
  it("wraps the headline inside the card and squeezes overlong names", () => {
    const texts: { x: number; size: number; text: string; squeezed: boolean }[] = [];
    const walk = (n: ReturnType<typeof cardTree>) => {
      if (n.tag === "text") texts.push({ x: Number(n.attrs!.x), size: Number(n.attrs!["font-size"]), text: String(n.children![0]), squeezed: "textLength" in n.attrs! });
      for (const c of n.children ?? []) if (typeof c !== "string") walk(c);
    };
    walk(cardTree({ ...card, businessName: "A very long business name that will not fit in the header at all" }));
    for (const t of texts) if (!t.squeezed && t.x === 8) expect(t.x + textWidth(t.text, t.size)).toBeLessThanOrEqual(105 - 8 + 0.01);
    expect(texts.find((t) => t.text.startsWith("A very long"))!.squeezed).toBe(true);
    expect(texts.filter((t) => t.size > 5 && t.x === 8).map((t) => t.text)).toEqual(["How was your class", "with Mrs. Sharma?"]);
  });
});

describe("PDF writer", () => {
  it("writes a valid cross-reference table", () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    const pdf = buildPdf([
      { w: 210, h: 297, images: [{ jpeg, pxW: 1, pxH: 1, x: 0, y: 0, w: 105, h: 148.5 }], cuts: [[105, 0, 105, 297]] },
      { w: 210, h: 297, images: [{ jpeg, pxW: 1, pxH: 1, x: 0, y: 0, w: 210, h: 297 }] },
    ]);
    const text = new TextDecoder("latin1").decode(pdf);
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text).toContain("/Count 2");
    const startxref = Number(text.match(/startxref\n(\d+)/)![1]);
    expect(text.slice(startxref, startxref + 4)).toBe("xref");
    const entries = text.slice(startxref).match(/(\d{10}) 00000 n/g)!.map((e) => Number(e.slice(0, 10)));
    expect(entries).toHaveLength(8);
    entries.forEach((offset, i) => expect(text.slice(offset).startsWith(`${i + 1} 0 obj`)).toBe(true));
  });
});
