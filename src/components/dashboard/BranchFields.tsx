export function BranchFields({ br }: { br?: { name: string; cityArea: string; googleReviewUrl: string; googlePlaceId: string | null; languages: string[]; highlights: string[] } }) {
  const langs = br?.languages ?? ["en", "hi", "hinglish"];
  return (
    <div className="form-grid">
      <div className="field"><label htmlFor="br-name">Branch name</label><input id="br-name" name="name" required maxLength={60} placeholder="Indiranagar" defaultValue={br?.name} /></div>
      <div className="field"><label htmlFor="br-area">City &amp; area</label><input id="br-area" name="cityArea" required maxLength={100} placeholder="Indiranagar, Bengaluru" defaultValue={br?.cityArea} /></div>
      <div className="field full">
        <label htmlFor="br-url">Google review link</label>
        <input id="br-url" name="googleReviewUrl" type="url" required maxLength={500} placeholder="https://search.google.com/local/writereview?placeid=…" defaultValue={br?.googleReviewUrl} />
        <span className="help">In Google Business Profile, choose “Ask for reviews” and copy the link. Only Google links are accepted.</span>
      </div>
      <div className="field"><label htmlFor="br-place">Google Place ID <span className="opt">(optional)</span></label><input id="br-place" name="googlePlaceId" maxLength={200} defaultValue={br?.googlePlaceId ?? ""} /></div>
      <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="label" style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>Suggestion languages</legend>
        <div className="toolbar" style={{ gap: 14 }}>
          {[["en", "English"], ["hi", "Hindi"], ["hinglish", "Hinglish"]].map(([v, l]) => (
            <label key={v} className="check"><input type="checkbox" name="languages" value={v} defaultChecked={langs.includes(v)} /> {l}</label>
          ))}
        </div>
      </fieldset>
      <div className="field full">
        <label htmlFor="br-hl">Top highlights (3 to 5, separated by commas)</label>
        <input id="br-hl" name="highlights" maxLength={220} placeholder="Filter coffee, Paneer tikka, Polite staff, Fast service" defaultValue={br?.highlights.join(", ")} />
        <span className="help">The AI mentions only these, so suggestions never invent things you don’t offer.</span>
      </div>
    </div>
  );
}
