-- Stores user rework instructions alongside the mock "LLM" output (variations + insights) for each reworked generate.
CREATE TABLE post_rework_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_post_id uuid NULL REFERENCES posts(id) ON DELETE SET NULL,
  result_post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  base_draft_text text NOT NULL,
  user_instructions text NOT NULL,
  model_output jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_post_rework_logs_user_created ON post_rework_logs (user_id, created_at DESC);
CREATE INDEX idx_post_rework_logs_result_post ON post_rework_logs (result_post_id);
CREATE INDEX idx_post_rework_logs_source_post ON post_rework_logs (source_post_id);
