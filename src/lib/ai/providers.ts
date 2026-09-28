import "server-only";
import { env } from "@/lib/env";
import { parseJsonArray } from "./validate";
import type { AiProvider, ProviderName } from "./types";

const TIMEOUT = 45_000;

async function postJson(url: string, headers: Record<string, string>, body: unknown): Promise<unknown> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!res.ok) throw new Error(`AI provider returned HTTP ${res.status}`);
  return res.json();
}

function gemini(apiKey: string, model: string): AiProvider {
  return {
    name: "GEMINI",
    async generate(prompt) {
      const data = (await postJson(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        { "x-goog-api-key": apiKey },
        { contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", temperature: 1 } },
      )) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
      return parseJsonArray(text);
    },
  };
}

function anthropic(apiKey: string, model: string): AiProvider {
  return {
    name: "ANTHROPIC",
    async generate(prompt) {
      const data = (await postJson(
        "https://api.anthropic.com/v1/messages",
        { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        { model, max_tokens: 8000, messages: [{ role: "user", content: prompt }] },
      )) as { content?: { type: string; text?: string }[] };
      const text = data.content?.filter((c) => c.type === "text").map((c) => c.text ?? "").join("") ?? "";
      return parseJsonArray(text);
    },
  };
}

function openai(apiKey: string, model: string): AiProvider {
  return {
    name: "OPENAI",
    async generate(prompt) {
      const data = (await postJson(
        "https://api.openai.com/v1/chat/completions",
        { Authorization: `Bearer ${apiKey}` },
        { model, messages: [{ role: "user", content: prompt }] },
      )) as { choices?: { message?: { content?: string } }[] };
      return parseJsonArray(data.choices?.[0]?.message?.content ?? "");
    },
  };
}

/** Returns the configured provider, or null when its API key is missing (templates are used instead). */
export function getProvider(name: ProviderName): AiProvider | null {
  const e = env();
  if (name === "GEMINI" && e.GEMINI_API_KEY) return gemini(e.GEMINI_API_KEY, e.GEMINI_MODEL);
  if (name === "ANTHROPIC" && e.ANTHROPIC_API_KEY) return anthropic(e.ANTHROPIC_API_KEY, e.ANTHROPIC_MODEL);
  if (name === "OPENAI" && e.OPENAI_API_KEY) return openai(e.OPENAI_API_KEY, e.OPENAI_MODEL);
  return null;
}

export function providerHasKey(name: ProviderName): boolean {
  const e = env();
  return (
    (name === "GEMINI" && !!e.GEMINI_API_KEY) ||
    (name === "ANTHROPIC" && !!e.ANTHROPIC_API_KEY) ||
    (name === "OPENAI" && !!e.OPENAI_API_KEY) ||
    name === "MOCK"
  );
}
