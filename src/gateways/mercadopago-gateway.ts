import type { MercadoPagoConfig } from "../config/env";
import type { PaymentAttemptStatus } from "../repositories/billing";
import {
  type PaymentChargeInput,
  type PaymentChargeResult,
  type PaymentGateway,
  PaymentGatewayError,
  type PaymentStatusResult,
} from "./payment-gateway";

// Mercado Pago Payments API status values mapped onto the Billing-owned
// gateway-agnostic PaymentAttemptStatus domain. See:
// https://www.mercadopago.com/developers/en/reference/payments/_payments/post
const MERCADOPAGO_STATUS_MAP: Record<string, PaymentAttemptStatus> = {
  approved: "succeeded",
  accredited: "succeeded",
  pending: "pending",
  in_process: "processing",
  in_mediation: "processing",
  authorized: "processing",
  rejected: "failed",
  cancelled: "canceled",
  refunded: "canceled",
  charged_back: "failed",
};

function mapMercadoPagoStatus(status: string): PaymentAttemptStatus {
  return MERCADOPAGO_STATUS_MAP[status] ?? "processing";
}

function centsToAmount(amountCents: number): number {
  return Math.round(amountCents) / 100;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

type MercadoPagoPaymentResponse = {
  id: number | string;
  status: string;
  status_detail?: string;
};

function isMercadoPagoPaymentResponse(value: unknown): value is MercadoPagoPaymentResponse {
  return (
    isRecord(value) &&
    (typeof value.id === "number" || typeof value.id === "string") &&
    typeof value.status === "string"
  );
}

type RequestInput = {
  method: "GET" | "POST";
  headers?: Record<string, string>;
  body?: unknown;
};

/**
 * Concrete `PaymentGateway` implementation backed by the Mercado Pago
 * Payments API (Checkout API), authenticated with a bearer access token.
 * Uses the platform `fetch` directly; this repository has no shared HTTP
 * client wrapper to reuse for outbound calls.
 */
export class MercadoPagoGateway implements PaymentGateway {
  readonly provider = "mercadopago";

  constructor(private readonly config: MercadoPagoConfig) {}

  async charge(input: PaymentChargeInput): Promise<PaymentChargeResult> {
    const paymentMethodId = (input.metadata?.paymentMethodId as string | undefined) ?? "pix";
    const response = await this.request("/v1/payments", {
      method: "POST",
      headers: { "X-Idempotency-Key": input.idempotencyKey },
      body: {
        transaction_amount: centsToAmount(input.amountCents),
        description: input.description ?? `Billing record ${input.billingRecordId}`,
        external_reference: input.correlationId,
        payment_method_id: paymentMethodId,
        payer: { email: input.payerEmail ?? "billing@workshop.local" },
        metadata: {
          billingRecordId: input.billingRecordId,
          orderId: input.orderId,
          customerId: input.customerId,
          ...input.metadata,
        },
      },
    });

    return {
      providerReference: String(response.id),
      status: mapMercadoPagoStatus(response.status),
      raw: response as unknown as Record<string, unknown>,
    };
  }

  async getStatus(providerReference: string): Promise<PaymentStatusResult> {
    const response = await this.request(`/v1/payments/${encodeURIComponent(providerReference)}`, {
      method: "GET",
    });

    return {
      providerReference: String(response.id),
      status: mapMercadoPagoStatus(response.status),
      raw: response as unknown as Record<string, unknown>,
    };
  }

  private async request(path: string, init: RequestInput): Promise<MercadoPagoPaymentResponse> {
    let response: Response;
    try {
      response = await fetch(`${this.config.baseUrl}${path}`, {
        method: init.method,
        headers: {
          Authorization: `Bearer ${this.config.accessToken}`,
          "Content-Type": "application/json",
          ...init.headers,
        },
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      });
    } catch (error) {
      throw new PaymentGatewayError("Failed to reach Mercado Pago", error);
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      throw new PaymentGatewayError("Mercado Pago returned a non-JSON response", error);
    }

    if (!response.ok) {
      const message =
        isRecord(payload) && typeof payload.message === "string"
          ? payload.message
          : `Mercado Pago request failed with status ${response.status}`;
      throw new PaymentGatewayError(message, payload);
    }

    if (!isMercadoPagoPaymentResponse(payload)) {
      throw new PaymentGatewayError("Mercado Pago response missing id/status fields", payload);
    }

    return payload;
  }
}
