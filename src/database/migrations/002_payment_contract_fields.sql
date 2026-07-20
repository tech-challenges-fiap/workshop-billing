ALTER TABLE billing_records
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS correlation_id text;

UPDATE billing_records
SET
  idempotency_key = COALESCE(idempotency_key, order_id),
  correlation_id = COALESCE(correlation_id, order_id)
WHERE idempotency_key IS NULL OR correlation_id IS NULL;

ALTER TABLE billing_records
  ALTER COLUMN idempotency_key SET NOT NULL,
  ALTER COLUMN correlation_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS billing_records_idempotency_key_idx
  ON billing_records (idempotency_key);
CREATE INDEX IF NOT EXISTS billing_records_correlation_id_idx
  ON billing_records (correlation_id);

ALTER TABLE payment_attempts
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS correlation_id text;

UPDATE payment_attempts
SET
  idempotency_key = COALESCE(idempotency_key, id::text),
  correlation_id = COALESCE(correlation_id, billing_record_id::text)
WHERE idempotency_key IS NULL OR correlation_id IS NULL;

ALTER TABLE payment_attempts
  ALTER COLUMN idempotency_key SET NOT NULL,
  ALTER COLUMN correlation_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS payment_attempts_idempotency_key_idx
  ON payment_attempts (idempotency_key);
CREATE INDEX IF NOT EXISTS payment_attempts_correlation_id_idx
  ON payment_attempts (correlation_id);
