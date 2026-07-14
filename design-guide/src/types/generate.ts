export type ImageResult = {
  status: "ok" | "failed" | "skipped";
  model?: string;
  code?: string;
  message?: string;
};

/** Legacy pipeline shape (Python path); not used by mock generate. */
export type GeneratePipelineResponse = {
  postId?: string;
  post: string;
  image_prompt: string | null;
  image_url: string | null;
  image: ImageResult;
  model?: string;
};

export type GenerateInsights = {
  keywords: string[];
  detected_tone: string;
  post_length_preference: string;
  topic_category: string;
  word_count: number;
  char_count: number;
  has_question: boolean;
  has_hashtag_intent: boolean;
  extracted_at: string;
};

export type PostVariation = {
  variation_id: 1 | 2;
  text: string;
  tone_applied: string;
  estimated_length: string;
  hashtags: string[];
  image_base64?: string | null;
  /** Original draft source post id used for optional persistence when a variant is picked. */
  sourcePostId?: string | null;
  /** Original variation id in the source draft (1 or 2) used for pick persistence. */
  sourceVariationId?: 1 | 2;
};

export type MockGenerateResponse = {
  postId: string | null;
  variations: [PostVariation, PostVariation];
  model?: string | null;
  insights: GenerateInsights;
  profileContext?: {
    profession: string | null;
    audience: string | null;
    vibe: string | null;
  } | null;
};

export type GenerateStartResponse = {
  ok: true;
  status: "started";
  requestId: string;
  message: string;
  insights?: GenerateInsights;
};

export type GenerationLifecycleSucceeded = {
  requestId: string;
  status: "succeeded";
  finishedAt: string;
  result: {
    postId: string | null;
    variations: PostVariation[];
    model?: string | null;
    pipeline?: unknown;
  };
  meta?: {
    userId?: string | null;
    topic?: string;
    tones?: string[];
    sourceRequestId?: string;
  };
};

export type GenerationLifecycleFailed = {
  requestId: string;
  status: "failed";
  finishedAt: string;
  error: {
    code: string;
    message: string;
    stage?: string;
  };
  result?: Record<string, unknown>;
  meta?: {
    userId?: string | null;
    topic?: string;
    tones?: string[];
    sourceRequestId?: string;
  };
};

export type GenerationLifecycleEvent = GenerationLifecycleSucceeded | GenerationLifecycleFailed;

export type SelectVariationResponse = {
  success: boolean;
  postId: string;
  selectedVariation: number;
};
