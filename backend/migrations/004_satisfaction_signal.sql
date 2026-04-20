-- One-tap satisfaction after variation pick (separate from post_feedback semantics).
CREATE TABLE IF NOT EXISTS satisfaction_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  signal text NOT NULL CHECK (signal IN ('yes', 'almost', 'not_really')),
  variation_id integer NULL,
  selected_text text NULL,
  context jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT satisfaction_signals_user_post_unique UNIQUE (user_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_satisfaction_signals_user_id ON satisfaction_signals (user_id);
CREATE INDEX IF NOT EXISTS idx_satisfaction_signals_post_id ON satisfaction_signals (post_id);
CREATE INDEX IF NOT EXISTS idx_satisfaction_signals_signal ON satisfaction_signals (signal);
