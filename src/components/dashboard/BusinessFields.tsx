export function BusinessFields({ b }: { b?: { name: string; category: string; address: string | null; brandColor: string; brandTone: string; deviceLimitHours: number } }) {
  return (
    <div className="form-grid">
      <div className="field"><label htmlFor="b-name">Business name</label><input id="b-name" name="name" required maxLength={80} defaultValue={b?.name} /></div>
      <div className="field"><label htmlFor="b-cat">Category</label><input id="b-cat" name="category" required maxLength={80} placeholder="Family restaurant, Dental clinic, Gym…" defaultValue={b?.category} /></div>
      <div className="field full"><label htmlFor="b-addr">Address <span className="opt">(optional)</span></label><input id="b-addr" name="address" maxLength={200} defaultValue={b?.address ?? ""} /></div>
      <div className="field"><label htmlFor="b-color">Brand colour</label><input id="b-color" name="brandColor" type="color" defaultValue={b?.brandColor ?? "#0E6B63"} style={{ height: 42, padding: 4 }} /><span className="help">Pale colours are darkened automatically so text stays readable.</span></div>
      <div className="field"><label htmlFor="b-tone">Brand tone</label>
        <select id="b-tone" name="brandTone" defaultValue={b?.brandTone ?? "Warm and friendly"}>
          {["Warm and friendly", "Casual and cheerful", "Family-friendly", "Premium and elegant", "Professional and caring"].map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>
      {b && (
        <div className="field"><label htmlFor="b-limit">Anti-spam limit (hours)</label><input id="b-limit" name="deviceLimitHours" type="number" min={1} max={24} defaultValue={b.deviceLimitHours} /><span className="help">One complaint per phone within this time.</span></div>
      )}
    </div>
  );
}
