import { useId, useState } from "react";
import { motion } from "framer-motion";
import { LLM_MODEL_OPTIONS, type LlmSelection, llmSelectionKey } from "@/config/llmModels";
import { LinkedInContextCard } from "@/components/LinkedInContextCard";
import { TemplatePickerDialog } from "@/components/TemplatePickerDialog";
import { Button } from "@/components/ui/button";
import type { TemplateModel } from "@/utils/templateStorage";

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
  selectedTemplate: TemplateModel | null;
  onSelectedTemplateChange: (template: TemplateModel | null) => void;
  useLinkedInProfile: boolean;
  onUseLinkedInProfileChange: (value: boolean) => void;
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
  selectedTemplate,
  onSelectedTemplateChange,
  useLinkedInProfile,
  onUseLinkedInProfileChange,
  isGenerating = false,
}: Props) {
  const toneGroupId = useId();
  const modelSelectId = useId();
  const [pickerOpen, setPickerOpen] = useState(false);
function toggleTone(option: Tone) {
  if (tones.includes(option)) {
    // already selected — no-op, keeps count at mandatory 2
    return;
  }
  if (tones.length < 2) {
    onTonesChange([...tones, option]);
    return;
  }
  // already have 2 — swap out the oldest (first selected) for the new one
  onTonesChange([tones[1], option]);
}

  function removeTone(option: string) {
    onTonesChange(tones.filter((t) => t !== option));
  }

  return (
    <div className="rounded-[28px] border border-[#e8e8f7] bg-gradient-to-br from-white via-[#fbfcff] to-[#f4f5ff] p-6 shadow-[0_24px_60px_-24px_rgba(68,65,196,0.28)] sm:p-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:gap-6">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[image:var(--gradient-primary)] text-sm font-bold text-white shadow-lg shadow-primary/20" aria-hidden>
          {composeAvatar(topic)}
        </div>

        <div className="min-w-0 flex-1 space-y-5">
          <div className="rounded-[24px] border border-[#ececf8] bg-white/80 p-4 shadow-[0_12px_30px_-18px_rgba(15,23,42,0.2)] sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <label htmlFor="topic-field" className="block text-[15px] font-semibold text-foreground">
                What&apos;s happening?
              </label>
              <div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPickerOpen(true)}
                  className="rounded-full border-[#d9dcf2] bg-[#f7f8ff] px-3.5 py-2 text-[12px] font-semibold text-[#4d4fb3] shadow-none hover:bg-[#eef0ff]"
                >
                  Templates
                </Button>
              </div>
            </div>
            <textarea
              id="topic-field"
              value={topic}
              disabled={disabled}
              onChange={(e) => onTopicChange(e.target.value)}
              placeholder="Share what's on your mind — a thought, an update, an idea…"
              rows={5}
              className="min-h-[168px] w-full resize-none rounded-2xl border border-[#dfe3f2] bg-[#f8f9ff] px-4 py-3.5 text-sm text-foreground shadow-inner shadow-[#edf0fa] placeholder:text-muted-foreground/45 transition-all duration-150 focus:border-[#7a7be0] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#7a7be0]/15 disabled:opacity-50"
            />
          </div>

          <div className="rounded-[24px] border border-[#ececf8] bg-[#fcfbff] p-4 shadow-[0_10px_25px_-18px_rgba(15,23,42,0.16)]">
            <LinkedInContextCard
              useProfile={useLinkedInProfile}
              onUseProfileChange={onUseLinkedInProfileChange}
            />
          </div>

          <TemplatePickerDialog
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            onInsert={(t) => {
              onSelectedTemplateChange(t);
            }}
          />

          {selectedTemplate ? (
            <div className="rounded-[24px] border border-dashed border-[#d6d7f2] bg-[#f7f8ff] p-4 shadow-[0_10px_25px_-20px_rgba(68,65,196,0.25)]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="truncate text-sm font-semibold text-foreground">{selectedTemplate.title}</h4>
                    {selectedTemplate.type ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-[#dcdff5] bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#5d5cde]">
                        {selectedTemplate.type}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground line-clamp-3">{selectedTemplate.content}</p>
                </div>
                <div className="flex flex-col gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onSelectedTemplateChange(null)}
                    className="rounded-full px-3 text-xs font-semibold text-[#5d5cde] hover:bg-white"
                  >
                    Clear
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

 <div className="rounded-[24px] border border-[#ececf8] bg-white/80 p-4 shadow-[0_10px_25px_-20px_rgba(15,23,42,0.16)] sm:p-5">
  <span id={toneGroupId} className="sr-only">
    Tone — pick two
  </span>
  <div className="mb-3 flex items-center justify-between">
    <label className="text-sm font-semibold text-foreground">Pick two tones</label>
    <span className="text-xs tabular-nums text-muted-foreground" aria-live="polite">
      {tones.length}/2
    </span>
  </div>
  <div className="flex flex-wrap gap-2" role="group" aria-labelledby={toneGroupId}>
    {TONE_OPTIONS.map((option) => {
      const selected = tones.includes(option);
      return (
        <motion.button
          key={option}
          type="button"
          whileTap={{ scale: 0.97 }}
          disabled={disabled}
          aria-pressed={selected}
          onClick={() => toggleTone(option)}
          className={`rounded-full px-3.5 py-1.5 text-xs font-medium capitalize transition-all duration-150 ${
            selected
              ? "bg-[linear-gradient(135deg,#4441c4_0%,#691dda_100%)] text-white shadow-lg shadow-primary/20"
              : "border border-[#e2e5f2] bg-white text-muted-foreground hover:border-[#c7ccf1] hover:text-foreground"
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
                className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground"
              >
                Model
              </label>
              <select
                id={modelSelectId}
                className="h-11 w-full rounded-2xl border border-[#dfe3f2] bg-white px-3 text-sm text-foreground shadow-[0_8px_20px_-16px_rgba(15,23,42,0.35)] transition-all duration-150 focus:border-[#7a7be0] focus:outline-none focus:ring-2 focus:ring-[#7a7be0]/15 disabled:opacity-50"
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
              className="flex h-11 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#4441c4_0%,#691dda_100%)] px-6 text-sm font-semibold text-white shadow-[0_14px_30px_-14px_rgba(68,65,196,0.65)] transition-all duration-150 hover:brightness-110 disabled:opacity-40"
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
