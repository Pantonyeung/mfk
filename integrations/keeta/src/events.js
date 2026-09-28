import { EXECUTION_GATE } from './constants.js';

const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const positive = (value, code) => {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(code);
  return value;
};
const integer = (value, code) => {
  if (!Number.isSafeInteger(value)) throw new Error(code);
  return value;
};
const optionalText = (value, code) => {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(code);
  return value.trim();
};
const operatorType = (value, code) => {
  const parsed = integer(value, code);
  if (![0, 10, 20, 30].includes(parsed)) throw new Error(code);
  return parsed;
};
const deliveryStatus = (value) => {
  const parsed = integer(value, 'KEETA_DELIVERY_LOGISTICS_STATUS_INVALID');
  if (![0, 10, 20, 25, 30, 50, 99].includes(parsed)) {
    throw new Error('KEETA_DELIVERY_LOGISTICS_STATUS_INVALID');
  }
  return parsed;
};

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

function requirePayloadShop(raw, envelopeShopId) {
  const payloadShopId = positive(raw.shopId, 'KEETA_ORDER_WEBHOOK_SHOP_ID_INVALID');
  if (payloadShopId !== envelopeShopId) throw new Error('KEETA_ORDER_WEBHOOK_SHOP_ID_MISMATCH');
  return payloadShopId;
}

function commonEvidence(envelope, raw) {
  return {
    providerMessageId: envelope.messageId,
    providerShopId: envelope.providerShopId,
    providerTimestampSeconds: envelope.timestampSeconds,
    raw: Object.freeze({ ...raw }),
    executionGate: EXECUTION_GATE.NOT_WIRED,
    authorityBoundary: 'PROVIDER_EVIDENCE_ONLY_NO_MFK_STATE_MUTATION',
  };
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
    providerOrderId: optionalProviderOrderId(raw),
    ...commonEvidence(envelope, raw),
  });
}

export function normalizeKeetaOrderLifecycleEventEvidence(envelope) {
  if (![1002, 1003, 1004, 1008].includes(envelope.eventId)) {
    throw new Error('KEETA_ORDER_LIFECYCLE_EVENT_UNSUPPORTED');
  }
  if (envelope.eventId === 1008) return normalizeKeetaObservedSystemCancellationEvidence(envelope);

  const raw = parseMessage(envelope);
  const payloadShopId = requirePayloadShop(raw, envelope.providerShopId);
  const base = commonEvidence(envelope, raw);

  if (envelope.eventId === 1002) {
    const orderStatus = integer(raw.status, 'KEETA_ACCEPTANCE_STATUS_INVALID');
    if (orderStatus !== 30) throw new Error('KEETA_ACCEPTANCE_STATUS_INVALID');
    return Object.freeze({
      evidenceKind: 'KEETA_ORDER_ACCEPTANCE_EVENT',
      eventId: 1002,
      orderViewId: positive(raw.orderViewId, 'KEETA_ACCEPTANCE_ORDER_VIEW_ID_INVALID'),
      payloadShopId,
      orderStatus,
      operationTimeMilliseconds: positive(raw.opTime, 'KEETA_ACCEPTANCE_OP_TIME_INVALID'),
      ...base,
    });
  }

  if (envelope.eventId === 1003) {
    const orderStatus = integer(raw.status, 'KEETA_COMPLETION_STATUS_INVALID');
    if (orderStatus !== 40) throw new Error('KEETA_COMPLETION_STATUS_INVALID');
    return Object.freeze({
      evidenceKind: 'KEETA_ORDER_COMPLETION_EVENT',
      eventId: 1003,
      orderViewId: positive(raw.orderViewId, 'KEETA_COMPLETION_ORDER_VIEW_ID_INVALID'),
      payloadShopId,
      orderStatus,
      operationTimeMilliseconds: positive(raw.opTime, 'KEETA_COMPLETION_OP_TIME_INVALID'),
      ...base,
    });
  }

  const orderStatus = integer(raw.status, 'KEETA_CANCELLATION_STATUS_INVALID');
  if (orderStatus !== 50) throw new Error('KEETA_CANCELLATION_STATUS_INVALID');
  return Object.freeze({
    evidenceKind: 'KEETA_ORDER_CANCELLATION_EVENT',
    eventId: 1004,
    orderViewId: positive(raw.orderViewId, 'KEETA_CANCELLATION_ORDER_VIEW_ID_INVALID'),
    payloadShopId,
    orderStatus,
    operationTimeMilliseconds: positive(raw.opTime, 'KEETA_CANCELLATION_OP_TIME_INVALID'),
    operatorType: operatorType(raw.opType, 'KEETA_CANCELLATION_OPERATOR_TYPE_INVALID'),
    ...(optionalText(raw.cancelReason, 'KEETA_CANCELLATION_REASON_INVALID') === undefined
      ? {}
      : { cancelReason: optionalText(raw.cancelReason, 'KEETA_CANCELLATION_REASON_INVALID') }),
    ...base,
  });
}

export function normalizeKeetaDeliveryStatusEvidence(envelope) {
  if (envelope.eventId !== 1006) throw new Error('KEETA_DELIVERY_STATUS_EVENT_REQUIRED');
  const raw = parseMessage(envelope);
  const payloadShopId = requirePayloadShop(raw, envelope.providerShopId);
  return Object.freeze({
    evidenceKind: 'KEETA_DELIVERY_STATUS_EVENT',
    eventId: 1006,
    orderViewId: positive(raw.orderViewId, 'KEETA_DELIVERY_ORDER_VIEW_ID_INVALID'),
    payloadShopId,
    logisticsStatus: deliveryStatus(raw.logisticsStatus),
    operationTimeMilliseconds: positive(raw.opTime, 'KEETA_DELIVERY_OP_TIME_INVALID'),
    ...commonEvidence(envelope, raw),
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
  const orderViewId = positive(raw.orderViewId, 'KEETA_SYSTEM_CANCELLATION_ORDER_ID_INVALID');
  const shopId = positive(raw.shopId, 'KEETA_SYSTEM_CANCELLATION_SHOP_ID_INVALID');
  if (shopId !== envelope.providerShopId) throw new Error('KEETA_ORDER_WEBHOOK_SHOP_ID_MISMATCH');
  const status = integer(raw.status, 'KEETA_SYSTEM_CANCELLATION_STATUS_INVALID');
  const cancelType = integer(raw.cancelType, 'KEETA_SYSTEM_CANCELLATION_TYPE_INVALID');
  const opType = integer(raw.opType, 'KEETA_SYSTEM_CANCELLATION_OPERATOR_INVALID');
  const opTime = positive(raw.opTime, 'KEETA_SYSTEM_CANCELLATION_TIME_INVALID');

  return Object.freeze({
    evidenceKind: 'KEETA_OBSERVED_SYSTEM_ORDER_CANCELLATION',
    eventId: 1008,
    providerMessageId: envelope.messageId,
    providerShopId: envelope.providerShopId,
    providerOrderId: String(orderViewId),
    status,
    cancelType,
    operatorType: opType,
    operationTimeMilliseconds: opTime,
    cancelReason: typeof raw.cancelReason === 'string' ? raw.cancelReason : null,
    raw: Object.freeze({ ...raw }),
    executionGate: EXECUTION_GATE.NOT_WIRED,
    authorityBoundary: 'PROVIDER_CANCELLATION_EVIDENCE_NOT_MFK_CANCEL_AUTHORITY',
  });
}
