import type { QueryResultRow } from "pg";
import type { Queryable } from "../database/postgres";

export type BillingRecordStatus = "pending" | "processing" | "paid" | "failed" | "canceled";
export type PaymentAttemptStatus = "pending" | "processing" | "succeeded" | "failed" | "canceled";

export type BillingRecord = {
  id: string;
  orderId: string;
  customerId: string;
  amountCents: number;
  currency: string;
  status: BillingRecordStatus;
  idempotencyKey: string;
  correlationId: string;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateBillingRecordInput = {
  orderId: string;
  customerId: string;
  amountCents: number;
  currency: string;
  idempotencyKey: string;
  correlationId: string;
  status?: BillingRecordStatus;
};

export type PaymentAttempt = {
  id: string;
  billingRecordId: string;
  status: PaymentAttemptStatus;
  provider: string | null;
  providerReference: string | null;
  idempotencyKey: string;
  correlationId: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export type CreatePaymentAttemptInput = {
  billingRecordId: string;
  status?: PaymentAttemptStatus;
  provider?: string;
  providerReference?: string;
  idempotencyKey: string;
  correlationId: string;
  metadata?: Record<string, unknown>;
};

type BillingRecordRow = QueryResultRow & {
  id: string;
  order_id: string;
  customer_id: string;
  amount_cents: number;
  currency: string;
  status: BillingRecordStatus;
  idempotency_key: string;
  correlation_id: string;
  created_at: Date;
  updated_at: Date;
};

type PaymentAttemptRow = QueryResultRow & {
  id: string;
  billing_record_id: string;
  status: PaymentAttemptStatus;
  provider: string | null;
  provider_reference: string | null;
  idempotency_key: string;
  correlation_id: string;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
};

function mapBillingRecord(row: BillingRecordRow): BillingRecord {
  return {
    id: row.id,
    orderId: row.order_id,
    customerId: row.customer_id,
    amountCents: row.amount_cents,
    currency: row.currency,
    status: row.status,
    idempotencyKey: row.idempotency_key,
    correlationId: row.correlation_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPaymentAttempt(row: PaymentAttemptRow): PaymentAttempt {
  return {
    id: row.id,
    billingRecordId: row.billing_record_id,
    status: row.status,
    provider: row.provider,
    providerReference: row.provider_reference,
    idempotencyKey: row.idempotency_key,
    correlationId: row.correlation_id,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function billingStatusForAttemptStatus(status: PaymentAttemptStatus): BillingRecordStatus {
  const mapping: Record<PaymentAttemptStatus, BillingRecordStatus> = {
    pending: "pending",
    processing: "processing",
    succeeded: "paid",
    failed: "failed",
    canceled: "canceled",
  };

  return mapping[status];
}

export class BillingRepository {
  constructor(private readonly db: Queryable) {}

  async create(input: CreateBillingRecordInput): Promise<BillingRecord> {
    const result = await this.db.query<BillingRecordRow>(
      `
        INSERT INTO billing_records (
          order_id,
          customer_id,
          amount_cents,
          currency,
          status,
          idempotency_key,
          correlation_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `,
      [
        input.orderId,
        input.customerId,
        input.amountCents,
        input.currency.toUpperCase(),
        input.status ?? "pending",
        input.idempotencyKey,
        input.correlationId,
      ],
    );

    return mapBillingRecord(result.rows[0]);
  }

  async findById(id: string): Promise<BillingRecord | null> {
    const result = await this.db.query<BillingRecordRow>(
      "SELECT * FROM billing_records WHERE id = $1",
      [id],
    );

    return result.rows[0] ? mapBillingRecord(result.rows[0]) : null;
  }

  async findByOrderId(orderId: string): Promise<BillingRecord | null> {
    const result = await this.db.query<BillingRecordRow>(
      "SELECT * FROM billing_records WHERE order_id = $1",
      [orderId],
    );

    return result.rows[0] ? mapBillingRecord(result.rows[0]) : null;
  }

  async findByIdempotencyKey(idempotencyKey: string): Promise<BillingRecord | null> {
    const result = await this.db.query<BillingRecordRow>(
      "SELECT * FROM billing_records WHERE idempotency_key = $1",
      [idempotencyKey],
    );

    return result.rows[0] ? mapBillingRecord(result.rows[0]) : null;
  }

  async updateStatus(id: string, status: BillingRecordStatus): Promise<BillingRecord | null> {
    const result = await this.db.query<BillingRecordRow>(
      `
        UPDATE billing_records
        SET status = $2, updated_at = now()
        WHERE id = $1
        RETURNING *
      `,
      [id, status],
    );

    return result.rows[0] ? mapBillingRecord(result.rows[0]) : null;
  }

  async listByCustomerId(customerId: string): Promise<BillingRecord[]> {
    const result = await this.db.query<BillingRecordRow>(
      `
        SELECT * FROM billing_records
        WHERE customer_id = $1
        ORDER BY created_at DESC
      `,
      [customerId],
    );

    return result.rows.map(mapBillingRecord);
  }
}

export class PaymentAttemptRepository {
  constructor(private readonly db: Queryable) {}

  async create(input: CreatePaymentAttemptInput): Promise<PaymentAttempt> {
    const result = await this.db.query<PaymentAttemptRow>(
      `
        INSERT INTO payment_attempts (
          billing_record_id,
          status,
          provider,
          provider_reference,
          idempotency_key,
          correlation_id,
          metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
        RETURNING *
      `,
      [
        input.billingRecordId,
        input.status ?? "pending",
        input.provider ?? null,
        input.providerReference ?? null,
        input.idempotencyKey,
        input.correlationId,
        JSON.stringify(input.metadata ?? {}),
      ],
    );

    return mapPaymentAttempt(result.rows[0]);
  }

  async listByBillingRecordId(billingRecordId: string): Promise<PaymentAttempt[]> {
    const result = await this.db.query<PaymentAttemptRow>(
      `
        SELECT * FROM payment_attempts
        WHERE billing_record_id = $1
        ORDER BY created_at DESC
      `,
      [billingRecordId],
    );

    return result.rows.map(mapPaymentAttempt);
  }

  async findById(id: string): Promise<PaymentAttempt | null> {
    const result = await this.db.query<PaymentAttemptRow>(
      "SELECT * FROM payment_attempts WHERE id = $1",
      [id],
    );

    return result.rows[0] ? mapPaymentAttempt(result.rows[0]) : null;
  }

  async findByIdempotencyKey(idempotencyKey: string): Promise<PaymentAttempt | null> {
    const result = await this.db.query<PaymentAttemptRow>(
      "SELECT * FROM payment_attempts WHERE idempotency_key = $1",
      [idempotencyKey],
    );

    return result.rows[0] ? mapPaymentAttempt(result.rows[0]) : null;
  }

  async updateStatus(id: string, status: PaymentAttemptStatus): Promise<PaymentAttempt | null> {
    const result = await this.db.query<PaymentAttemptRow>(
      `
        UPDATE payment_attempts
        SET status = $2, updated_at = now()
        WHERE id = $1
        RETURNING *
      `,
      [id, status],
    );

    return result.rows[0] ? mapPaymentAttempt(result.rows[0]) : null;
  }
}
