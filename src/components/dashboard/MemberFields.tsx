export function MemberFields({ idPrefix, branches, role = "BRANCH_ADMIN", assigned = [], alerts = false }: { idPrefix: string; branches: { id: string; label: string }[]; role?: string; assigned?: string[]; alerts?: boolean }) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <fieldset className="toolbar" style={{ border: 0, padding: 0, margin: 0, gap: 14 }}>
        <legend className="sr-only">Role</legend>
        <label className="check"><input type="radio" name="role" value="BRANCH_ADMIN" defaultChecked={role === "BRANCH_ADMIN"} /> Branch Admin <span className="help">replies to reviews at chosen branches</span></label>
        <label className="check"><input type="radio" name="role" value="CLIENT_OWNER" defaultChecked={role === "CLIENT_OWNER"} /> Client Owner <span className="help">full control</span></label>
      </fieldset>
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="help" style={{ marginBottom: 6 }}>Branches (for Branch Admins)</legend>
        <div className="toolbar" style={{ gap: 14 }}>
          {branches.map((b) => (
            <label key={b.id} className="check" htmlFor={`${idPrefix}-${b.id}`}><input id={`${idPrefix}-${b.id}`} type="checkbox" name="branchIds" value={b.id} defaultChecked={assigned.includes(b.id)} /> {b.label}</label>
          ))}
        </div>
      </fieldset>
      <label className="check"><input type="checkbox" name="receiveAllAlerts" defaultChecked={alerts} /> Client Owner: email me about every complaint</label>
    </div>
  );
}
