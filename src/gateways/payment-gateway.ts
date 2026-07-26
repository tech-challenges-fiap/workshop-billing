import type { PaymentAttemptStatus } from "../repositories/billing";

export type PaymentChargeInput = {
  billingRecordId: string;
  orderId: string;
  customerId: string;
  amountCents: number;
  currency: string;
  idempotencyKey: string;
  correlationId: string;
  payerEmail?: string;
  description?: string;
  metadata?: Record<string, unknown>;
};

export type PaymentChargeResult = {
  providerReference: string;
  status: PaymentAttemptStatus;
  raw?: Record<string, unknown>;
};

export type PaymentStatusResult = {
  providerReference: string;
  status: PaymentAttemptStatus;
  raw?: Record<string, unknown>;
};

/**
 * Gateway-facing contract for creating a charge and resolving its status with a
 * concrete payment provider. Implementations are optional at runtime: the
 * Billing Service remains gateway-agnostic when no `PaymentGateway` is wired,
 * and delegates to a concrete adapter (e.g. `MercadoPagoGateway`) when one is
 * configured. See `src/config/env.ts#getMercadoPagoConfig` for the opt-in
 * configuration pattern and `src/index.ts` for wiring.
 */
export type PaymentGateway = {
  readonly provider: string;
  charge(input: PaymentChargeInput): Promise<PaymentChargeResult>;
  getStatus(providerReference: string): Promise<PaymentStatusResult>;
};

export class PaymentGatewayError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "PaymentGatewayError";
  }
}
