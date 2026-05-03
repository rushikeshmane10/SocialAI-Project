import { useId } from "react";

import { LLM_MODEL_OPTIONS, type LlmSelection, llmSelectionKey } from "../config/llmModels";

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

const TONE_OPTIONS = ["professional", "casual", "humorous", "inspirational", "controversial"] as const;

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

  function toggleTone(option: (typeof TONE_OPTIONS)[number]) {
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
    <div className="compose-row">
      <div className="compose-avatar" aria-hidden>
        {composeAvatar(topic)}
      </div>
      <div className="compose-body">
        <textarea
          id="topic"
          className="input-ghost"
          value={topic}
          disabled={disabled}
          onChange={(e) => onTopicChange(e.target.value)}
          placeholder="What's happening?"
          aria-label="What's happening?"
          rows={4}
        />

        <div className="field tone-field">
          <span id={toneGroupId} className="sr-only">
            Tone — pick two
          </span>
          <div className="tone-field-head">
            <div className="tone-field-label-row tone-field-label-row--cap-only">
              <span className="tone-field-cap" aria-live="polite">
                {tones.length}/2
              </span>
            </div>
            <div
              className="tone-selected"
              role="list"
              aria-label="Selected tones"
            >
              {tones.length === 0 ? null : (
                tones.map((t) => (
                  <span key={t} className="tone-chip" role="listitem">
                    <span className="tone-chip-label">{t}</span>
                    <button
                      type="button"
                      className="tone-chip-remove"
                      disabled={disabled}
                      onClick={() => removeTone(t)}
                      aria-label={`Remove ${t}`}
                    >
                      <span aria-hidden>×</span>
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>
          <div
            className="tone-pills"
            role="group"
            aria-labelledby={toneGroupId}
          >
            {TONE_OPTIONS.map((option) => {
              const selected = tones.includes(option);
              const blocked = tones.length >= 2 && !selected;
              return (
                <button
                  key={option}
                  type="button"
                  className={
                    "tone-pill" +
                    (selected ? " tone-pill--selected" : "") +
                    (blocked ? " tone-pill--blocked" : "")
                  }
                  disabled={disabled || blocked}
                  aria-pressed={selected}
                  title={
                    blocked
                      ? "Maximum two tones — remove one to add another"
                      : undefined
                  }
                  onClick={() => toggleTone(option)}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </div>

        <div className="compose-generate-row">
          <div className="compose-model-inline">
            <label className="sr-only" htmlFor={modelSelectId}>
              Model
            </label>
            <select
              id={modelSelectId}
              className="compose-model-select"
              disabled={disabled}
              value={llmSelectionKey(llmSelection)}
              onChange={(e) => {
                const opt = LLM_MODEL_OPTIONS.find((o) => llmSelectionKey(o) === e.target.value);
                if (opt) {
                  onLlmSelectionChange({ modelProvider: opt.modelProvider, modelName: opt.modelName });
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
          <button className="btn primary compose-generate-btn" type="button" disabled={disabled} onClick={onGenerate}>
            {disabled && isGenerating ? "···" : "Generate →"}
          </button>
        </div>
      </div>
    </div>
  );
}
