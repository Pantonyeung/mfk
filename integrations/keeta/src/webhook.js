import { createHash } from 'node:crypto';
import { KEETA_WEBHOOK_EVENTS } from './constants.js';

const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const positive = (value, code) => {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(code);
  return value;
};
const textValue = (value, code) => {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(code);
  return value;
};

export function parseKeetaWebhookEnvelope(body) {
  if (!isRecord(body)) throw new Error('KEETA_WEBHOOK_BODY_INVALID');
  const eventId = positive(body.eventId, 'KEETA_WEBHOOK_EVENT_ID_INVALID');
  if (!Object.prototype.hasOwnProperty.call(KEETA_WEBHOOK_EVENTS, eventId)) {
    throw new Error('KEETA_WEBHOOK_EVENT_UNKNOWN');
  }
  const sig = textValue(body.sig, 'KEETA_WEBHOOK_SIGNATURE_REQUIRED');
  if (!/^[0-9a-fA-F]{64}$/.test(sig)) throw new Error('KEETA_WEBHOOK_SIGNATURE_INVALID');

  return Object.freeze({
    eventId,
    eventName: KEETA_WEBHOOK_EVENTS[eventId],
    appId: positive(body.appId, 'KEETA_WEBHOOK_APP_ID_INVALID'),
    messageId: textValue(body.messageId, 'KEETA_WEBHOOK_MESSAGE_ID_REQUIRED'),
    providerShopId: positive(body.shopId, 'KEETA_WEBHOOK_PROVIDER_SHOP_ID_INVALID'),
    message: typeof body.message === 'string' ? body.message : (() => { throw new Error('KEETA_WEBHOOK_MESSAGE_INVALID'); })(),
    timestampSeconds: positive(body.timestamp, 'KEETA_WEBHOOK_TIMESTAMP_INVALID'),
    signatureEvidence: Object.freeze({
      providedSignature: sig.toLowerCase(),
      verificationState: 'REQUIRES_SECRET_PROVIDER_AT_FUTURE_RUNTIME',
      failClosedOnMismatch: true,
    }),
  });
}

export function keetaWebhookUnsignedParameters(body) {
  if (!isRecord(body)) throw new Error('KEETA_WEBHOOK_BODY_INVALID');
  const copy = { ...body };
  delete copy.sig;
  return Object.freeze(copy);
}

export function buildKeetaWebhookReplayIdentity(envelope) {
  const evidence = {
    eventId: envelope.eventId,
    appId: envelope.appId,
    messageId: envelope.messageId,
    providerShopId: envelope.providerShopId,
    message: envelope.message,
    timestampSeconds: envelope.timestampSeconds,
  };
  return Object.freeze({
    dedupKey: `KEETA:${envelope.messageId}`,
    fingerprint: createHash('sha256').update(JSON.stringify(evidence), 'utf8').digest('hex'),
    evidence: Object.freeze(evidence),
  });
}

export function classifyKeetaReplay(existingFingerprint, incomingFingerprint) {
  if (existingFingerprint === null || existingFingerprint === undefined) return 'NEW';
  if (existingFingerprint === incomingFingerprint) return 'DUPLICATE';
  return 'CONFLICT';
}

export function assertKeetaReplayCompatible(existingFingerprint, incomingFingerprint) {
  const result = classifyKeetaReplay(existingFingerprint, incomingFingerprint);
  if (result === 'CONFLICT') throw new Error('KEETA_WEBHOOK_IDENTITY_CONFLICT');
  return result;
}
