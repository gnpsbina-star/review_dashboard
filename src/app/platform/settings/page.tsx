import { Flash } from "@/components/dashboard/Flash";
import { setProvider } from "../actions";
import { requirePlatformOwner } from "@/lib/access";
import { providerHasKey } from "@/lib/ai/providers";
import { env } from "@/lib/env";
import { AI_PROVIDERS, getAiProviderName } from "@/lib/settings";

const LABEL = { GEMINI: "Google Gemini", ANTHROPIC: "Anthropic Claude", OPENAI: "OpenAI ChatGPT", MOCK: "Built-in templates (no AI)" } as const;

export default async function PlatformSettings(props: PageProps<"/platform/settings">) {
  await requirePlatformOwner();
  const sp = await props.searchParams;
  const current = await getAiProviderName();
  const e = env();
  const model = { GEMINI: e.GEMINI_MODEL, ANTHROPIC: e.ANTHROPIC_MODEL, OPENAI: e.OPENAI_MODEL, MOCK: "–" } as const;
  return (
    <>
      <div className="mhead"><div><h1>AI &amp; settings</h1><div className="who">Applies to every client</div></div></div>
      <Flash sp={sp} />
      <form action={setProvider} className="panel" style={{ maxWidth: 720 }}>
        <h3>Who writes the review suggestions</h3>
        <p className="cap">Suggestions are written in the background (weekly, and when a branch’s settings change), so switching never slows the customer page.</p>
        <div style={{ display: "grid", gap: 10 }}>
          {AI_PROVIDERS.map((p) => {
            const ready = providerHasKey(p);
            return (
              <label key={p} className="check" style={{ alignItems: "flex-start" }}>
                <input type="radio" name="provider" value={p} defaultChecked={current === p} style={{ marginTop: 3 }} />
                <span><b>{LABEL[p]}</b> <span className="help">· model {model[p]} · {ready ? "API key set" : "API key missing: templates are used instead"}</span></span>
              </label>
            );
          })}
        </div>
        <button className="btn" type="submit" style={{ justifySelf: "start" }}>Save</button>
        <p className="help">API keys are set in the hosting environment (GEMINI_API_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY), never in the database.</p>
      </form>
    </>
  );
}
