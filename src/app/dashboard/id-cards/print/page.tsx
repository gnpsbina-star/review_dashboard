import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IdCardBack, IdCardFront } from "@/components/dashboard/IdCard";
import { PrintButton } from "@/components/dashboard/PrintButton";
import { requireAccess } from "@/lib/access";
import { loadIdCards, type IdCardData } from "@/lib/data/id-cards";

export const metadata: Metadata = { title: "Print ID cards" };

const PER_SHEET = 9; // 3 × 3 portrait cards on A4
const COLS = 3;

function chunk<T>(list: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += n) out.push(list.slice(i, i + n));
  return out;
}

/** Backs are mirrored left-to-right so they line up with the fronts when printed double-sided (flip on long edge). */
function mirroredBacks(cards: IdCardData[]): (IdCardData | null)[] {
  const slots: (IdCardData | null)[] = [];
  for (const row of chunk(cards, COLS)) {
    const full = [...row, ...Array(COLS - row.length).fill(null)] as (IdCardData | null)[];
    slots.push(...full.reverse());
  }
  return slots;
}

export default async function PrintIdCards(props: PageProps<"/dashboard/id-cards/print">) {
  const a = await requireAccess({ ownerOnly: true });
  const sp = await props.searchParams;
  const ids = typeof sp.ids === "string" ? sp.ids.split(",").filter((x) => /^[a-z0-9]{10,40}$/.test(x)) : [];
  const layout = sp.layout === "single" ? "single" : "a4";
  if (ids.length === 0) notFound();
  const cards = await loadIdCards(a, ids);
  if (cards.length === 0) notFound();
  const sheets = chunk(cards, PER_SHEET);

  return (
    <>
      <style>{layout === "single" ? "@page { size: 54mm 85.6mm; margin: 0; }" : "@page { size: A4; margin: 0; }"}</style>
      <div className="mhead no-print">
        <div>
          <Link href="/dashboard/id-cards" className="help">← ID cards</Link>
          <h1>Print {cards.length} ID {cards.length === 1 ? "card" : "cards"}</h1>
          <div className="who">{layout === "a4" ? "A4 sheets, 9 cards per sheet, fronts then mirrored backs" : "One card per page, exact ID size (54 × 85.6 mm)"}</div>
        </div>
        <div className="toolbar">
          {/* A full page load, so each layout starts with only its own @page size. */}
          <a className="btn-ghost" href={`/dashboard/id-cards/print?layout=${layout === "a4" ? "single" : "a4"}&ids=${cards.map((c) => c.id).join(",")}`}>
            Switch to {layout === "a4" ? "single cards" : "A4 sheets"}
          </a>
          <PrintButton />
        </div>
      </div>
      <div className="notice no-print">
        <span>
          In the print dialog choose <b>Actual size (100%)</b>, not “Fit to page”, and turn on <b>background graphics</b>.{" "}
          {layout === "a4"
            ? "For double-sided printing choose “Flip on long edge”; the backs are already mirrored to line up. Cut along the dashed guides. To make a PDF for a print shop, choose “Save as PDF”."
            : "Select your card printer and the CR80 card size. Each card prints front, then back."}
        </span>
      </div>
      {cards.some((c) => !c.photoUrl) && <div className="banner warn no-print"><span>Some cards have no photo yet and show initials instead. Add photos on each staff member’s page.</span></div>}

      {layout === "a4" ? (
        <div className="sheets">
          {sheets.map((group, i) => (
            <div key={i} style={{ display: "contents" }}>
              <div className="sheet-label no-print">Sheet {i + 1} · fronts</div>
              <div className={`sheet ${i > 0 ? "pb" : ""}`}>
                {group.map((c) => <div key={c.id} className="slot"><IdCardFront c={c} /></div>)}
              </div>
              <div className="sheet-label no-print">Sheet {i + 1} · backs (print on the reverse)</div>
              <div className="sheet pb">
                {mirroredBacks(group).map((c, j) => (c ? <div key={c.id} className="slot"><IdCardBack c={c} /></div> : <div key={`e${j}`} className="slot slot-empty" />))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="sheet-single">
          {cards.map((c, i) => (
            <div key={c.id} style={{ display: "contents" }}>
              <div className={i > 0 ? "pb" : undefined}><IdCardFront c={c} /></div>
              <div className="pb"><IdCardBack c={c} /></div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
