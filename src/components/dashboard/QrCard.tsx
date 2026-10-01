import { createElement, type ReactNode } from "react";
import { cardTree, type CardData, type Node } from "@/lib/qr-card";

const FONTS = {
  display: "var(--font-sora), var(--font-deva), system-ui, sans-serif",
  deva: "var(--font-deva), var(--font-sora), system-ui, sans-serif",
};

const camel = (k: string) => k.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

function toReact(n: Node | string, key: number): ReactNode {
  if (typeof n === "string") return n;
  const props: Record<string, unknown> = { key };
  for (const [k, v] of Object.entries(n.attrs ?? {})) props[camel(k)] = v;
  if (n.font) props.style = { fontFamily: FONTS[n.font] };
  return createElement(n.tag, props, ...(n.children ?? []).map(toReact));
}

/** The printable QR card, drawn as SVG with the page's own fonts. */
export function QrCard({ data, className }: { data: CardData; className?: string }) {
  const root = cardTree(data);
  const props: Record<string, unknown> = { className, role: "img", "aria-label": `QR card: ${data.label ?? data.staff?.name ?? data.branchName}, ${data.url}` };
  for (const [k, v] of Object.entries(root.attrs ?? {})) props[camel(k)] = v;
  return createElement("svg", props, ...(root.children ?? []).map(toReact));
}
