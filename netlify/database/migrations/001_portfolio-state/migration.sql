CREATE TABLE IF NOT EXISTS portfolio_state (
  id text PRIMARY KEY CHECK (id = 'primary'),
  document jsonb NOT NULL CHECK (document->>'version' = '2'),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO portfolio_state (id, document) VALUES
  ('primary', '{"version":2,"audits":{},"histories":{},"quotas":{}}'::jsonb)
ON CONFLICT (id) DO NOTHING;
