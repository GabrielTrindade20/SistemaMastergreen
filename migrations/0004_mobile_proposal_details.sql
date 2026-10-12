SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
-- Additive: existing summaries remain unchanged. No item or cost is backfilled.
ALTER TABLE mobile_quick_proposals ADD COLUMN IF NOT EXISTS web_details jsonb;
