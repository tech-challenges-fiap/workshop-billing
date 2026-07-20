CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS schema_migrations (
  id text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS billing_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text NOT NULL UNIQUE,
  customer_id text NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  currency char(3) NOT NULL CHECK (currency = upper(currency)),
  status text NOT NULL CHECK (status IN ('pending', 'processing', 'paid', 'failed', 'canceled')) DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS billing_records_customer_id_idx ON billing_records (customer_id);
CREATE INDEX IF NOT EXISTS billing_records_status_idx ON billing_records (status);

CREATE TABLE IF NOT EXISTS payment_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_record_id uuid NOT NULL REFERENCES billing_records (id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'canceled')) DEFAULT 'pending',
  provider text,
  provider_reference text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_attempts_billing_record_id_idx
  ON payment_attempts (billing_record_id);
CREATE INDEX IF NOT EXISTS payment_attempts_status_idx ON payment_attempts (status);
