import { type Context, Hono } from "hono";
import type { PaymentGateway } from "../gateways/payment-gateway";
import {
  type BillingRecord,
  type BillingRecordStatus,
  type PaymentAttempt,
  type PaymentAttemptStatus,
  billingStatusForAttemptStatus,
} from "../repositories/billing";

export type BillingRecordReaderWriter = {
  create(input: {
    orderId: string;
    customerId: string;
    amountCents: number;
    currency: string;
    idempotencyKey: string;
    correlationId: string;
  }): Promise<BillingRecord>;
  findById(id: string): Promise<BillingRecord | null>;
  findByIdempotencyKey(idempotencyKey: string): Promise<BillingRecord | null>;
  updateStatus(id: string, status: BillingRecordStatus): Promise<BillingRecord | null>;
};

export type PaymentAttemptReaderWriter = {
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
  updateStatus(id: string, status: PaymentAttemptStatus): Promise<PaymentAttempt | null>;
};

type BillingRoutesOptions = {
  billingRepository?: BillingRecordReaderWriter;
  paymentAttemptRepository?: PaymentAttemptReaderWriter;
  /**
   * Optional concrete payment gateway (e.g. Mercado Pago). When absent the
   * payment-attempt contract stays gateway-agnostic exactly as before: callers
   * supply their own opaque `provider`/`providerReference`. When present, the
   * service charges through the gateway at creation time and can resolve
   * status updates (e.g. from a webhook) by querying the gateway directly.
   */
  paymentGateway?: PaymentGateway;
};

type ValidationError = {
  field: string;
  message: string;
};

const paymentAttemptStatuses = [
  "pending",
  "processing",
  "succeeded",
  "failed",
  "canceled",
] as const;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function optionalNonEmptyString(value: unknown): value is string | undefined {
  return value === undefined || isNonEmptyString(value);
}

function validationResponse(c: Context, details: ValidationError[]) {
  return c.json(
    {
      error: {
        code: "validation_error",
        message: "Request validation failed",
        details,
      },
    },
    400,
  );
}

function notFoundResponse(c: Context, message: string) {
  return c.json(
    {
      error: {
        code: "not_found",
        message,
      },
    },
    404,
  );
}

function unavailableResponse(c: Context) {
  return c.json(
    {
      error: {
        code: "database_unconfigured",
        message: "Billing persistence is not configured",
      },
    },
    503,
  );
}

function serializeBillingRecord(record: BillingRecord) {
  return {
    id: record.id,
    orderId: record.orderId,
    customerId: record.customerId,
    amountCents: record.amountCents,
    currency: record.currency,
    status: record.status,
    idempotencyKey: record.idempotencyKey,
    correlationId: record.correlationId,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function serializePaymentAttempt(attempt: PaymentAttempt) {
  return {
    id: attempt.id,
    billingRecordId: attempt.billingRecordId,
    status: attempt.status,
    provider: attempt.provider,
    providerReference: attempt.providerReference,
    idempotencyKey: attempt.idempotencyKey,
    correlationId: attempt.correlationId,
    metadata: attempt.metadata,
    createdAt: attempt.createdAt.toISOString(),
    updatedAt: attempt.updatedAt.toISOString(),
  };
}

function mayAttemptPayment(status: BillingRecordStatus): boolean {
  return status === "pending" || status === "processing" || status === "failed";
}

async function readJsonBody(c: Context) {
  try {
    const body = await c.req.json();
    return isObject(body) ? body : null;
  } catch {
    return null;
  }
}

function validateBillingCreate(body: Record<string, unknown> | null): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!body) {
    return [{ field: "body", message: "JSON object body is required" }];
  }
  if (!isNonEmptyString(body.orderId)) {
    errors.push({ field: "orderId", message: "orderId is required" });
  }
  if (!isNonEmptyString(body.customerId)) {
    errors.push({ field: "customerId", message: "customerId is required" });
  }
  if (!Number.isInteger(body.amountCents) || (body.amountCents as number) <= 0) {
    errors.push({ field: "amountCents", message: "amountCents must be a positive integer" });
  }
  if (!isNonEmptyString(body.currency) || !/^[A-Za-z]{3}$/.test(body.currency)) {
    errors.push({ field: "currency", message: "currency must be a 3-letter ISO code" });
  }
  if (!isNonEmptyString(body.idempotencyKey)) {
    errors.push({ field: "idempotencyKey", message: "idempotencyKey is required" });
  }
  if (!isNonEmptyString(body.correlationId)) {
    errors.push({ field: "correlationId", message: "correlationId is required" });
  }

  return errors;
}

function validatePaymentAttemptCreate(body: Record<string, unknown> | null): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!body) {
    return [{ field: "body", message: "JSON object body is required" }];
  }
  if (!isNonEmptyString(body.idempotencyKey)) {
    errors.push({ field: "idempotencyKey", message: "idempotencyKey is required" });
  }
  if (!isNonEmptyString(body.correlationId)) {
    errors.push({ field: "correlationId", message: "correlationId is required" });
  }
  if (!optionalNonEmptyString(body.provider)) {
    errors.push({
      field: "provider",
      message: "provider must be a non-empty string when provided",
    });
  }
  if (!optionalNonEmptyString(body.providerReference)) {
    errors.push({
      field: "providerReference",
      message: "providerReference must be a non-empty string when provided",
    });
  }
  if (!optionalNonEmptyString(body.payerEmail)) {
    errors.push({
      field: "payerEmail",
      message: "payerEmail must be a non-empty string when provided",
    });
  }
  if (body.metadata !== undefined && !isObject(body.metadata)) {
    errors.push({ field: "metadata", message: "metadata must be an object when provided" });
  }

  return errors;
}

/**
 * The status-report contract accepts either an explicit gateway-agnostic
 * `status` (unchanged legacy behavior), or a `providerReference` identifying
 * a provider-side payment so the configured payment gateway can be queried
 * for the authoritative status. The latter is how a Mercado Pago webhook
 * notification (which only reliably carries a payment id) is translated into
 * a status update without trusting an unauthenticated webhook body directly.
 */
function validatePaymentStatus(body: Record<string, unknown> | null): ValidationError[] {
  if (!body) {
    return [{ field: "body", message: "JSON object body is required" }];
  }

  if (body.status !== undefined) {
    if (
      !isNonEmptyString(body.status) ||
      !paymentAttemptStatuses.includes(body.status as PaymentAttemptStatus)
    ) {
      return [
        {
          field: "status",
          message: "status must be one of pending, processing, succeeded, failed, canceled",
        },
      ];
    }
    return [];
  }

  if (!isNonEmptyString(body.providerReference)) {
    return [
      {
        field: "status",
        message: "status is required, or providerReference to resolve status via the gateway",
      },
    ];
  }

  return [];
}

export function createBillingRoutes(options: BillingRoutesOptions): Hono {
  const billing = new Hono();

  billing.post("/billing-records", async (c) => {
    if (!options.billingRepository) {
      return unavailableResponse(c);
    }

    const body = await readJsonBody(c);
    const errors = validateBillingCreate(body);
    if (errors.length > 0 || !body) {
      return validationResponse(c, errors);
    }

    const existing = await options.billingRepository.findByIdempotencyKey(
      body.idempotencyKey as string,
    );
    if (existing) {
      return c.json(
        { billingRecord: serializeBillingRecord(existing), idempotentReplay: true },
        200,
      );
    }

    const record = await options.billingRepository.create({
      orderId: body.orderId as string,
      customerId: body.customerId as string,
      amountCents: body.amountCents as number,
      currency: (body.currency as string).toUpperCase(),
      idempotencyKey: body.idempotencyKey as string,
      correlationId: body.correlationId as string,
    });

    return c.json({ billingRecord: serializeBillingRecord(record), idempotentReplay: false }, 201);
  });

  billing.get("/billing-records/:id/quote", async (c) => {
    if (!options.billingRepository) {
      return unavailableResponse(c);
    }

    const record = await options.billingRepository.findById(c.req.param("id"));
    if (!record) {
      return notFoundResponse(c, "Billing record not found");
    }

    return c.json({
      quote: {
        billingRecordId: record.id,
        orderId: record.orderId,
        customerId: record.customerId,
        amountCents: record.amountCents,
        currency: record.currency,
        status: record.status,
        canAttemptPayment: mayAttemptPayment(record.status),
        correlationId: record.correlationId,
      },
    });
  });

  billing.post("/billing-records/:id/payment-attempts", async (c) => {
    if (!options.billingRepository || !options.paymentAttemptRepository) {
      return unavailableResponse(c);
    }

    const billingRecordId = c.req.param("id");
    const record = await options.billingRepository.findById(billingRecordId);
    if (!record) {
      return notFoundResponse(c, "Billing record not found");
    }

    const body = await readJsonBody(c);
    const errors = validatePaymentAttemptCreate(body);
    if (errors.length > 0 || !body) {
      return validationResponse(c, errors);
    }

    const existing = await options.paymentAttemptRepository.findByIdempotencyKey(
      body.idempotencyKey as string,
    );
    if (existing) {
      return c.json(
        { paymentAttempt: serializePaymentAttempt(existing), idempotentReplay: true },
        200,
      );
    }

    const idempotencyKey = body.idempotencyKey as string;
    const correlationId = body.correlationId as string;
    let provider = body.provider as string | undefined;
    let providerReference = body.providerReference as string | undefined;
    let status: PaymentAttemptStatus = "pending";
    let metadata = body.metadata as Record<string, unknown> | undefined;
    let updatedBillingRecord: BillingRecord | undefined;

    if (options.paymentGateway) {
      provider = options.paymentGateway.provider;
      try {
        const chargeResult = await options.paymentGateway.charge({
          billingRecordId,
          orderId: record.orderId,
          customerId: record.customerId,
          amountCents: record.amountCents,
          currency: record.currency,
          idempotencyKey,
          correlationId,
          payerEmail: body.payerEmail as string | undefined,
          metadata,
        });
        providerReference = chargeResult.providerReference;
        status = chargeResult.status;
        metadata = { ...(metadata ?? {}), gateway: chargeResult.raw ?? {} };
      } catch (error) {
        status = "failed";
        metadata = {
          ...(metadata ?? {}),
          gatewayError: error instanceof Error ? error.message : "Unknown gateway error",
        };
      }

      updatedBillingRecord =
        (await options.billingRepository.updateStatus(
          billingRecordId,
          billingStatusForAttemptStatus(status),
        )) ?? undefined;
    }

    const attempt = await options.paymentAttemptRepository.create({
      billingRecordId,
      status,
      provider,
      providerReference,
      idempotencyKey,
      correlationId,
      metadata,
    });

    return c.json(
      {
        paymentAttempt: serializePaymentAttempt(attempt),
        idempotentReplay: false,
        ...(updatedBillingRecord
          ? { billingRecord: serializeBillingRecord(updatedBillingRecord) }
          : {}),
      },
      201,
    );
  });

  billing.post("/billing-records/:id/payment-attempts/:attemptId/status", async (c) => {
    if (!options.billingRepository || !options.paymentAttemptRepository) {
      return unavailableResponse(c);
    }

    const billingRecordId = c.req.param("id");
    const attemptId = c.req.param("attemptId");
    const body = await readJsonBody(c);
    const errors = validatePaymentStatus(body);
    if (errors.length > 0 || !body) {
      return validationResponse(c, errors);
    }

    const record = await options.billingRepository.findById(billingRecordId);
    if (!record) {
      return notFoundResponse(c, "Billing record not found");
    }

    const attempt = await options.paymentAttemptRepository.findById(attemptId);
    if (!attempt || attempt.billingRecordId !== billingRecordId) {
      return notFoundResponse(c, "Payment attempt not found");
    }

    let status: PaymentAttemptStatus;
    if (isNonEmptyString(body.status)) {
      status = body.status as PaymentAttemptStatus;
    } else if (options.paymentGateway) {
      try {
        const gatewayStatus = await options.paymentGateway.getStatus(
          body.providerReference as string,
        );
        status = gatewayStatus.status;
      } catch (error) {
        return c.json(
          {
            error: {
              code: "gateway_error",
              message:
                error instanceof Error ? error.message : "Payment gateway status lookup failed",
            },
          },
          502,
        );
      }
    } else {
      return c.json(
        {
          error: {
            code: "gateway_unconfigured",
            message: "A payment gateway must be configured to resolve status by providerReference",
          },
        },
        503,
      );
    }

    const updatedAttempt = await options.paymentAttemptRepository.updateStatus(attemptId, status);
    const updatedBilling = await options.billingRepository.updateStatus(
      billingRecordId,
      billingStatusForAttemptStatus(status),
    );

    if (!updatedAttempt || !updatedBilling) {
      return notFoundResponse(c, "Payment status target not found");
    }

    return c.json({
      paymentAttempt: serializePaymentAttempt(updatedAttempt),
      billingRecord: serializeBillingRecord(updatedBilling),
    });
  });

  return billing;
}
