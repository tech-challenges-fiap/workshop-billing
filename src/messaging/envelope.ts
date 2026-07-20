export const BILLING_PRODUCER = "workshop-billing";
export const SUPPORTED_SCHEMA_VERSION = 1;

export type MessageEnvelope<TPayload extends Record<string, unknown> = Record<string, unknown>> = {
  eventId: string;
  correlationId: string;
  schemaVersion: number;
  producer: string;
  type: string;
  occurredAt: string;
  payload: TPayload;
};

export class EnvelopeValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnvelopeValidationError";
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function assertEnvelope(value: unknown): asserts value is MessageEnvelope {
  if (!isObject(value)) {
    throw new EnvelopeValidationError("Message envelope must be a JSON object");
  }

  for (const field of ["eventId", "correlationId", "producer", "type", "occurredAt"] as const) {
    if (!isNonEmptyString(value[field])) {
      throw new EnvelopeValidationError(`${field} must be a non-empty string`);
    }
  }

  if (!Number.isInteger(value.schemaVersion) || value.schemaVersion !== SUPPORTED_SCHEMA_VERSION) {
    throw new EnvelopeValidationError(`schemaVersion must be ${SUPPORTED_SCHEMA_VERSION}`);
  }

  if (Number.isNaN(Date.parse(value.occurredAt as string))) {
    throw new EnvelopeValidationError("occurredAt must be a valid ISO timestamp");
  }

  if (!isObject(value.payload)) {
    throw new EnvelopeValidationError("payload must be a JSON object");
  }
}

export function parseEnvelope(input: string | Buffer | Uint8Array): MessageEnvelope {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(input).toString("utf8"));
  } catch {
    throw new EnvelopeValidationError("Message body must be valid JSON");
  }

  assertEnvelope(parsed);
  return parsed;
}

export function serializeEnvelope(envelope: MessageEnvelope): Buffer {
  assertEnvelope(envelope);
  return Buffer.from(JSON.stringify(envelope));
}

export function createBillingEnvelope<TPayload extends Record<string, unknown>>(input: {
  type: string;
  correlationId: string;
  payload: TPayload;
  eventId?: string;
  occurredAt?: Date;
}): MessageEnvelope<TPayload> {
  return {
    eventId: input.eventId ?? crypto.randomUUID(),
    correlationId: input.correlationId,
    schemaVersion: SUPPORTED_SCHEMA_VERSION,
    producer: BILLING_PRODUCER,
    type: input.type,
    occurredAt: (input.occurredAt ?? new Date()).toISOString(),
    payload: input.payload,
  };
}
