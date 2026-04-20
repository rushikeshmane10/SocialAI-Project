-- Which option (1 / 2 / …) the user chose to refine; ties instructions + LLM output to that draft only.
ALTER TABLE post_rework_logs ADD COLUMN IF NOT EXISTS source_variation_id integer NULL;
