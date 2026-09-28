// Copies MediaPipe's WebAssembly runtime into public/ so staff photo enhancement
// runs entirely in the browser from our own domain (no third-party CDN).
import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

const src = join("node_modules", "@mediapipe", "tasks-vision", "wasm");
const dest = join("public", "mediapipe");
if (!existsSync(src)) process.exit(0);
mkdirSync(dest, { recursive: true });
for (const f of readdirSync(src)) if (!f.includes("_module_")) cpSync(join(src, f), join(dest, f));
console.log("Copied MediaPipe runtime to public/mediapipe");
