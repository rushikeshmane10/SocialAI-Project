/**
 * Build 2–3 hashtags from keywords (demo).
 * @param {string[]} keywords
 * @returns {string[]}
 */
function hashtagsFromKeywords(keywords) {
  const base = (keywords.length ? keywords : ["topic"]).slice(0, 3);
  return base.map((k) => {
    const slug = k.replace(/[^a-zA-Z0-9]/g, "").slice(0, 24) || "topic";
    return `#${slug}`;
  });
}

/**
 * @param {string} toneApplied
 * @param {object} insights
 */
function estimatedLengthFor(toneApplied, insights) {
  if (insights.post_length_preference === "short" && toneApplied === "professional") return "short";
  if (insights.post_length_preference === "long") return "long";
  return insights.post_length_preference;
}

/**
 * @param {string} topic
 * @param {string} tone
 * @param {object} insights
 */
export function mockGenerate(topic, tone, insights) {
  const t = (topic ?? "").trim() || "your idea";
  const toneApplied = insights.detected_tone;
  const tags = hashtagsFromKeywords(insights.keywords);
  const kw = insights.keywords.slice(0, 3).join(", ") || t;

  const est = estimatedLengthFor(toneApplied, insights);

  /** @type {Record<string, (n: number) => string>} */
  const templates = {
    professional: (n) =>
      `${n === 1 ? "Quick take:" : "Another angle:"} ${t.slice(0, 200)} — focusing on clarity and outcomes for stakeholders. ${kw ? `Key themes: ${kw}.` : ""} Thoughts?`,
    casual: (n) =>
      n === 1
        ? `honestly 😊 ${t.slice(0, 170)} — keeping it real. what do you think?`
        : `also ✌️ ${t.slice(0, 160)} — same vibe, looser take. agree?`,
    humorous: (n) =>
      `${n === 1 ? "Plot twist:" : "Part two:"} ${t.slice(0, 160)} (narrator: it was ${insights.topic_category} all along). ${n === 1 ? "Send tweet." : "Still sending tweet."}`,
    inspirational: (n) =>
      `${n === 1 ? "Remember:" : "Keep going —"} ${t.slice(0, 180)} You have more leverage than it feels. Show up anyway; small steps compound. You've got this.`,
    controversial: (n) =>
      `${n === 1 ? "Unpopular opinion:" : "I'll say it louder:"} ${t.slice(0, 170)} — ${insights.topic_category} needs sharper debate, not safer slogans. Agree or disagree?`,
  };

  const pick = templates[toneApplied] ?? templates.casual;

  const fallback = (n) =>
    `${n === 1 ? "Here's a take on" : "Alternate spin on"} ${t.slice(0, 200)}. Tone: ${tone || "default"}. Tags: ${tags.join(" ")}`;

  const v1Text = (templates[toneApplied] ? pick(1) : fallback(1)).slice(0, 280);
  const v2Text = (templates[toneApplied] ? pick(2) : fallback(2)).slice(0, 280);

  return [
    {
      variation_id: 1,
      text: v1Text,
      tone_applied: toneApplied,
      estimated_length: est,
      hashtags: tags.slice(0, 3),
    },
    {
      variation_id: 2,
      text: v2Text,
      tone_applied: toneApplied,
      estimated_length: est,
      hashtags: tags.slice(0, 3),
    },
  ];
}
