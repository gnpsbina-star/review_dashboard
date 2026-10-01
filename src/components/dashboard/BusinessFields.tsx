import { BUSINESS_TYPES, businessTypeOf, TYPE_LABELS, type BusinessType } from "@/lib/business-type";
import { defaultHeadline } from "@/lib/card-text";

type B = {
  name: string;
  type: BusinessType | null;
  category: string;
  address: string | null;
  brandColor: string;
  brandTone: string;
  deviceLimitHours: number;
  qrHeadline: string | null;
  qrHeadlineHi: string | null;
};

export function BusinessFields({ b }: { b?: B }) {
  const type = b ? businessTypeOf(b) : undefined;
  return (
    <div className="form-grid">
      <div className="field"><label htmlFor="b-name">Business name</label><input id="b-name" name="name" required maxLength={80} defaultValue={b?.name} /></div>
      <div className="field">
        <label htmlFor="b-type">Type of business</label>
        <select id="b-type" name="type" required defaultValue={type ?? ""}>
          {!type && <option value="" disabled>Choose…</option>}
          {BUSINESS_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
        </select>
        <span className="help">Review suggestions, complaint topics and QR cards are worded for this type.</span>
      </div>
      <div className="field full">
        <label htmlFor="b-cat">Describe it in a few words <span className="opt">(optional)</span></label>
        <input id="b-cat" name="category" maxLength={80} placeholder="CBSE school, NEET coaching, Dental clinic, South Indian restaurant…" defaultValue={b && b.category !== TYPE_LABELS[businessTypeOf(b)] ? b.category : ""} />
        <span className="help">Helps the AI write more specific suggestions.</span>
      </div>
      <div className="field full"><label htmlFor="b-addr">Address <span className="opt">(optional)</span></label><input id="b-addr" name="address" maxLength={200} defaultValue={b?.address ?? ""} /></div>
      <div className="field"><label htmlFor="b-color">Brand colour</label><input id="b-color" name="brandColor" type="color" defaultValue={b?.brandColor ?? "#0E6B63"} style={{ height: 42, padding: 4 }} /><span className="help">Pale colours are darkened automatically so text stays readable.</span></div>
      <div className="field"><label htmlFor="b-tone">Brand tone</label>
        <select id="b-tone" name="brandTone" defaultValue={b?.brandTone ?? "Warm and friendly"}>
          {["Warm and friendly", "Casual and cheerful", "Family-friendly", "Premium and elegant", "Professional and caring"].map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>
      {b && (
        <>
          <div className="field"><label htmlFor="b-limit">Anti-spam limit (hours)</label><input id="b-limit" name="deviceLimitHours" type="number" min={1} max={24} defaultValue={b.deviceLimitHours} /><span className="help">One complaint per phone within this time.</span></div>
          <div className="field full">
            <label htmlFor="b-qrh">QR card headline <span className="opt">(optional)</span></label>
            <input id="b-qrh" name="qrHeadline" maxLength={60} placeholder={defaultHeadline(type!).en} defaultValue={b.qrHeadline ?? ""} />
          </div>
          <div className="field full">
            <label htmlFor="b-qrhi">Hindi line under the headline <span className="opt">(optional)</span></label>
            <input id="b-qrhi" name="qrHeadlineHi" maxLength={60} lang="hi" placeholder={defaultHeadline(type!).hi} defaultValue={b.qrHeadlineHi ?? ""} />
            <span className="help">Printed on table and counter cards. Staff cards use a personal line, like “How was your class with Mrs. Sharma?”.</span>
          </div>
        </>
      )}
    </div>
  );
}
