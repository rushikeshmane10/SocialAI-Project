const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "in",
  "on",
  "at",
  "to",
  "for",
  "of",
  "as",
  "is",
  "was",
  "are",
  "were",
  "been",
  "be",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "must",
  "shall",
  "can",
  "this",
  "that",
  "these",
  "those",
  "i",
  "you",
  "he",
  "she",
  "it",
  "we",
  "they",
  "what",
  "which",
  "who",
  "whom",
  "whose",
  "where",
  "when",
  "why",
  "how",
  "all",
  "each",
  "every",
  "both",
  "few",
  "more",
  "most",
  "other",
  "some",
  "such",
  "no",
  "nor",
  "not",
  "only",
  "own",
  "same",
  "so",
  "than",
  "too",
  "very",
  "just",
  "about",
  "into",
  "through",
  "during",
  "before",
  "after",
  "above",
  "below",
  "from",
  "up",
  "down",
  "out",
  "off",
  "over",
  "under",
  "again",
  "further",
  "then",
  "once",
]);

const TONE_BUCKETS = ["professional", "casual", "humorous", "inspirational", "controversial"];

/**
 * Map free-text tone to a fixed bucket for ML-style features.
 * @param {string} tone
 * @returns {typeof TONE_BUCKETS[number]}
 */
function mapDetectedTone(tone) {
  const t = (tone ?? "").toLowerCase();
  if (/prof|formal|business|exec/.test(t)) return "professional";
  if (/funny|humor|joke|wit|sarcasm|playful/.test(t)) return "humorous";
  if (/inspir|motivat|empower|uplift/.test(t)) return "inspirational";
  if (/controvers|bold|debate|polar|hot.take/.test(t)) return "controversial";
  if (/casual|friendly|relaxed|conversational|warm/.test(t)) return "casual";
  if (TONE_BUCKETS.includes(t.trim())) return /** @type {typeof TONE_BUCKETS[number]} */ (t.trim());
  return "casual";
}

/**
 * Rough topic bucket from keyword overlap.
 * @param {string[]} keywords
 */
function inferTopicCategory(keywords) {
  const joined = keywords.join(" ").toLowerCase();
  const scores = {
    tech: /\b(code|dev|api|software|app|saas|ai|ml|data|cloud|engineer|startup|product)\b/.test(joined) ? 2 : 0,
    marketing: /\b(market|brand|seo|ads|campaign|growth|funnel|content|social|audience|lead)\b/.test(joined)
      ? 2
      : 0,
    business: /\b(revenue|profit|sales|ceo|strategy|b2b|enterprise|invest|deck|pitch)\b/.test(joined) ? 2 : 0,
    personal: /\b(life|story|journey|family|feel|learned|today|grateful|mindset)\b/.test(joined) ? 2 : 0,
  };
  let best = "personal";
  let max = -1;
  for (const [k, v] of Object.entries(scores)) {
    if (v > max) {
      max = v;
      best = k;
    }
  }
  if (max <= 0 && keywords.length) {
    if (/tech|code|data|ai|api|dev/i.test(keywords[0])) return "tech";
    if (/market|brand|growth|seo/i.test(keywords[0])) return "marketing";
    if (/sale|ceo|biz|corp/i.test(keywords[0])) return "business";
  }
  return best;
}

/**
 * Extract lightweight NLP-style features from topic + tone for personalization / future ML.
 * @param {string} topic
 * @param {string} [tone]
 */
export function extractInsights(topic, tone = "") {
  const text = (topic ?? "").trim();
  const words = text.length ? text.split(/\s+/) : [];
  const wordCount = words.length;
  const charCount = text.length;

  const freq = new Map();
  for (const w of words) {
    const key = w.replace(/[^a-zA-Z0-9#]/g, "").toLowerCase();
    if (!key || STOPWORDS.has(key)) continue;
    freq.set(key, (freq.get(key) ?? 0) + 1);
  }
  const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const keywords = sorted.slice(0, 5).map(([k]) => k);

  let post_length_preference = "medium";
  if (wordCount < 10) post_length_preference = "short";
  else if (wordCount > 20) post_length_preference = "long";

  const lower = text.toLowerCase();
  const has_question = /\?/.test(text);
  const has_hashtag_intent =
    /#/.test(text) || /\b(trending|viral|fyp|hashtag)\b/i.test(text);

  return {
    keywords: keywords.length ? keywords : ["topic"],
    detected_tone: mapDetectedTone(tone),
    post_length_preference,
    topic_category: inferTopicCategory(keywords.length ? keywords : words.map((w) => w.toLowerCase())),
    word_count: wordCount,
    char_count: charCount,
    has_question,
    has_hashtag_intent,
    extracted_at: new Date().toISOString(),
  };
}
