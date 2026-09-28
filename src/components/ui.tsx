import { STAR_PATH } from "./icons";

export function Stars({ n, size = 14 }: { n: number; size?: number }) {
  return (
    <span className="stars-s" role="img" aria-label={`${n} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" aria-hidden>
          <path className={i <= n ? "s-on" : "s-off"} d={STAR_PATH} />
        </svg>
      ))}
    </span>
  );
}

export function initials(name: string): string {
  const words = name.replace(/&/g, " ").split(/\s+/).filter(Boolean);
  return (words.length === 1 ? words[0].slice(0, 2) : words.slice(0, 3).map((w) => w[0]).join("")).toUpperCase();
}

export function BusinessLogo({ businessId, name, logoVersion, color, size = 38 }: { businessId: string; name: string; logoVersion: number; color: string; size?: number }) {
  return (
    <div className="logo" style={{ background: color, width: size, height: size }} aria-hidden>
      {logoVersion > 0 ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/logo/${businessId}?v=${logoVersion}`} alt="" width={size} height={size} />
      ) : (
        initials(name)
      )}
    </div>
  );
}

export function Mark() {
  return (
    <div className="mark">
      <div className="mark-glyph" aria-hidden>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d={STAR_PATH} /></svg>
      </div>
      <div>
        <div className="mark-name">Smart Review Platform</div>
        <div className="mark-sub">by Synergy Technologies</div>
      </div>
    </div>
  );
}
