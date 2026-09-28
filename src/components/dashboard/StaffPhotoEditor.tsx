"use client";

import { useRef, useState, useTransition } from "react";
import { uploadStaffPhoto } from "@/app/dashboard/staff/actions";
import { enhancePhoto, type Background, type EnhanceResult } from "./enhancePhoto";

const BACKGROUNDS: [Background, string][] = [["white", "White"], ["grey", "Light grey"], ["brand", "Brand colour"], ["original", "Keep original"]];

export function StaffPhotoEditor({ staffId, staffName, brandColor, hasPhoto }: { staffId: string; staffName: string; brandColor: string; hasPhoto: boolean }) {
  const [file, setFile] = useState<File | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [result, setResult] = useState<(EnhanceResult & { url: string }) | null>(null);
  const [background, setBackground] = useState<Background>("white");
  const [fixLighting, setFixLighting] = useState(true);
  const [choice, setChoice] = useState<"enhanced" | "original">("enhanced");
  const [working, setWorking] = useState(false);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  const run = useRef(0);
  function enhance(f: File, bg: Background, fix: boolean) {
    const id = ++run.current; // ignore results of older runs
    setWorking(true);
    setError(null);
    enhancePhoto(f, { background: bg, brandColor, fixLighting: fix })
      .then((r) => {
        if (id !== run.current) return;
        setResult((old) => {
          if (old) URL.revokeObjectURL(old.url);
          return { ...r, url: URL.createObjectURL(r.blob) };
        });
      })
      .catch(() => id === run.current && setError("This photo couldn’t be enhanced. You can still save the original."))
      .finally(() => id === run.current && setWorking(false));
  }

  function pick(f: File | undefined) {
    if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) {
      setError("Use a JPG, PNG or WebP photo.");
      return;
    }
    if (originalUrl) URL.revokeObjectURL(originalUrl);
    setOriginalUrl(URL.createObjectURL(f));
    setChoice("enhanced");
    setFile(f);
    enhance(f, background, fixLighting);
  }

  function save() {
    if (!file) return;
    const useEnhanced = choice === "enhanced" && result;
    if (!useEnhanced && file.size > 4 * 1024 * 1024) {
      setError("The original is larger than 4 MB. Use the enhanced photo, or choose a smaller file.");
      return;
    }
    const form = new FormData();
    form.set("staffId", staffId);
    form.set("consent", consent ? "on" : "");
    form.set("photo", useEnhanced ? new File([result.blob], "enhanced.jpg", { type: "image/jpeg" }) : file);
    startSaving(() => uploadStaffPhoto(form));
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
      {!file ? (
        <button type="button" className="btn-ghost" style={{ justifySelf: "start" }} onClick={() => input.current?.click()}>
          {hasPhoto ? "Replace photo" : "Choose a photo"}
        </button>
      ) : (
        <>
          <div className="enhance-grid">
            <button type="button" className="enhance-tile" aria-pressed={choice === "original"} onClick={() => setChoice("original")}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {originalUrl && <img src={originalUrl} alt="Original photo" />}
              <span>Original</span>
            </button>
            <button type="button" className="enhance-tile" aria-pressed={choice === "enhanced"} onClick={() => setChoice("enhanced")} disabled={!result}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {result && <img src={result.url} alt="Enhanced photo" style={{ opacity: working ? 0.5 : 1 }} />}
              <span>{working ? "Enhancing…" : "✨ Enhanced"}</span>
            </button>
          </div>
          <div className="toolbar" style={{ gap: 14 }}>
            <div className="seg" role="group" aria-label="Background">
              {BACKGROUNDS.map(([k, l]) => (
                <button key={k} type="button" aria-pressed={background === k} onClick={() => { setBackground(k); enhance(file, k, fixLighting); }}>{l}</button>
              ))}
            </div>
            <label className="check"><input type="checkbox" checked={fixLighting} onChange={(e) => { setFixLighting(e.target.checked); enhance(file, background, e.target.checked); }} /> Fix lighting and colour</label>
          </div>
          {result && !working && (
            <p className="help">
              {!result.modelsAvailable
                ? "Face and background detection isn’t available in this browser, so the photo is centred and the lighting fixed only."
                : !result.faceFound
                  ? "We couldn’t find a face, so the photo is centred instead. A clear, front-facing photo works best."
                  : "Face centred for the ID card."}{" "}
              Only framing, lighting and background change. The face itself is never altered.
            </p>
          )}
          <label className="check"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /> {staffName} agreed to their photo being used on their ID card.</label>
          <div className="toolbar">
            <button type="button" className="btn" disabled={!consent || saving || working} onClick={save}>{saving ? "Saving…" : `Save ${choice === "enhanced" ? "enhanced" : "original"} photo`}</button>
            <button type="button" className="btn-ghost" onClick={() => input.current?.click()}>Choose another photo</button>
          </div>
        </>
      )}
      {error && <p className="err" role="alert">{error}</p>}
    </div>
  );
}
