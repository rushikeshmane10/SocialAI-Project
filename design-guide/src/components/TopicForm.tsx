import { useId } from "react";
import { motion } from "framer-motion";
import { LLM_MODEL_OPTIONS, type LlmSelection, llmSelectionKey } from "@/config/llmModels";
import { LinkedInContextCard } from "@/components/LinkedInContextCard";

function composeAvatar(topic: string): string {
  const t = topic.trim();
  if (!t) return "AI";
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0]?.[0] ?? "";
    const b = parts[1]?.[0] ?? "";
    return (a + b).toUpperCase();
  }
  return t.slice(0, 2).toUpperCase();
}

type Props = {
  topic: string;
  tones: string[];
  llmSelection: LlmSelection;
  onLlmSelectionChange: (next: LlmSelection) => void;
  disabled: boolean;
  onTopicChange: (v: string) => void;
  onTonesChange: (v: string[]) => void;
  onGenerate: () => void;
  /** When true with `disabled`, the generate control shows a quiet ellipsis state. */
  isGenerating?: boolean;
};

const TONE_OPTIONS = [
  "professional",
  "casual",
  "humorous",
  "inspirational",
  "controversial",
] as const;
export type Tone = (typeof TONE_OPTIONS)[number];

export function TopicForm({
  topic,
  tones,
  llmSelection,
  onLlmSelectionChange,
  disabled,
  onTopicChange,
  onTonesChange,
  onGenerate,
  isGenerating = false,
}: Props) {
  const toneGroupId = useId();
  const modelSelectId = useId();

  function toggleTone(option: Tone) {
    if (tones.includes(option)) {
      onTonesChange(tones.filter((t) => t !== option));
    } else if (tones.length < 2) {
      onTonesChange([...tones, option]);
    }
  }

  function removeTone(option: string) {
    onTonesChange(tones.filter((t) => t !== option));
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <div className="flex gap-4">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[image:var(--gradient-primary)] text-xs font-bold text-white"
          aria-hidden
        >
          {composeAvatar(topic)}
        </div>
        <div className="min-w-0 flex-1 space-y-5">
          <div>
            <label
              htmlFor="topic-field"
              className="mb-2 block text-sm font-semibold text-foreground"
            >
              What&apos;s happening?
            </label>
            <textarea
              id="topic-field"
              value={topic}
              disabled={disabled}
              onChange={(e) => onTopicChange(e.target.value)}
              placeholder="Share what's on your mind — a thought, an update, an idea…"
              rows={4}
              className="w-full resize-none rounded-lg border border-input bg-background px-4 py-3 text-sm text-foreground shadow-[var(--shadow-sm)] placeholder:text-muted-foreground/40 transition-all duration-150 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/15 disabled:opacity-50"
            />
          </div>

          <div>
            <LinkedInContextCard />
          </div>

          <div>
            <span id={toneGroupId} className="sr-only">
              Tone — pick two
            </span>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-semibold text-foreground">Pick two tones</label>
              <span className="text-xs tabular-nums text-muted-foreground" aria-live="polite">
                {tones.length}/2
              </span>
            </div>
            {tones.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2" role="list" aria-label="Selected tones">
                {tones.map((t) => (
                  <span
                    key={t}
                    role="listitem"
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium capitalize text-foreground shadow-[var(--shadow-sm)]"
                  >
                    {t}
                    <button
                      type="button"
                      disabled={disabled}
                      className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                      onClick={() => removeTone(t)}
                      aria-label={`Remove ${t}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-2" role="group" aria-labelledby={toneGroupId}>
              {TONE_OPTIONS.map((option) => {
                const selected = tones.includes(option);
                const blocked = tones.length >= 2 && !selected;
                return (
                  <motion.button
                    key={option}
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    disabled={disabled || blocked}
                    aria-pressed={selected}
                    title={blocked ? "Maximum two tones — remove one to add another" : undefined}
                    onClick={() => toggleTone(option)}
                    className={`rounded-full px-3.5 py-1.5 text-xs font-medium capitalize transition-all duration-150 ${
                      selected
                        ? "bg-primary text-primary-foreground shadow-[var(--shadow-sm)]"
                        : blocked
                          ? "cursor-not-allowed border border-border bg-muted/30 text-muted-foreground opacity-50"
                          : "border border-border bg-background text-muted-foreground shadow-[var(--shadow-sm)] hover:border-foreground/15 hover:text-foreground"
                    }`}
                  >
                    {option}
                  </motion.button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <label
                htmlFor={modelSelectId}
                className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                Model
              </label>
              <select
                id={modelSelectId}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground shadow-[var(--shadow-sm)] transition-all duration-150 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/15 disabled:opacity-50"
                disabled={disabled}
                value={llmSelectionKey(llmSelection)}
                onChange={(e) => {
                  const opt = LLM_MODEL_OPTIONS.find((o) => llmSelectionKey(o) === e.target.value);
                  if (opt) {
                    onLlmSelectionChange({
                      modelProvider: opt.modelProvider,
                      modelName: opt.modelName,
                    });
                  }
                }}
                aria-label="Model for generation"
              >
                {LLM_MODEL_OPTIONS.map((o) => (
                  <option key={llmSelectionKey(o)} value={llmSelectionKey(o)}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="flex h-10 shrink-0 items-center justify-center rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-card)] transition-all duration-150 hover:shadow-[var(--shadow-elevated)] hover:brightness-110 disabled:opacity-40 disabled:shadow-none"
              disabled={disabled}
              onClick={onGenerate}
            >
              {disabled && isGenerating ? "···" : "Generate →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
