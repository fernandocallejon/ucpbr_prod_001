// ============================================================
// RetailNexus — Azure Service Bus Client
// ============================================================

import {
  ServiceBusClient,
  ServiceBusSender,
  ServiceBusMessage,
} from "@azure/service-bus";
import { getConfig } from "../config/env.js";
import { SERVICE_BUS_QUEUES } from "@retailnexus/shared";

let _client: ServiceBusClient | null = null;
const _senders: Map<string, ServiceBusSender> = new Map();

export function getServiceBusClient(): ServiceBusClient {
  if (!_client) {
    const config = getConfig();
    _client = new ServiceBusClient(config.serviceBus.connection);
  }
  return _client;
}

function getSender(queueName: string): ServiceBusSender {
  if (!_senders.has(queueName)) {
    const client = getServiceBusClient();
    _senders.set(queueName, client.createSender(queueName));
  }
  return _senders.get(queueName)!;
}

/**
 * Send a message to a Service Bus queue.
 */
export async function sendToQueue(
  queueName: string,
  body: unknown,
  options?: {
    sessionId?: string;
    scheduledEnqueueTimeUtc?: Date;
    correlationId?: string;
  }
): Promise<void> {
  const sender = getSender(queueName);
  const message: ServiceBusMessage = {
    body,
    contentType: "application/json",
    sessionId: options?.sessionId,
    scheduledEnqueueTimeUtc: options?.scheduledEnqueueTimeUtc,
    correlationId: options?.correlationId,
  };
  await sender.sendMessages(message);
}

/**
 * Send batch of messages to a queue.
 */
export async function sendBatchToQueue(
  queueName: string,
  messages: unknown[]
): Promise<void> {
  const sender = getSender(queueName);
  const batch = await sender.createMessageBatch();

  for (const body of messages) {
    const msg: ServiceBusMessage = {
      body,
      contentType: "application/json",
    };
    if (!batch.tryAddMessage(msg)) {
      // Batch full, send and create a new one
      await sender.sendMessages(batch);
      const newBatch = await sender.createMessageBatch();
      if (!newBatch.tryAddMessage(msg)) {
        throw new Error("Message too large for Service Bus batch");
      }
    }
  }

  if (batch.count > 0) {
    await sender.sendMessages(batch);
  }
}

// ─── Typed senders ───

export const queues = {
  scanRequests: {
    send: (body: unknown) =>
      sendToQueue(SERVICE_BUS_QUEUES.SCAN_REQUESTS, body),
    sendBatch: (bodies: unknown[]) =>
      sendBatchToQueue(SERVICE_BUS_QUEUES.SCAN_REQUESTS, bodies),
  },
  priceCalculations: {
    send: (body: unknown) =>
      sendToQueue(SERVICE_BUS_QUEUES.PRICE_CALCULATIONS, body),
    sendBatch: (bodies: unknown[]) =>
      sendBatchToQueue(SERVICE_BUS_QUEUES.PRICE_CALCULATIONS, bodies),
  },
  googlePush: {
    send: (body: unknown) =>
      sendToQueue(SERVICE_BUS_QUEUES.GOOGLE_PUSH, body),
    sendBatch: (bodies: unknown[]) =>
      sendBatchToQueue(SERVICE_BUS_QUEUES.GOOGLE_PUSH, bodies),
  },
  storeSync: {
    send: (body: unknown) =>
      sendToQueue(SERVICE_BUS_QUEUES.STORE_SYNC, body),
  },
};
