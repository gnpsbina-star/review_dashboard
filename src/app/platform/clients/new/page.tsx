import Link from "next/link";
import { createClient } from "../../actions";
import { requirePlatformOwner } from "@/lib/access";

export default async function NewClient(props: PageProps<"/platform/clients/new">) {
  await requirePlatformOwner();
  const sp = await props.searchParams;
  return (
    <>
      <div className="mhead"><div><Link className="help" href="/platform">← Client accounts</Link><h1>New client</h1></div></div>
      {sp.error && <div className="flash error" role="alert">Check the details: name, a valid owner email and a branch limit are required.</div>}
      <form action={createClient} className="panel" style={{ maxWidth: 720 }}>
        <div className="form-grid">
          <div className="field full"><label htmlFor="c-name">Client name</label><input id="c-name" name="name" required maxLength={100} placeholder="Kesar Hospitality" /></div>
          <div className="field full"><label htmlFor="c-email">Owner’s Google email</label><input id="c-email" name="ownerEmail" type="email" required maxLength={200} /><span className="help">They become the Client Owner and can invite their team.</span></div>
          <div className="field"><label htmlFor="c-plan">Plan name</label><input id="c-plan" name="planName" required maxLength={40} defaultValue="Starter" /></div>
          <div className="field"><label htmlFor="c-max">Branch limit</label><input id="c-max" name="maxBranches" type="number" min={1} max={500} required defaultValue={2} /></div>
          <fieldset className="field full" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="label" style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>Start with</legend>
            <label className="check"><input type="radio" name="start" value="trial" defaultChecked /> Free trial for <input name="trialDays" type="number" min={1} max={60} defaultValue={14} className="input" style={{ width: 80, minHeight: 34 }} /> days</label>
            <label className="check"><input type="radio" name="start" value="paid" /> Paid yearly plan starting today</label>
          </fieldset>
        </div>
        <button className="btn" type="submit" style={{ justifySelf: "start" }}>Create client</button>
      </form>
    </>
  );
}
