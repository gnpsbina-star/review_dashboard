import Link from "next/link";
import { ContactActions } from "@/components/dashboard/ContactActions";
import { IconBack } from "@/components/icons";
import { Stars } from "@/components/ui";
import { addNote, archiveReview, deleteReview, restoreReview, setReviewStatus } from "./actions";
import { requireAccess, reviewScope, type Access } from "@/lib/access";
import { decryptField } from "@/lib/crypto";
import { db } from "@/lib/db";
import { exactTime, relativeTime, titleCase } from "@/lib/format";
import type { Prisma } from "@/generated/prisma/client";

const PAGE = 30;
const DAY = 86_400_000;

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

function href(sp: SP, patch: Record<string, string | undefined>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...sp, ...patch })) if (typeof v === "string" && v) q.set(k, v);
  const s = q.toString();
  return s ? `/dashboard?${s}` : "/dashboard";
}

export default async function ReviewsPage(props: PageProps<"/dashboard">) {
  const a = await requireAccess();
  const sp = await props.searchParams;
  const type = one(sp.type);
  const status = one(sp.status);
  const biz = one(sp.biz);
  const archivedView = one(sp.view) === "archived" && a.role === "CLIENT_OWNER";
  const before = one(sp.before);
  const selectedId = one(sp.review);

  const { rows, businesses, newCount, escalatedCount, avg, google30 } = await loadFeed(a, { type, status, biz, archivedView, before });
  const hasMore = rows.length > PAGE;
  const list = rows.slice(0, PAGE);
  const selected = selectedId ? await loadDetail(a, selectedId, archivedView) : null;
  const showDetail = !!selected;

  return (
    <>
      <div className="mhead">
        <div>
          <h1>{archivedView ? "Archived reviews" : "Reviews"}</h1>
          <div className="who">{a.branchIds ? "Your assigned branches" : "All businesses and branches"} · newest first</div>
        </div>
        {a.role === "CLIENT_OWNER" && (
          <Link className="btn-ghost btn-sm" href={archivedView ? "/dashboard" : "/dashboard?view=archived"}>
            {archivedView ? "Back to reviews" : "View archived"}
          </Link>
        )}
      </div>

      {one(sp.archived) && (
        <div className="banner info" role="status">
          <span>Review archived. It’s hidden from the feed but kept for your records.</span>
          <form action={restoreReview}><input type="hidden" name="reviewId" value={one(sp.archived)} /><button className="btn-ghost btn-sm" type="submit">Undo</button></form>
        </div>
      )}
      {one(sp.deleted) && <div className="banner info" role="status"><span>Review permanently deleted.</span></div>}

      {!archivedView && (
        <div className="stats">
          <div className="stat"><span className="stat-l">New complaints</span><span className={`stat-v ${newCount ? "crit" : ""}`}>{newCount}</span><span className="stat-d">Waiting for a reply</span></div>
          <div className="stat"><span className="stat-l">Waiting over 1 day</span><span className={`stat-v ${escalatedCount ? "crit" : ""}`}>{escalatedCount}</span><span className="stat-d">Owners are alerted</span></div>
          <div className="stat"><span className="stat-l">Average rating</span><span className="stat-v">{avg._avg.rating ? avg._avg.rating.toFixed(1) : "–"}</span><span className="stat-d">Last 30 days</span></div>
          <div className="stat"><span className="stat-l">Sent to Google</span><span className="stat-v">{google30}</span><span className="stat-d">Last 30 days</span></div>
        </div>
      )}

      <div className="filters">
        <div className="seg" role="group" aria-label="Type">
          <Link href={href(sp, { type: undefined, before: undefined, review: undefined })} aria-current={!type}>All</Link>
          <Link href={href(sp, { type: "private", before: undefined, review: undefined })} aria-current={type === "private"}>Private complaints</Link>
          <Link href={href(sp, { type: "google", status: undefined, before: undefined, review: undefined })} aria-current={type === "google"}>Sent to Google</Link>
        </div>
        <form className="toolbar" action="/dashboard">
          {type && <input type="hidden" name="type" value={type} />}
          {archivedView && <input type="hidden" name="view" value="archived" />}
          <label className="sr-only" htmlFor="f-status">Status</label>
          <select id="f-status" name="status" className="select" defaultValue={status ?? ""}>
            <option value="">Any status</option>
            <option value="NEW">New</option>
            <option value="CONTACTED">Contacted</option>
            <option value="RESOLVED">Resolved</option>
          </select>
          {businesses.length > 1 && (
            <>
              <label className="sr-only" htmlFor="f-biz">Business</label>
              <select id="f-biz" name="biz" className="select" defaultValue={biz ?? ""}>
                <option value="">All businesses</option>
                {businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </>
          )}
          <button className="btn-ghost btn-sm" type="submit">Apply</button>
        </form>
      </div>

      <div className={`split ${showDetail ? "has-detail" : ""}`}>
        <div className="feed" aria-label="Reviews, newest first">
          {list.length === 0 && (
            <div className="placeholder">
              <b>{archivedView ? "Nothing archived." : type || status || biz ? "No reviews match these filters." : "No reviews yet."}</b>
              {!archivedView && !type && !status && !biz && <span className="muted">When customers scan your QR codes, their ratings show up here.</span>}
            </div>
          )}
          {list.map((r) => (
            <Link key={r.id} className="row" href={href(sp, { review: r.id })} scroll={false} aria-current={r.id === selected?.review.id}>
              <div className="row-top">
                <Stars n={r.rating} />
                {r.source === "INTERCEPTED" ? (
                  <>
                    <span className="badge private">Private complaint</span>
                    {r.status && <span className={`pill ${r.status}`}>{titleCase(r.status)}</span>}
                    {r.status === "NEW" && r.escalatedAt && <span className="pill esc">Escalated</span>}
                  </>
                ) : (
                  <span className="badge google">Sent to Google</span>
                )}
                <time dateTime={r.createdAt.toISOString()} title={exactTime(r.createdAt)}>{relativeTime(r.createdAt)}</time>
              </div>
              <div className="row-meta">{meta(r.branch.business.name, r.branch.name, r.tableLabel, r.staffName)}</div>
              {r.comment && <p className="row-text">{r.comment}</p>}
            </Link>
          ))}
          {hasMore && (
            <Link className="btn-ghost" href={href(sp, { before: list[list.length - 1].createdAt.toISOString(), review: undefined })}>
              Show older reviews
            </Link>
          )}
        </div>
        {selected ? (
          <Detail a={a} d={selected} backHref={href(sp, { review: undefined })} />
        ) : (
          <div className="detail"><p className="muted">Select a review to see the full message and reply to the customer.</p></div>
        )}
      </div>
    </>
  );
}

async function loadFeed(a: Access, f: { type?: string; status?: string; biz?: string; archivedView: boolean; before?: string }) {
  const { type, status, biz, archivedView, before } = f;
  const scope = reviewScope(a);
  const where: Prisma.ReviewWhereInput = {
    ...scope,
    ...(archivedView ? { archivedAt: { not: null } } : {}),
    ...(type === "private" ? { source: "INTERCEPTED" } : type === "google" ? { source: "GOOGLE_REDIRECT" } : {}),
    ...(status && ["NEW", "CONTACTED", "RESOLVED"].includes(status) ? { source: "INTERCEPTED", status: status as "NEW" } : {}),
    ...(biz ? { branch: { businessId: biz } } : {}),
    ...(before && !Number.isNaN(Date.parse(before)) ? { createdAt: { lt: new Date(before) } } : {}),
  };
  const since30 = new Date(Date.now() - 30 * DAY);

  const [rows, businesses, newCount, escalatedCount, avg, google30] = await Promise.all([
    db.review.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAGE + 1,
      include: { branch: { select: { name: true, business: { select: { name: true } } } } },
    }),
    db.business.findMany({
      where: { organizationId: a.org.id, archivedAt: null, ...(a.branchIds ? { branches: { some: { id: { in: a.branchIds } } } } : {}) },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.review.count({ where: { ...scope, source: "INTERCEPTED", status: "NEW" } }),
    db.review.count({ where: { ...scope, source: "INTERCEPTED", status: "NEW", createdAt: { lt: new Date(Date.now() - DAY) } } }),
    db.review.aggregate({ where: { ...scope, createdAt: { gte: since30 } }, _avg: { rating: true } }),
    db.review.count({ where: { ...scope, source: "GOOGLE_REDIRECT", createdAt: { gte: since30 } } }),
  ]);
  return { rows, businesses, newCount, escalatedCount, avg, google30 };
}

function meta(biz: string, branch: string, table: string | null, staff: string | null) {
  return [biz, branch, table ? `Table ${table}` : null, staff ? `Staff: ${staff}` : null].filter(Boolean).join(" · ");
}

async function loadDetail(a: Access, id: string, archived: boolean) {
  if (!/^[a-z0-9]{10,40}$/.test(id)) return null;
  const review = await db.review.findFirst({
    where: { id, ...reviewScope(a), ...(archived ? { archivedAt: { not: null } } : {}) },
    include: { branch: { include: { business: true } }, notes: { orderBy: { createdAt: "asc" } } },
  });
  if (!review) return null;
  return { review, phone: decryptField(review.customerPhoneEnc), email: decryptField(review.customerEmailEnc) };
}

function Detail({ a, d, backHref }: { a: Access; d: NonNullable<Awaited<ReturnType<typeof loadDetail>>>; backHref: string }) {
  const r = d.review;
  const biz = r.branch.business.name;
  const first = r.customerName?.split(" ")[0] ?? "there";
  const issue = r.issues[0]?.toLowerCase();
  const waTemplate = `Hi ${first}, this is the manager at ${biz}, ${r.branch.name}. We saw your feedback about your visit${r.tableLabel ? ` at Table ${r.tableLabel}` : ""}. We're sorry${issue ? ` about the ${issue} issue` : " it wasn't a good experience"}. We'd like to make this right. Can we call you at a time that suits you?`;
  const followUp =
    r.status === "RESOLVED"
      ? `Hi ${first}, thank you for giving ${biz} the chance to put things right. If you'd like to share your experience, you can review us on Google: ${r.branch.googleReviewUrl}`
      : null;
  const owner = a.role === "CLIENT_OWNER";

  return (
    <section className="detail" aria-label="Review details">
      <Link className="btn-ghost btn-sm only-mobile" href={backHref} style={{ justifySelf: "start" }}><IconBack size={16} /> Back to reviews</Link>
      <div style={{ display: "grid", gap: 6 }}>
        <div className="d-title">
          <Stars n={r.rating} size={20} />
          <strong style={{ fontSize: 17 }}>{r.rating} out of 5</strong>
          {r.source === "INTERCEPTED" ? <span className="badge private">Private complaint</span> : <span className="badge google">Sent to Google</span>}
          {r.status === "NEW" && r.escalatedAt && <span className="pill esc">Escalated to owner</span>}
        </div>
        <div className="d-meta">{meta(biz, r.branch.name, r.tableLabel, r.staffName)}</div>
        <div className="d-meta num">{relativeTime(r.createdAt)} — {exactTime(r.createdAt)}</div>
      </div>

      {r.source === "GOOGLE_REDIRECT" ? (
        <>
          {r.comment ? (
            <>
              <div className="sub-h">Review text the customer copied{r.editedSuggestion ? " (they edited it)" : ""}</div>
              <p className="quote">{r.comment}</p>
            </>
          ) : (
            <p className="muted">The customer chose to write their own review on Google.</p>
          )}
          <div className="info">The customer tapped through to Google. We can’t confirm the review was published until Google review import arrives.</div>
        </>
      ) : (
        <>
          {r.issues.length > 0 && <div className="chips">{r.issues.map((i) => <span key={i} className="lbadge">{i}</span>)}</div>}
          <p className="quote">{r.comment}</p>
          <div className="cust-card">
            {r.customerName ? <b>{r.customerName}</b> : <span>Name not given</span>}
            {d.phone ? <span className="num">+91 {d.phone.slice(0, 5)} {d.phone.slice(5)}</span> : <span>No phone</span>}
            {d.email && <span>{d.email}</span>}
            {r.contactConsent && <span className="okchip">✓ Agreed to be contacted</span>}
            {r.piiPurgedAt && <span className="help">Contact details were deleted after 12 months.</span>}
          </div>
          {!r.archivedAt && (
            <ContactActions
              reviewId={r.id}
              phone={d.phone}
              email={d.email}
              waTemplate={waTemplate}
              emailSubject={`Your feedback about ${biz}, ${r.branch.name}`}
              emailBody={waTemplate.replace("Can we call you", "Can we call you or reply here")}
              followUp={followUp}
            />
          )}
          {!r.archivedAt && (
            <div>
              <div className="sub-h" style={{ marginBottom: 8 }}>Status</div>
              <form action={setReviewStatus} className="seg" aria-label="Status">
                <input type="hidden" name="reviewId" value={r.id} />
                {(["NEW", "CONTACTED", "RESOLVED"] as const).map((s) => (
                  <button key={s} type="submit" name="status" value={s} aria-pressed={r.status === s}>{titleCase(s)}</button>
                ))}
              </form>
            </div>
          )}
          <div>
            <div className="sub-h" style={{ marginBottom: 10 }}>Resolution notes</div>
            {r.notes.length ? (
              <ul className="timeline">
                {r.notes.map((n) => (
                  <li key={n.id}>
                    <span className="avatar" aria-hidden>{n.authorName.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}</span>
                    <div><div style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{n.text}</div><div className="t-meta">{n.authorName} · {relativeTime(n.createdAt)}</div></div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="help">No notes yet.</p>
            )}
            {!r.archivedAt && (
              <form action={addNote} className="field" style={{ marginTop: 12 }}>
                <input type="hidden" name="reviewId" value={r.id} />
                <label className="sr-only" htmlFor="note-in">Add a note</label>
                <textarea id="note-in" name="text" required maxLength={2000} placeholder="What did you do? For example: Called at 10:30, offered a free dessert" style={{ minHeight: 64 }} />
                <button className="btn-ghost" type="submit" style={{ justifySelf: "start" }}>Add note</button>
              </form>
            )}
          </div>
        </>
      )}

      <div className="d-foot">
        <span>Only people with access to {r.branch.name} can see this.</span>
        {owner &&
          (r.archivedAt ? (
            <div className="toolbar">
              <form action={restoreReview}><input type="hidden" name="reviewId" value={r.id} /><button className="btn-ghost btn-sm" type="submit">Restore</button></form>
              <form action={deleteReview}><input type="hidden" name="reviewId" value={r.id} /><button className="btn-danger btn-sm" type="submit">Delete permanently</button></form>
            </div>
          ) : (
            <form action={archiveReview}><input type="hidden" name="reviewId" value={r.id} /><button className="btn-danger btn-sm" type="submit">Archive</button></form>
          ))}
      </div>
    </section>
  );
}
