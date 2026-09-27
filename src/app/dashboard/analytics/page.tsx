import type { Metadata } from "next";
import Link from "next/link";
import { LineChart } from "@/components/dashboard/LineChart";
import { requireAccess, reviewScope, type Access } from "@/lib/access";
import { db } from "@/lib/db";
import { shortDate } from "@/lib/format";
import { Prisma } from "@/generated/prisma/client";

export const metadata: Metadata = { title: "Analytics" };
const DAY = 86_400_000;
const RANGES = { "7": 7, "30": 30, "90": 90 } as const;

async function loadAnalytics(a: Access, days: number) {
  const now = Date.now();
  const since = new Date(now - days * DAY);
  const prevSince = new Date(now - 2 * days * DAY);
  const scope = { ...reviewScope(a), createdAt: { gte: since } };
  const branchFilter = a.branchIds ? Prisma.sql`AND "branchId" IN (${Prisma.join(a.branchIds.length ? a.branchIds : ["-"])})` : Prisma.empty;

  const [agg, prevAgg, mix, google, complaints, fastResolved, weekly, byStaff, staffComplaints, byBranch, branchComplaints] = await Promise.all([
    db.review.aggregate({ where: scope, _avg: { rating: true }, _count: true }),
    db.review.aggregate({ where: { ...reviewScope(a), createdAt: { gte: prevSince, lt: since } }, _avg: { rating: true } }),
    db.review.groupBy({ by: ["rating"], where: scope, _count: true }),
    db.review.count({ where: { ...scope, source: "GOOGLE_REDIRECT" } }),
    db.review.count({ where: { ...scope, source: "INTERCEPTED" } }),
    db.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*)::bigint AS n FROM "Review" WHERE "organizationId" = ${a.org.id} AND "archivedAt" IS NULL AND source = 'INTERCEPTED' AND "createdAt" >= ${since} AND "resolvedAt" IS NOT NULL AND "resolvedAt" - "createdAt" <= interval '24 hours' ${branchFilter}`,
    db.$queryRaw<{ week: Date; avg: number; n: bigint }[]>`SELECT date_trunc('week', "createdAt" AT TIME ZONE 'Asia/Kolkata') AS week, AVG(rating)::float AS avg, COUNT(*)::bigint AS n FROM "Review" WHERE "organizationId" = ${a.org.id} AND "archivedAt" IS NULL AND "createdAt" >= ${new Date(now - Math.max(days, 56) * DAY)} ${branchFilter} GROUP BY 1 ORDER BY 1`,
    db.review.groupBy({ by: ["staffId", "branchId"], where: { ...scope, staffId: { not: null } }, _count: true, _avg: { rating: true } }),
    db.review.groupBy({ by: ["staffId"], where: { ...scope, staffId: { not: null }, source: "INTERCEPTED" }, _count: true }),
    db.review.groupBy({ by: ["branchId"], where: scope, _count: true, _avg: { rating: true } }),
    db.review.groupBy({ by: ["branchId"], where: { ...scope, source: "INTERCEPTED" }, _count: true }),
  ]);

  const [staff, branches] = await Promise.all([
    db.staff.findMany({ where: { organizationId: a.org.id, id: { in: byStaff.map((s) => s.staffId!) } }, select: { id: true, name: true } }),
    db.branch.findMany({ where: { organizationId: a.org.id, id: { in: byBranch.map((b) => b.branchId) } }, select: { id: true, name: true, business: { select: { name: true } } } }),
  ]);
  return { agg, prevAgg, mix, google, complaints, fast: Number(fastResolved[0]?.n ?? 0), weekly, byStaff, staffComplaints, byBranch, branchComplaints, staff, branches };
}

export default async function AnalyticsPage(props: PageProps<"/dashboard/analytics">) {
  const a = await requireAccess();
  const sp = await props.searchParams;
  const key = (typeof sp.range === "string" && sp.range in RANGES ? sp.range : "30") as keyof typeof RANGES;
  const days = RANGES[key];
  const d = await loadAnalytics(a, days);

  const total = d.agg._count;
  const avg = d.agg._avg.rating;
  const prev = d.prevAgg._avg.rating;
  const delta = avg && prev ? avg - prev : null;
  const counts = [5, 4, 3, 2, 1].map((st) => ({ st, n: d.mix.find((m) => m.rating === st)?._count ?? 0 }));
  const maxCount = Math.max(1, ...counts.map((c) => c.n));
  const points = d.weekly.map((w) => ({ label: shortDate(new Date(w.week)).replace(/ \d{4}$/, ""), value: w.avg, count: Number(w.n) }));
  const staffName = new Map(d.staff.map((s) => [s.id, s.name]));
  const branchName = new Map(d.branches.map((b) => [b.id, `${b.business.name} · ${b.name}`]));
  const staffRows = d.byStaff
    .map((s) => ({ name: staffName.get(s.staffId!) ?? "Former staff", branch: branchName.get(s.branchId) ?? "", n: s._count, avg: s._avg.rating ?? 0, complaints: d.staffComplaints.find((c) => c.staffId === s.staffId)?._count ?? 0 }))
    .sort((x, y) => y.n - x.n);
  const branchRows = d.byBranch
    .map((b) => ({ name: branchName.get(b.branchId) ?? "", n: b._count, avg: b._avg.rating ?? 0, complaints: d.branchComplaints.find((c) => c.branchId === b.branchId)?._count ?? 0 }))
    .sort((x, y) => y.n - x.n);

  return (
    <>
      <div className="mhead">
        <div>
          <h1>Analytics</h1>
          <div className="who">{a.branchIds ? "Your assigned branches" : "All businesses and branches"}</div>
        </div>
        <div className="seg" role="group" aria-label="Date range">
          {(Object.keys(RANGES) as (keyof typeof RANGES)[]).map((k) => (
            <Link key={k} href={`/dashboard/analytics?range=${k}`} aria-current={k === key}>{k} days</Link>
          ))}
        </div>
      </div>

      <div className="stats">
        <div className="stat">
          <span className="stat-l">Average rating</span>
          <span className="stat-v">{avg ? avg.toFixed(1) : "–"}</span>
          <span className="stat-d">{delta === null ? `Last ${days} days` : `${delta >= 0 ? "▲" : "▼"} ${Math.abs(delta).toFixed(1)} vs previous ${days} days`}</span>
        </div>
        <div className="stat"><span className="stat-l">Ratings received</span><span className="stat-v">{total}</span><span className="stat-d">Across all QR codes</span></div>
        <div className="stat"><span className="stat-l">Sent to Google</span><span className="stat-v">{d.google}</span><span className="stat-d">Tapped Copy &amp; post or Write my own</span></div>
        <div className="stat">
          <span className="stat-l">Complaints resolved in 24 h</span>
          <span className="stat-v">{d.complaints ? `${Math.round((d.fast / d.complaints) * 100)}%` : "–"}</span>
          <span className="stat-d">{d.complaints} {d.complaints === 1 ? "complaint" : "complaints"} in this period</span>
        </div>
      </div>

      <div className="grid2">
        <section className="panel">
          <h3>Ratings by stars</h3>
          <p className="cap">Last {days} days · {total} ratings</p>
          <div className="bars">
            {counts.map((c) => (
              <div key={c.st} className="bar-row" title={`${c.st}★: ${c.n} ratings`}>
                <span>{c.st}★</span>
                <div><div className="bar" style={{ width: `${((c.n / maxCount) * 100).toFixed(1)}%` }} /></div>
                <span className="bar-val">{c.n} · {total ? Math.round((c.n / total) * 100) : 0}%</span>
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <h3>Average rating by week</h3>
          <p className="cap">Hover a week for its value</p>
          <LineChart points={points} />
        </section>
      </div>

      <section className="panel">
        <h3>By staff member</h3>
        <p className="cap">From staff QR codes, last {days} days</p>
        {staffRows.length ? (
          <div className="tscroll">
            <table className="t">
              <thead><tr><th>Staff</th><th>Branch</th><th className="r">Ratings</th><th className="r">Avg rating</th><th className="r">Complaints</th></tr></thead>
              <tbody>{staffRows.map((s, i) => <tr key={i}><td><b>{s.name}</b></td><td>{s.branch}</td><td className="r">{s.n}</td><td className="r">{s.avg.toFixed(1)}</td><td className="r">{s.complaints}</td></tr>)}</tbody>
            </table>
          </div>
        ) : (
          <p className="muted">No ratings from staff QR codes yet. Create staff codes in the QR studio.</p>
        )}
      </section>

      <section className="panel">
        <h3>By branch</h3>
        <div className="tscroll">
          <table className="t">
            <thead><tr><th>Branch</th><th className="r">Ratings</th><th className="r">Avg rating</th><th className="r">Complaints</th></tr></thead>
            <tbody>{branchRows.map((b, i) => <tr key={i}><td><b>{b.name}</b></td><td className="r">{b.n}</td><td className="r">{b.avg.toFixed(1)}</td><td className="r">{b.complaints}</td></tr>)}</tbody>
          </table>
        </div>
      </section>
    </>
  );
}
