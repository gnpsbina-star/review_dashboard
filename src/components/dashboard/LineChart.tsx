"use client";

import { useRef, useState } from "react";

const W = 560, H = 220, L = 40, R = 24, T = 18, B = 30;

/** Weekly average rating, drawn on a fixed 1–5 scale window with hover read-out. */
export function LineChart({ points }: { points: { label: string; value: number; count: number }[] }) {
  const ref = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  if (points.length === 0) return <p className="muted">Not enough ratings yet.</p>;
  const values = points.map((p) => p.value);
  const min = Math.max(1, Math.floor(Math.min(...values) * 2) / 2 - 0.5);
  const max = 5;
  const n = points.length;
  const x = (i: number) => (n === 1 ? (L + W - R) / 2 : L + (i * (W - L - R)) / (n - 1));
  const y = (v: number) => T + ((max - v) / (max - min)) * (H - T - B);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(" ");
  const area = `${line} L${x(n - 1).toFixed(1)} ${y(min)} L${x(0).toFixed(1)} ${y(min)} Z`;
  const ticks = [min, (min + max) / 2, max];
  const active = hover ?? n - 1;

  function move(e: React.PointerEvent<SVGSVGElement>) {
    const r = ref.current!.getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * W;
    const i = n === 1 ? 0 : Math.round((sx - L) / ((W - L - R) / (n - 1)));
    setHover(Math.max(0, Math.min(n - 1, i)));
  }

  return (
    <div className="chart-wrap">
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Average rating by week, latest ${values[n - 1].toFixed(2)}`} onPointerMove={move} onPointerLeave={() => setHover(null)}>
        {ticks.map((v) => (
          <g key={v}>
            <line className="grid-line" x1={L} x2={W - R} y1={y(v)} y2={y(v)} />
            <text className="axis-t" x={L - 8} y={y(v) + 4} textAnchor="end">{v.toFixed(1)}</text>
          </g>
        ))}
        {points.map((p, i) =>
          i % Math.ceil(n / 5) === 0 || i === n - 1 ? (
            <text key={p.label} className="axis-t" x={x(i)} y={H - 8} textAnchor="middle">{p.label}</text>
          ) : null,
        )}
        <path d={area} fill="var(--accent)" fillOpacity={0.1} />
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {hover !== null && <line x1={x(active)} x2={x(active)} y1={T} y2={y(min)} stroke="var(--line-strong)" />}
        <circle cx={x(active)} cy={y(values[active])} r={5} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2} />
        {hover === null && (
          <text className="axis-t" x={x(n - 1) - 8} y={y(values[n - 1]) - 12} textAnchor="end" style={{ fill: "var(--ink)", fontWeight: 700 }}>
            {values[n - 1].toFixed(2)}
          </text>
        )}
      </svg>
      {hover !== null && (
        <div className="tip" style={{ left: `${(x(active) / W) * 100}%`, top: `${(y(values[active]) / H) * 100}%` }}>
          Week of {points[active].label}: {values[active].toFixed(2)}★ · {points[active].count} ratings
        </div>
      )}
    </div>
  );
}
