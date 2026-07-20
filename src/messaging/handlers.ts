import type {
  BillingRecord,
  BillingRecordStatus,
  PaymentAttempt,
  PaymentAttemptStatus,
} from "../repositories/billing";
import { type MessageEnvelope, createBillingEnvelope } from "./envelope";

export const PAYMENT_AUTHORIZE_REQUESTED = "billing.payment.authorize.requested";
export const PAYMENT_COMPENSATION_REQUESTED = "billing.payment.compensation.requested";
export const PAYMENT_CANCEL_REQUESTED = "billing.payment.cancel.requested";
export const PAYMENT_REFUND_REQUESTED = "billing.payment.refund.requested";
export const PAYMENT_STATUS_CHANGED = "billing.payment.status.changed";
export const PAYMENT_COMPENSATION_COMPLETED = "billing.payment.compensation.completed";

const compensationTypes = new Set([
  PAYMENT_COMPENSATION_REQUESTED,
  PAYMENT_CANCEL_REQUESTED,
  PAYMENT_REFUND_REQUESTED,
]);

type BillingRepositoryForMessaging = {
  create(input: {
    orderId: string;
    customerId: string;
    amountCents: number;
    currency: string;
    idempotencyKey: string;
    correlationId: string;
    status?: BillingRecordStatus;
  }): Promise<BillingRecord>;
  findById(id: string): Promise<BillingRecord | null>;
  findByOrderId(orderId: string): Promise<BillingRecord | null>;
  findByIdempotencyKey(idempotencyKey: string): Promise<BillingRecord | null>;
  updateStatus(id: string, status: BillingRecordStatus): Promise<BillingRecord | null>;
};

type PaymentAttemptRepositoryForMessaging = {
  create(input: {
    billingRecordId: string;
    status?: PaymentAttemptStatus;
    provider?: string;
    providerReference?: string;
    idempotencyKey: string;
    correlationId: string;
    metadata?: Record<string, unknown>;
  }): Promise<PaymentAttempt>;
  findById(id: string): Promise<PaymentAttempt | null>;
  findByIdempotencyKey(idempotencyKey: string): Promise<PaymentAttempt | null>;
  listByBillingRecordId(billingRecordId: string): Promise<PaymentAttempt[]>;
  updateStatus(id: string, status: PaymentAttemptStatus): Promise<PaymentAttempt | null>;
};

export type MessagePublisher = {
  publish(routingKey: string, envelope: MessageEnvelope): Promise<void>;
};

export type BillingMessageHandlerOptions = {
  billingRepository: BillingRepositoryForMessaging;
  paymentAttemptRepository: PaymentAttemptRepositoryForMessaging;
  publisher: MessagePublisher;
};

export type AuthorizationRequestPayload = {
  orderId: string;
  customerId: string;
  amountCents: number;
  currency: string;
  billingRecordId?: string;
  paymentAttemptId?: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
};

export type CompensationRequestPayload = {
  billingRecordId?: string;
  orderId?: string;
  reason?: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(payload: Record<string, unknown>, field: string): string {
  const value = payload[field];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} is required`);
  }
  return value;
}

function optionalString(payload: Record<string, unknown>, field: string): string | undefined {
  const value = payload[field];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string when provided`);
  }
  return value;
}

function metadata(payload: Record<string, unknown>): Record<string, unknown> | undefined {
  const value = payload.metadata;
  if (value === undefined) {
    return undefined;
  }
  if (!isObject(value)) {
    throw new Error("metadata must be an object when provided");
  }
  return value;
}

function parseAuthorizationPayload(payload: Record<string, unknown>): AuthorizationRequestPayload {
  if (!Number.isInteger(payload.amountCents) || (payload.amountCents as number) <= 0) {
    throw new Error("amountCents must be a positive integer");
  }
  const currency = requiredString(payload, "currency").toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error("currency must be a 3-letter ISO code");
  }

  return {
    orderId: requiredString(payload, "orderId"),
    customerId: requiredString(payload, "customerId"),
    amountCents: payload.amountCents as number,
    currency,
    billingRecordId: optionalString(payload, "billingRecordId"),
    paymentAttemptId: optionalString(payload, "paymentAttemptId"),
    idempotencyKey: optionalString(payload, "idempotencyKey"),
    metadata: metadata(payload),
  };
}

function parseCompensationPayload(payload: Record<string, unknown>): CompensationRequestPayload {
  const billingRecordId = optionalString(payload, "billingRecordId");
  const orderId = optionalString(payload, "orderId");
  if (!billingRecordId && !orderId) {
    throw new Error("billingRecordId or orderId is required");
  }

  return {
    billingRecordId,
    orderId,
    reason: optionalString(payload, "reason"),
    idempotencyKey: optionalString(payload, "idempotencyKey"),
    metadata: metadata(payload),
  };
}

export class BillingMessageHandler {
  constructor(private readonly options: BillingMessageHandlerOptions) {}

  async handle(envelope: MessageEnvelope): Promise<void> {
    if (envelope.type === PAYMENT_AUTHORIZE_REQUESTED) {
      await this.handleAuthorization(envelope);
      return;
    }

    if (compensationTypes.has(envelope.type)) {
      await this.handleCompensation(envelope);
      return;
    }

    throw new Error(`Unsupported message type: ${envelope.type}`);
  }

  private async findOrCreateBillingRecord(
    payload: AuthorizationRequestPayload,
    envelope: MessageEnvelope,
    idempotencyKey: string,
  ): Promise<BillingRecord> {
    if (payload.billingRecordId) {
      const byId = await this.options.billingRepository.findById(payload.billingRecordId);
      if (byId) {
        return byId;
      }
    }

    const byIdempotency = await this.options.billingRepository.findByIdempotencyKey(idempotencyKey);
    if (byIdempotency) {
      return byIdempotency;
    }

    const byOrder = await this.options.billingRepository.findByOrderId(payload.orderId);
    if (byOrder) {
      return byOrder;
    }

    return this.options.billingRepository.create({
      orderId: payload.orderId,
      customerId: payload.customerId,
      amountCents: payload.amountCents,
      currency: payload.currency,
      idempotencyKey,
      correlationId: envelope.correlationId,
      status: "processing",
    });
  }

  private async findOrCreatePaymentAttempt(
    billingRecord: BillingRecord,
    payload: AuthorizationRequestPayload,
    envelope: MessageEnvelope,
    idempotencyKey: string,
  ): Promise<PaymentAttempt> {
    if (payload.paymentAttemptId) {
      const byId = await this.options.paymentAttemptRepository.findById(payload.paymentAttemptId);
      if (byId) {
        return byId;
      }
    }

    const existing =
      await this.options.paymentAttemptRepository.findByIdempotencyKey(idempotencyKey);
    if (existing) {
      return existing;
    }

    return this.options.paymentAttemptRepository.create({
      billingRecordId: billingRecord.id,
      status: "processing",
      idempotencyKey,
      correlationId: envelope.correlationId,
      metadata: {
        ...(payload.metadata ?? {}),
        sourceEventId: envelope.eventId,
        sourceProducer: envelope.producer,
      },
    });
  }

  private async handleAuthorization(envelope: MessageEnvelope): Promise<void> {
    const payload = parseAuthorizationPayload(envelope.payload);
    const idempotencyKey = payload.idempotencyKey ?? envelope.eventId;
    const billingRecord = await this.findOrCreateBillingRecord(payload, envelope, idempotencyKey);
    const paymentAttempt = await this.findOrCreatePaymentAttempt(
      billingRecord,
      payload,
      envelope,
      idempotencyKey,
    );

    const updatedBilling = await this.options.billingRepository.updateStatus(
      billingRecord.id,
      "processing",
    );
    const updatedAttempt =
      paymentAttempt.status === "processing"
        ? paymentAttempt
        : await this.options.paymentAttemptRepository.updateStatus(paymentAttempt.id, "processing");

    await this.options.publisher.publish(
      PAYMENT_STATUS_CHANGED,
      createBillingEnvelope({
        type: PAYMENT_STATUS_CHANGED,
        correlationId: envelope.correlationId,
        payload: {
          billingRecordId: billingRecord.id,
          orderId: billingRecord.orderId,
          paymentAttemptId: paymentAttempt.id,
          billingStatus: updatedBilling?.status ?? "processing",
          paymentStatus: updatedAttempt?.status ?? "processing",
          idempotencyKey,
        },
      }),
    );
  }

  private async findCompensationRecord(
    payload: CompensationRequestPayload,
  ): Promise<BillingRecord | null> {
    if (payload.billingRecordId) {
      const byId = await this.options.billingRepository.findById(payload.billingRecordId);
      if (byId) {
        return byId;
      }
    }

    return payload.orderId ? this.options.billingRepository.findByOrderId(payload.orderId) : null;
  }

  private async handleCompensation(envelope: MessageEnvelope): Promise<void> {
    const payload = parseCompensationPayload(envelope.payload);
    const billingRecord = await this.findCompensationRecord(payload);
    let paymentAttempt: PaymentAttempt | null = null;
    let result: "completed" | "noop" = "noop";

    if (billingRecord) {
      result = "completed";
      await this.options.billingRepository.updateStatus(billingRecord.id, "canceled");
      const attempts = await this.options.paymentAttemptRepository.listByBillingRecordId(
        billingRecord.id,
      );
      paymentAttempt = attempts[0] ?? null;
      if (paymentAttempt && paymentAttempt.status !== "canceled") {
        paymentAttempt = await this.options.paymentAttemptRepository.updateStatus(
          paymentAttempt.id,
          "canceled",
        );
      }
    }

    await this.options.publisher.publish(
      PAYMENT_COMPENSATION_COMPLETED,
      createBillingEnvelope({
        type: PAYMENT_COMPENSATION_COMPLETED,
        correlationId: envelope.correlationId,
        payload: {
          result,
          requestType: envelope.type,
          billingRecordId: billingRecord?.id ?? payload.billingRecordId ?? null,
          orderId: billingRecord?.orderId ?? payload.orderId ?? null,
          paymentAttemptId: paymentAttempt?.id ?? null,
          reason: payload.reason ?? null,
          idempotencyKey: payload.idempotencyKey ?? envelope.eventId,
        },
      }),
    );
  }
}
