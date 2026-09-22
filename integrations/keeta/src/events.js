import { EXECUTION_GATE } from './constants.js';

const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

function parseMessage(envelope) {
  let parsed;
  try {
    parsed = JSON.parse(envelope.message);
  } catch {
    throw new Error('KEETA_WEBHOOK_MESSAGE_INVALID_JSON');
  }
  if (!isRecord(parsed)) throw new Error('KEETA_WEBHOOK_MESSAGE_INVALID_SHAPE');
  return parsed;
}

function optionalProviderOrderId(raw) {
  const direct = raw.orderViewIdStr ?? raw.orderViewId;
  if ((typeof direct === 'string' || typeof direct === 'number') && String(direct).trim()) return String(direct).trim();
  const orderInfo = isRecord(raw.orderInfo) ? raw.orderInfo : null;
  const baseOrder = orderInfo && isRecord(orderInfo.baseOrder) ? orderInfo.baseOrder : null;
  const nested = baseOrder ? (baseOrder.orderViewIdStr ?? baseOrder.orderViewId) : undefined;
  return (typeof nested === 'string' || typeof nested === 'number') && String(nested).trim()
    ? String(nested).trim()
    : null;
}

export function normalizeKeetaProviderEventEvidence(envelope) {
  const raw = parseMessage(envelope);
  return Object.freeze({
    evidenceKind: 'KEETA_PROVIDER_EVENT',
    eventId: envelope.eventId,
    eventName: envelope.eventName,
    providerMessageId: envelope.messageId,
    providerShopId: envelope.providerShopId,
    providerOrderId: optionalProviderOrderId(raw),
    timestampSeconds: envelope.timestampSeconds,
    raw: Object.freeze({ ...raw }),
    executionGate: EXECUTION_GATE.NOT_WIRED,
    authorityBoundary: 'PROVIDER_EVIDENCE_ONLY_NO_MFK_STATE_MUTATION',
  });
}

export function normalizeKeetaOrderLifecycleEventEvidence(envelope) {
  if (![1002, 1003, 1004, 1008].includes(envelope.eventId)) {
    throw new Error('KEETA_ORDER_LIFECYCLE_EVENT_UNSUPPORTED');
  }
  if (envelope.eventId === 1008) return normalizeKeetaObservedSystemCancellationEvidence(envelope);
  return Object.freeze({
    ...normalizeKeetaProviderEventEvidence(envelope),
    evidenceKind: 'KEETA_ORDER_LIFECYCLE_EVENT',
  });
}

export function normalizeKeetaDeliveryStatusEvidence(envelope) {
  if (envelope.eventId !== 1006) throw new Error('KEETA_DELIVERY_STATUS_EVENT_REQUIRED');
  return Object.freeze({
    ...normalizeKeetaProviderEventEvidence(envelope),
    evidenceKind: 'KEETA_DELIVERY_STATUS_EVENT',
  });
}

export function normalizeKeetaStoreChangeEvidence(envelope) {
  if (envelope.eventId !== 1101 && envelope.eventId !== 1102) {
    throw new Error('KEETA_STORE_CHANGE_EVENT_UNSUPPORTED');
  }
  return Object.freeze({
    ...normalizeKeetaProviderEventEvidence(envelope),
    evidenceKind: envelope.eventId === 1101
      ? 'KEETA_STORE_BUSINESS_HOURS_CHANGE'
      : 'KEETA_STORE_STATUS_CHANGE',
  });
}

export function normalizeKeetaObservedSystemCancellationEvidence(envelope) {
  if (envelope.eventId !== 1008) throw new Error('KEETA_SYSTEM_CANCELLATION_EVENT_REQUIRED');
  const raw = parseMessage(envelope);
  const orderViewId = raw.orderViewId;
  const shopId = raw.shopId;
  if (!Number.isSafeInteger(orderViewId) || orderViewId <= 0) throw new Error('KEETA_SYSTEM_CANCELLATION_ORDER_ID_INVALID');
  if (!Number.isSafeInteger(shopId) || shopId <= 0) throw new Error('KEETA_SYSTEM_CANCELLATION_SHOP_ID_INVALID');
  if (shopId !== envelope.providerShopId) throw new Error('KEETA_ORDER_WEBHOOK_SHOP_ID_MISMATCH');
  if (!Number.isSafeInteger(raw.status)) throw new Error('KEETA_SYSTEM_CANCELLATION_STATUS_INVALID');
  if (!Number.isSafeInteger(raw.cancelType)) throw new Error('KEETA_SYSTEM_CANCELLATION_TYPE_INVALID');
  if (!Number.isSafeInteger(raw.opType)) throw new Error('KEETA_SYSTEM_CANCELLATION_OPERATOR_INVALID');
  if (!Number.isSafeInteger(raw.opTime) || raw.opTime <= 0) throw new Error('KEETA_SYSTEM_CANCELLATION_TIME_INVALID');

  return Object.freeze({
    evidenceKind: 'KEETA_OBSERVED_SYSTEM_ORDER_CANCELLATION',
    eventId: 1008,
    providerMessageId: envelope.messageId,
    providerShopId: envelope.providerShopId,
    providerOrderId: String(orderViewId),
    status: raw.status,
    cancelType: raw.cancelType,
    operatorType: raw.opType,
    operationTimeMilliseconds: raw.opTime,
    cancelReason: typeof raw.cancelReason === 'string' ? raw.cancelReason : null,
    raw: Object.freeze({ ...raw }),
    executionGate: EXECUTION_GATE.NOT_WIRED,
    authorityBoundary: 'PROVIDER_CANCELLATION_EVIDENCE_NOT_MFK_CANCEL_AUTHORITY',
  });
}
