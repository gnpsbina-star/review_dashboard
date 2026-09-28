import { switchOrg } from "@/app/dashboard/actions";

export function OrgSwitcher({ current, options }: { current: string; options: { orgId: string; orgName: string }[] }) {
  return (
    <form action={switchOrg} className="toolbar">
      <label className="sr-only" htmlFor="org-switch">Client account</label>
      <select id="org-switch" name="orgId" className="select" defaultValue={current}>
        {options.map((o) => (
          <option key={o.orgId} value={o.orgId}>{o.orgName}</option>
        ))}
      </select>
      <button className="btn-ghost btn-sm" type="submit">Switch</button>
    </form>
  );
}
