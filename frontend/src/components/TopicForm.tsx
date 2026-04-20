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
  disabled,
  onTopicChange,
  onTonesChange,
  onGenerate,
  isGenerating = false,
}: Props) {
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

        <div className="field">
          <label className="label" htmlFor="tone">
            Tone (pick up to 2)
          </label>
          <select
            id="tone"
            className="input"
            multiple
            value={tones}
            disabled={disabled}
            onChange={(e) => {
              const selected = [...e.currentTarget.selectedOptions].map((opt) => opt.value);
              onTonesChange(selected.slice(0, 2));
            }}
          >
            {TONE_OPTIONS.map((toneOption) => (
              <option key={toneOption} value={toneOption}>
                {toneOption}
              </option>
            ))}
          </select>
          <p className="form-hint">We generate one draft per selected tone.</p>
        </div>

        <div className="row end">
          <button className="btn primary" type="button" disabled={disabled} onClick={onGenerate}>
            {disabled && isGenerating ? "···" : "Generate →"}
          </button>
        </div>
      </div>
    </div>
  );
}
