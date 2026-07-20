import { type Channel, type ChannelModel, type ConsumeMessage, connect } from "amqplib";
import type { RabbitMqConfig } from "../config/env";
import type { BillingRepository, PaymentAttemptRepository } from "../repositories/billing";
import { type MessageEnvelope, parseEnvelope, serializeEnvelope } from "./envelope";
import {
  BillingMessageHandler,
  PAYMENT_COMPENSATION_COMPLETED,
  PAYMENT_STATUS_CHANGED,
} from "./handlers";

export class RabbitMqPublisher {
  constructor(
    private readonly channel: Channel,
    private readonly config: RabbitMqConfig,
  ) {}

  async publish(routingKey: string, envelope: MessageEnvelope): Promise<void> {
    await this.channel.assertExchange(this.config.exchange, "topic", { durable: true });
    const configuredRoutingKey = this.configuredRoutingKey(routingKey);
    this.channel.publish(this.config.exchange, configuredRoutingKey, serializeEnvelope(envelope), {
      contentType: "application/json",
      deliveryMode: 2,
      correlationId: envelope.correlationId,
      messageId: envelope.eventId,
      type: envelope.type,
    });
  }

  private configuredRoutingKey(routingKey: string): string {
    if (routingKey === PAYMENT_STATUS_CHANGED) {
      return this.config.statusRoutingKey;
    }
    if (routingKey === PAYMENT_COMPENSATION_COMPLETED) {
      return this.config.compensationResultRoutingKey;
    }
    return routingKey;
  }
}

export type RabbitMqRuntime = {
  close(): Promise<void>;
};

export type RabbitMqRuntimeOptions = {
  config: RabbitMqConfig;
  billingRepository: BillingRepository;
  paymentAttemptRepository: PaymentAttemptRepository;
};

export async function startRabbitMqRuntime({
  config,
  billingRepository,
  paymentAttemptRepository,
}: RabbitMqRuntimeOptions): Promise<RabbitMqRuntime | null> {
  if (!config.consumersEnabled) {
    return null;
  }

  const connection = await connect(config.url);
  const channel = await connection.createChannel();
  const publisher = new RabbitMqPublisher(channel, config);
  const handler = new BillingMessageHandler({
    billingRepository,
    paymentAttemptRepository,
    publisher,
  });
  await channel.assertExchange(config.exchange, "topic", { durable: true });
  await bindQueue(channel, config.authorizationQueue, [config.authorizationRoutingKey], config);
  await bindQueue(channel, config.compensationQueue, config.compensationRoutingKeys, config);

  const consume = async (message: ConsumeMessage | null) => {
    if (!message) {
      return;
    }

    try {
      await handler.handle(parseEnvelope(message.content));
      channel.ack(message);
    } catch (error) {
      console.error("RabbitMQ message handling failed", error);
      channel.nack(message, false, false);
    }
  };

  await channel.consume(config.authorizationQueue, consume, { noAck: false });
  await channel.consume(config.compensationQueue, consume, { noAck: false });

  return {
    async close() {
      await channel.close();
      await (connection as ChannelModel).close();
    },
  };
}

async function bindQueue(
  channel: Channel,
  queue: string,
  routingKeys: string[],
  config: RabbitMqConfig,
): Promise<void> {
  await channel.assertQueue(queue, { durable: true });
  for (const routingKey of routingKeys) {
    await channel.bindQueue(queue, config.exchange, routingKey);
  }
}
