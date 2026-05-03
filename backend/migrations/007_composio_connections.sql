-- Track per-user Composio OAuth connections (Twitter / LinkedIn) and the entity id used with Composio SDK.
ALTER TABLE users ADD COLUMN IF NOT EXISTS twitter_connected boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS linkedin_connected boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS composio_entity_id text NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_composio_entity_id
  ON users (composio_entity_id)
  WHERE composio_entity_id IS NOT NULL;
