export type LlmProvider = "groq" | "openai" | "ollama";

export type LlmSelection = {
  modelProvider: LlmProvider;
  modelName: string;
};

export const DEFAULT_LLM_SELECTION: LlmSelection = {
  modelProvider: "groq",
  modelName: "llama-3.3-70b-versatile",
};

export const LLM_MODEL_OPTIONS: { label: string; modelProvider: LlmProvider; modelName: string }[] = [
  { label: "Groq — Llama 3.3 70b (Fast, Free)", modelProvider: "groq", modelName: "llama-3.3-70b-versatile" },
  { label: "OpenAI — GPT-4o Mini", modelProvider: "openai", modelName: "gpt-4o-mini" },
  { label: "Ollama — Local Llama 3.1", modelProvider: "ollama", modelName: "llama3.1:8b" },
];

export function llmSelectionKey(s: LlmSelection): string {
  return `${s.modelProvider}:${s.modelName}`;
}

/** Human-readable label for the current selection (matches dropdown when possible). */
export function labelForLlmSelection(s: LlmSelection): string {
  const match = LLM_MODEL_OPTIONS.find(
    (o) => o.modelProvider === s.modelProvider && o.modelName === s.modelName,
  );
  return match?.label ?? `${s.modelProvider} · ${s.modelName}`;
}
