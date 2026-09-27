"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { IconCamera, IconCheck, IconCopy, IconHeart, IconLock, IconRefresh, STAR_PATH } from "@/components/icons";
import { shrinkPhoto } from "./shrinkPhoto";
import { BusinessLogo } from "@/components/ui";
import { ISSUE_KEYS, LANG_LABELS, normalizeIndianMobile, T, type UiLang } from "@/lib/customer-i18n";

type Lang = "en" | "hi" | "hinglish";
type Suggestion = { id: string; language: Lang; text: string };

export interface FlowProps {
  code: string;
  businessId: string;
  businessName: string;
  logoVersion: number;
  branchName: string;
  cityArea: string;
  googleUrl: string;
  brand: string;
  tableLabel: string | null;
  staffName: string | null;
  languages: Lang[];
  suggestions: { 4: Suggestion[]; 5: Suggestion[] };
  turnstileSiteKey: string | null;
}

type Step = "rate" | "positive" | "copied" | "negative" | "thanks";
type Photo = { key: string; blob: Blob; url: string };
const MAX_PHOTOS = 3;

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id: string) => void;
    };
  }
}

function deviceToken(): string | undefined {
  try {
    let t = localStorage.getItem("srp-device");
    if (!t) {
      t = crypto.randomUUID();
      localStorage.setItem("srp-device", t);
    }
    return t;
  } catch {
    return undefined;
  }
}

function logGoogleClick(body: Record<string, unknown>) {
  try {
    void fetch("/api/public/google-click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, deviceToken: deviceToken() }),
      keepalive: true,
    });
  } catch {
    /* logging must never block the customer */
  }
}

export function ReviewFlow(p: FlowProps) {
  const [ui, setUi] = useState<UiLang>("en");
  const t = T[ui];
  const [step, setStep] = useState<Step>("rate");
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [langFilter, setLangFilter] = useState<Lang | "all">("all");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<{ text: string; ok: boolean } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Complaint form
  const [issues, setIssues] = useState<number[]>([]);
  const [comment, setComment] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<{ comment?: boolean; phone?: boolean; server?: string }>({});
  const [sending, setSending] = useState(false);
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [preparing, setPreparing] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    setPhotoError(null);
    const room = MAX_PHOTOS - photos.length;
    if (files.length > room) setPhotoError(t.errPhotoCount);
    setPreparing(true);
    const added: Photo[] = [];
    for (const file of Array.from(files).slice(0, room)) {
      try {
        const blob = await shrinkPhoto(file);
        added.push({ key: crypto.randomUUID(), blob, url: URL.createObjectURL(blob) });
      } catch {
        setPhotoError(t.errPhotoType);
      }
    }
    setPhotos((cur) => [...cur, ...added].slice(0, MAX_PHOTOS));
    setPreparing(false);
  }

  function removePhoto(key: string) {
    setPhotos((cur) => {
      const gone = cur.find((x) => x.key === key);
      if (gone) URL.revokeObjectURL(gone.url);
      return cur.filter((x) => x.key !== key);
    });
    setPhotoError(null);
  }

  const tier = (rating >= 5 ? 5 : 4) as 4 | 5;
  const pool = useMemo(
    () => p.suggestions[tier].filter((s) => langFilter === "all" || s.language === langFilter),
    [p.suggestions, tier, langFilter],
  );
  const visible = useMemo(() => {
    if (pool.length <= 4) return pool;
    return Array.from({ length: 4 }, (_, i) => pool[(offset + i) % pool.length]);
  }, [pool, offset]);
  const selectedSug = visible.find((s) => s.id === selected) ?? null;
  const selectedText = selectedSug ? (edits[selectedSug.id] ?? selectedSug.text) : "";

  function go(next: Step) {
    setStep(next);
    requestAnimationFrame(() => scrollRef.current?.scrollIntoView({ block: "start" }));
  }

  function choose(n: number) {
    setRating(n);
    setHover(0);
    setSelected(null);
    setOffset(0);
    setErrors({});
    window.setTimeout(() => go(n >= 4 ? "positive" : "negative"), 320);
  }

  function restart() {
    setRating(0);
    setSelected(null);
    setCopied(null);
    setIssues([]);
    setComment("");
    setErrors({});
    photos.forEach((ph) => URL.revokeObjectURL(ph.url));
    setPhotos([]);
    setPhotoError(null);
    go("rate");
  }

  function onCopyAndPost(e: React.MouseEvent<HTMLAnchorElement>) {
    if (!selectedSug) {
      e.preventDefault();
      return;
    }
    const text = selectedText.trim();
    const done = (ok: boolean) => {
      setCopied({ text, ok });
      go("copied");
    };
    try {
      navigator.clipboard.writeText(text).then(() => done(true), () => done(false));
    } catch {
      done(false);
    }
    logGoogleClick({ code: p.code, rating, text, language: selectedSug.language, edited: text !== selectedSug.text });
    // The link itself opens Google in a new tab, which keeps popup blockers happy.
  }

  const shownStars = hover || rating;
  const displayLangs: Lang[] = p.languages.length ? p.languages : ["en"];

  return (
    <main className="cx" style={{ ["--brand-ui" as string]: p.brand }} lang={ui === "hi" ? "hi" : "en"}>
      <div className="cx-wrap" ref={scrollRef}>
        <div className="cx-scroll">
          <header className="cx-head">
            <BusinessLogo businessId={p.businessId} name={p.businessName} logoVersion={p.logoVersion} color={p.brand} size={48} />
            <div>
              <div className="cx-biz">{p.businessName}</div>
              <div className="cx-branch">{p.cityArea}</div>
            </div>
            <div className="langsw" role="group" aria-label="Language">
              <button type="button" aria-pressed={ui === "en"} onClick={() => setUi("en")}>EN</button>
              <button type="button" aria-pressed={ui === "hi"} onClick={() => setUi("hi")} lang="hi">हिंदी</button>
            </div>
          </header>

          {step === "rate" && (
            <>
              {(p.tableLabel || p.staffName) && (
                <span className="ctx">
                  {[p.tableLabel ? `${t.table} ${p.tableLabel}` : null, p.staffName ? `${t.servedBy} ${p.staffName}` : null].filter(Boolean).join(" · ")}
                </span>
              )}
              <div>
                <h1 className="q">{t.q}</h1>
                <p className="q-sub">{t.qs}</p>
              </div>
              <div className="starrow" role="radiogroup" aria-label={t.q} onMouseLeave={() => setHover(0)}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={rating === n}
                    aria-label={`${n} – ${t.labels[n - 1]}`}
                    className={`starbtn ${n <= shownStars ? "on" : ""}`}
                    onMouseEnter={() => setHover(n)}
                    onClick={() => choose(n)}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden><path d={STAR_PATH} /></svg>
                  </button>
                ))}
              </div>
              <div className="starnote" aria-live="polite">{shownStars ? t.labels[shownStars - 1] : ""}</div>
              <p className="help" style={{ marginTop: "auto" }}>{t.trust}</p>
            </>
          )}

          {(step === "positive" || step === "negative") && (
            <div className="rated">
              <MiniStars n={rating} />
              <button type="button" className="linkbtn" onClick={restart}>{t.change}</button>
            </div>
          )}

          {step === "positive" && (
            <>
              <div>
                <h1 className="q q-sm">{t.posH}</h1>
                <p className="q-sub">{pool.length ? t.posS : t.noSug}</p>
              </div>
              {displayLangs.length > 1 && (
                <div className="chips" role="group" aria-label="Language">
                  {(["all", ...displayLangs] as const).map((k) => (
                    <button key={k} type="button" className="chip" aria-pressed={langFilter === k} onClick={() => { setLangFilter(k); setOffset(0); setSelected(null); }}>
                      {k === "all" ? t.all : LANG_LABELS[k]}
                    </button>
                  ))}
                </div>
              )}
              <div className="sugs">
                {visible.map((s) => {
                  const sel = s.id === selected;
                  const text = edits[s.id] ?? s.text;
                  return sel ? (
                    <div key={s.id} className="sug sel">
                      <div className="sug-top"><span className="lbadge">{LANG_LABELS[s.language]}</span><span className="sel-tick"><IconCheck size={14} /></span></div>
                      <label className="sr-only" htmlFor="sug-edit">{t.editHint}</label>
                      <textarea id="sug-edit" value={text} maxLength={1000} lang={s.language === "hi" ? "hi" : "en"} onChange={(e) => setEdits({ ...edits, [s.id]: e.target.value })} />
                      <div className="edit-hint"><span>✎ {t.editHint}</span><span className="num">{text.length}</span></div>
                    </div>
                  ) : (
                    <button key={s.id} type="button" className="sug" onClick={() => setSelected(s.id)}>
                      <span className="sug-top"><span className="lbadge">{LANG_LABELS[s.language]}</span><span className="sel-tick" /></span>
                      <span className="sug-text" lang={s.language === "hi" ? "hi" : "en"}>{text}</span>
                    </button>
                  );
                })}
              </div>
              {pool.length > 4 && (
                <button type="button" className="btn-quiet" onClick={() => { setOffset(offset + 4); setSelected(null); }}>
                  <IconRefresh size={16} /> {t.shuffle}
                </button>
              )}
            </>
          )}

          {step === "copied" && copied && (
            <div className="done" style={{ paddingTop: 12 }}>
              <div className="done-ic"><IconCheck size={36} /></div>
              <h1 className="q q-sm">{copied.ok ? t.copH : t.copFail}</h1>
              <ol className="steps"><li>{t.st1}</li><li>{t.st2}</li><li>{t.stPhoto}</li><li>{t.st3}</li></ol>
              <div className="copied-text">{copied.text}</div>
            </div>
          )}

          {step === "negative" && (
            <ComplaintForm
              p={p}
              t={t}
              rating={rating}
              issues={issues}
              setIssues={setIssues}
              comment={comment}
              setComment={setComment}
              name={name}
              setName={setName}
              phone={phone}
              setPhone={setPhone}
              errors={errors}
              captchaSlot={p.turnstileSiteKey ? <Turnstile siteKey={p.turnstileSiteKey} onToken={setCaptcha} /> : null}
              photoSlot={
                <PhotoPicker t={t} photos={photos} preparing={preparing} error={photoError} onAdd={addPhotos} onRemove={removePhoto} />
              }
            />
          )}

          {step === "thanks" && (
            <div className="done">
              <div className="done-ic"><IconHeart size={34} /></div>
              <h1 className="q q-sm">{t.thxH}</h1>
              <p className="q-sub">{t.thxS(p.branchName)}</p>
            </div>
          )}
        </div>

        {step === "positive" && (
          <div className="dock">
            {pool.length ? (
              <a
                className="btn-brand"
                href={p.googleUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-disabled={!selectedSug}
                onClick={onCopyAndPost}
              >
                <IconCopy size={20} /> {t.copy}
              </a>
            ) : null}
            <a
              className={pool.length ? "linkbtn" : "btn-brand"}
              style={{ justifySelf: "center" }}
              href={p.googleUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => logGoogleClick({ code: p.code, rating })}
            >
              {t.skip}
            </a>
          </div>
        )}
        {step === "copied" && (
          <div className="dock">
            <a className="btn-brand" href={p.googleUrl} target="_blank" rel="noopener noreferrer">{t.openG}</a>
          </div>
        )}
        {step === "negative" && (
          <div className="dock">
            {errors.server && <p className="err" role="alert">{errors.server}</p>}
            <button
              type="button"
              className="btn-brand"
              disabled={sending || preparing}
              onClick={async () => {
                const next: typeof errors = {};
                if (comment.trim().length < 10) next.comment = true;
                if (phone.trim() && !normalizeIndianMobile(phone)) next.phone = true;
                setErrors(next);
                if (next.comment || next.phone) return;
                if (p.turnstileSiteKey && !captcha) {
                  setErrors({ server: t.errCaptcha });
                  return;
                }
                setSending(true);
                try {
                  const payload = {
                    code: p.code,
                    rating,
                    comment: comment.trim(),
                    issues: issues.map((i) => ISSUE_KEYS[i]),
                    name: name.trim(),
                    phone: phone.trim(),
                    turnstileToken: captcha ?? undefined,
                    deviceToken: deviceToken(),
                  };
                  let init: RequestInit;
                  if (photos.length) {
                    const form = new FormData();
                    form.set("data", JSON.stringify(payload));
                    photos.forEach((ph, i) => form.append("photos", ph.blob, `photo-${i + 1}.jpg`));
                    init = { method: "POST", body: form };
                  } else {
                    init = { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) };
                  }
                  const res = await fetch("/api/public/feedback", init);
                  if (res.ok) {
                    go("thanks");
                    return;
                  }
                  const data = (await res.json().catch(() => ({}))) as { error?: string };
                  setErrors({
                    server:
                      data.error === "limit" ? t.errLimit
                      : data.error === "captcha" ? t.errCaptcha
                      : data.error === "phone" ? t.errPhone
                      : data.error === "photo-type" ? t.errPhotoType
                      : data.error === "photo-size" ? t.errPhotoSize
                      : data.error === "photo-count" ? t.errPhotoCount
                      : t.errGeneric,
                  });
                  if (data.error === "captcha") window.turnstile?.reset();
                } catch {
                  setErrors({ server: t.errGeneric });
                } finally {
                  setSending(false);
                }
              }}
            >
              <IconLock size={18} /> {sending ? t.sending : t.send}
            </button>
          </div>
        )}
        {step === "thanks" && (
          <div className="dock">
            <button type="button" className="btn-quiet" onClick={restart}>{t.done}</button>
          </div>
        )}
        <div className="cx-foot">{t.poweredBy} <b>Synergy Technologies</b></div>
      </div>
    </main>
  );
}

function MiniStars({ n }: { n: number }) {
  return (
    <span className="stars-s" role="img" aria-label={`${n} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} width={18} height={18} viewBox="0 0 24 24" aria-hidden><path className={i <= n ? "s-on" : "s-off"} d={STAR_PATH} /></svg>
      ))}
    </span>
  );
}

type Strings = (typeof T)[UiLang];

function ComplaintForm(props: {
  p: FlowProps;
  t: Strings;
  rating: number;
  issues: number[];
  setIssues: (v: number[]) => void;
  comment: string;
  setComment: (v: string) => void;
  name: string;
  setName: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  errors: { comment?: boolean; phone?: boolean };
  captchaSlot: React.ReactNode;
  photoSlot: React.ReactNode;
}) {
  const { t, p } = props;
  return (
    <>
      <div>
        <h1 className="q q-sm">{t.negH}</h1>
        <p className="q-sub">{t.negS}</p>
      </div>
      <div className="field">
        <span className="label">{t.what} <span className="opt">· {t.tapAll}</span></span>
        <div className="chips">
          {t.issues.map((label, i) => (
            <button
              key={i}
              type="button"
              className="chip"
              aria-pressed={props.issues.includes(i)}
              onClick={() => props.setIssues(props.issues.includes(i) ? props.issues.filter((x) => x !== i) : [...props.issues, i])}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <label htmlFor="f-text">{t.detail}</label>
        <textarea id="f-text" required maxLength={2000} value={props.comment} onChange={(e) => props.setComment(e.target.value)} aria-invalid={props.errors.comment || undefined} />
        {props.errors.comment && <span className="err">{t.errText}</span>}
      </div>
      {props.photoSlot}
      <div className="field">
        <label htmlFor="f-name">{t.name} <span className="opt">{t.optional}</span></label>
        <input id="f-name" autoComplete="name" maxLength={80} value={props.name} onChange={(e) => props.setName(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="f-phone">{t.phone} <span className="opt">{t.optional}</span></label>
        <input id="f-phone" inputMode="tel" autoComplete="tel" maxLength={20} placeholder="98765 43210" value={props.phone} onChange={(e) => props.setPhone(e.target.value)} aria-invalid={props.errors.phone || undefined} />
        <span className="help">{t.phHelp}</span>
        {props.errors.phone && <span className="err">{t.errPhone}</span>}
        <span className="consent">{t.consent(p.businessName)}</span>
      </div>
      {props.captchaSlot}
      <a className="linkbtn" style={{ alignSelf: "center", color: "var(--muted)" }} href={p.googleUrl} target="_blank" rel="noopener noreferrer">
        {t.pub}
      </a>
    </>
  );
}

function Turnstile({ siteKey, onToken }: { siteKey: string; onToken: (t: string | null) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let widget: string | null = null;
    let cancelled = false;
    const render = () => {
      if (cancelled || !ref.current || !window.turnstile) return;
      widget = window.turnstile.render(ref.current, {
        sitekey: siteKey,
        appearance: "interaction-only",
        callback: (token: string) => onToken(token),
        "expired-callback": () => onToken(null),
        "error-callback": () => onToken(null),
      });
    };
    if (window.turnstile) render();
    else {
      const existing = document.querySelector<HTMLScriptElement>("script[data-turnstile]");
      const s = existing ?? document.createElement("script");
      if (!existing) {
        s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        s.async = true;
        s.dataset.turnstile = "1";
        document.head.appendChild(s);
      }
      s.addEventListener("load", render);
    }
    return () => {
      cancelled = true;
      if (widget && window.turnstile) window.turnstile.remove(widget);
    };
  }, [siteKey, onToken]);
  return <div ref={ref} />;
}

function PhotoPicker(props: { t: Strings; photos: Photo[]; preparing: boolean; error: string | null; onAdd: (f: FileList | null) => void; onRemove: (key: string) => void }) {
  const { t } = props;
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="field">
      <span className="label">{t.addPhotos} <span className="opt">{t.optional}</span></span>
      <div className="photo-row">
        {props.photos.map((ph, i) => (
          <div key={ph.key} className="photo-thumb">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ph.url} alt={`${t.addPhotos} ${i + 1}`} />
            <button type="button" aria-label={`${t.removePhoto} ${i + 1}`} onClick={() => props.onRemove(ph.key)}>×</button>
          </div>
        ))}
        {props.photos.length < MAX_PHOTOS && (
          <button type="button" className="photo-add" onClick={() => input.current?.click()} disabled={props.preparing}>
            <IconCamera size={22} />
            {props.preparing ? t.preparing : t.addPhotos}
          </button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        multiple
        hidden
        onChange={(e) => {
          props.onAdd(e.target.files);
          e.target.value = "";
        }}
      />
      <span className="help">{t.photosHint}</span>
      {props.error && <span className="err" role="alert">{props.error}</span>}
    </div>
  );
}
