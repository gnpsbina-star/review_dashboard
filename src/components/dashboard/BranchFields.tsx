import { HIGHLIGHT_EXAMPLES, type BusinessType } from "@/lib/business-type";

export function BranchFields({ br, type }: { br?: { name: string; cityArea: string; googleReviewUrl: string; googlePlaceId: string | null; facebookReviewUrl?: string | null; languages: string[]; highlights: string[]; floatingHelper: boolean }; type: BusinessType }) {
  const langs = br?.languages ?? ["en", "hi", "hinglish"];
  return (
    <div className="form-grid">
      <div className="field"><label htmlFor="br-name">Branch name</label><input id="br-name" name="name" required maxLength={60} placeholder="Indiranagar" defaultValue={br?.name} /></div>
      <div className="field"><label htmlFor="br-area">City &amp; area</label><input id="br-area" name="cityArea" required maxLength={100} placeholder="Indiranagar, Bengaluru" defaultValue={br?.cityArea} /></div>
      <div className="field full">
        <label htmlFor="br-url">Google review link</label>
        <input id="br-url" name="googleReviewUrl" type="url" required maxLength={500} placeholder="https://g.page/r/…/review" defaultValue={br?.googleReviewUrl} />
        <span className="help">In Google Business Profile, choose “Ask for reviews” and copy the link (it starts with g.page/r/). It opens the Google Maps app on phones. Only Google links are accepted.</span>
      </div>
      <div className="field full">
        <label htmlFor="br-fb">Facebook page link <span className="opt">(optional)</span></label>
        <input id="br-fb" name="facebookReviewUrl" type="url" maxLength={500} placeholder="https://www.facebook.com/yourpage/reviews" defaultValue={br?.facebookReviewUrl ?? ""} />
        <span className="help">Adds “Also share on Facebook” for happy customers. Use your page’s Reviews link. Only Facebook links are accepted.</span>
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
        <input id="br-hl" name="highlights" maxLength={220} placeholder={HIGHLIGHT_EXAMPLES[type]} defaultValue={br?.highlights.join(", ")} />
        <span className="help">The AI mentions only these, so suggestions never invent things you don’t offer.</span>
      </div>
      <div className="field full">
        <label className="check"><input type="checkbox" name="floatingHelper" defaultChecked={br?.floatingHelper ?? true} /> Floating review helper <span className="opt">(trial)</span></label>
        <span className="help">When a happy customer goes to Google, their copied review floats in a small window on top, with “Tap the review box → Paste → Post”. Works on most iPhones and computers; on Android it needs the g.page/r/ link above so Google opens in the Maps app.</span>
      </div>
    </div>
  );
}
