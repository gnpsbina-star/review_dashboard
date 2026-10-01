// Copies the QR card fonts into public/ so downloaded cards (SVG, PNG, PDF)
// can embed them. Both are SIL Open Font License fonts from @fontsource.
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const files = {
  "card-sora-600.woff2": ["@fontsource/sora", "sora-latin-600-normal.woff2"],
  "card-sora-700.woff2": ["@fontsource/sora", "sora-latin-700-normal.woff2"],
  "card-deva-600.woff2": ["@fontsource/noto-sans-devanagari", "noto-sans-devanagari-devanagari-600-normal.woff2"],
  "card-deva-700.woff2": ["@fontsource/noto-sans-devanagari", "noto-sans-devanagari-devanagari-700-normal.woff2"],
};
const dest = join("public", "fonts");
mkdirSync(dest, { recursive: true });
for (const [name, [pkg, file]] of Object.entries(files)) {
  const src = join("node_modules", pkg, "files", file);
  if (existsSync(src)) cpSync(src, join(dest, name));
}
console.log("Copied QR card fonts to public/fonts");
