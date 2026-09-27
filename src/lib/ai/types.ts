export type Lang = "en" | "hi" | "hinglish";
export type ProviderName = "GEMINI" | "ANTHROPIC" | "OPENAI" | "MOCK";

export interface BranchProfile {
  businessName: string;
  branchName: string;
  cityArea: string;
  category: string;
  highlights: string[];
  tone: string;
}

export interface GenerateRequest {
  profile: BranchProfile;
  language: Lang;
  ratingTier: 4 | 5;
  count: number;
}

export interface AiProvider {
  name: ProviderName;
  /** Returns raw candidate texts; callers validate them. */
  generate(prompt: string): Promise<string[]>;
}
