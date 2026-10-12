CREATE TABLE IF NOT EXISTS mobile_sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mobile_sessions_user_idx ON mobile_sessions(user_id);

CREATE TABLE IF NOT EXISTS mobile_quick_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id),
  customer_id uuid NOT NULL REFERENCES customers(id),
  customer_snapshot jsonb NOT NULL,
  proposal_date text NOT NULL,
  freight text NOT NULL,
  warranty text NOT NULL,
  payment text NOT NULL,
  discount_percent numeric(5,2) NOT NULL CHECK (discount_percent BETWEEN 0 AND 100),
  total_cents integer NOT NULL CHECK (total_cents > 0 AND total_cents <= 1000000000),
  payload_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS mobile_quick_proposals_client_key ON mobile_quick_proposals(user_id, client_id);
CREATE INDEX IF NOT EXISTS mobile_quick_proposals_customer_idx ON mobile_quick_proposals(customer_id);
CREATE INDEX IF NOT EXISTS mobile_quick_proposals_date_idx ON mobile_quick_proposals(proposal_date);
