export type ImageResult = {
  status: "ok" | "failed";
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
  variation_id: number;
  text: string;
  tone_applied: string;
  estimated_length: string;
  hashtags: string[];
  /** Original draft source post id used for optional persistence when a variant is picked. */
  sourcePostId?: string | null;
  /** Original variation id in the source draft (1 or 2) used for pick persistence. */
  sourceVariationId?: 1 | 2;
};

export type MockGenerateResponse = {
  postId: string | null;
  variations: PostVariation[];
  insights: GenerateInsights;
};

export type SelectVariationResponse = {
  success: boolean;
  postId: string;
  selectedVariation: number;
};
