-- Add post lifecycle state for manual variation pick; store selection on the row.
ALTER TYPE post_status ADD VALUE 'selected';

ALTER TABLE posts ADD COLUMN IF NOT EXISTS selected_variation_id integer NULL;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS selected_text text NULL;
