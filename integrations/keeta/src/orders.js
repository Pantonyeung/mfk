import { EXECUTION_GATE, PROVIDER_OPERATIONS } from './constants.js';

const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const positive = (value, code) => {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(code);
  return value;
};
const nonEmpty = (value, code) => {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(code);
  return value.trim();
};

function request(providerOperation, params, extra = {}) {
  return Object.freeze({
    providerOperation,
    params: Object.freeze({ ...params }),
    executionGate: EXECUTION_GATE.NOT_WIRED,
    ...extra,
  });
}

function identity({ orderViewId, providerShopId }) {
  return {
    orderViewId: positive(orderViewId, 'KEETA_ORDER_VIEW_ID_INVALID'),
    shopId: positive(providerShopId, 'KEETA_PROVIDER_SHOP_ID_INVALID'),
  };
}

export function normalizeKeetaOrderPlacementEvidence(envelope) {
  if (envelope.eventId !== 1001) throw new Error('KEETA_ORDER_PLACEMENT_EVENT_REQUIRED');
  let message;
  try { message = JSON.parse(envelope.message); } catch { throw new Error('KEETA_ORDER_WEBHOOK_MESSAGE_INVALID_JSON'); }
  if (!isRecord(message) || !isRecord(message.orderInfo) || !isRecord(message.orderInfo.baseOrder)) {
    throw new Error('KEETA_ORDER_PLACEMENT_ORDER_INFO_REQUIRED');
  }
  const providerOrderId = nonEmpty(message.orderInfo.baseOrder.orderViewIdStr, 'KEETA_STANDARD_ORDER_ID_REQUIRED');
  return Object.freeze({
    evidenceKind: 'PROVIDER_ORDER_PLACEMENT',
    provider: 'KEETA',
    providerOrderId,
    providerMessageId: envelope.messageId,
    providerShopId: envelope.providerShopId,
    providerStoreAlias: Object.freeze({ provider: 'KEETA', providerShopId: envelope.providerShopId }),
    dedupIdentity: `KEETA:${envelope.messageId}`,
    normalizedProviderEvidence: Object.freeze({
      eventId: 1001,
      timestampSeconds: envelope.timestampSeconds,
      orderInfo: Object.freeze({ ...message.orderInfo }),
    }),
    formalOrderAuthority: 'ABSENT',
    executionGate: EXECUTION_GATE.NOT_WIRED,
  });
}

export function buildKeetaOrderConfirmShape(input) {
  return request(PROVIDER_OPERATIONS.orderConfirm, identity(input), { action: 'CONFIRM' });
}

export function buildKeetaOrderCancelShape(input) {
  const cancelCode = input.cancelCode;
  if (![500000, 500001, 500002, 500003].includes(cancelCode)) throw new Error('KEETA_CANCEL_CODE_INVALID');
  if (cancelCode === 500000 && (!input.cancelReason || input.cancelReason.trim().length === 0)) {
    throw new Error('KEETA_CANCEL_REASON_REQUIRED');
  }
  return request(PROVIDER_OPERATIONS.orderCancel, {
    ...identity(input),
    cancelCode,
    ...(input.cancelReason ? { cancelReason: input.cancelReason } : {}),
  }, { action: input.action === 'REJECT' ? 'REJECT' : 'CANCEL', translationBoundary: 'EXPLICIT_PROVIDER_CODE_ONLY' });
}

export function buildKeetaOrderReadyShape(input) {
  if (input.fulfillmentSemantic !== 'READY') throw new Error('KEETA_PREPARE_ENDPOINT_IS_READY_ONLY');
  return request(PROVIDER_OPERATIONS.orderReady, identity(input), {
    action: 'READY',
    providerSemantic: 'FULLY_PREPARED_READY',
    genericPreparingSupported: false,
  });
}

export function parseKeetaAfterSaleEvidence(envelope) {
  if (envelope.eventId !== 1005 && envelope.eventId !== 1007) throw new Error('KEETA_AFTERSALE_EVENT_UNSUPPORTED');
  let raw;
  try { raw = JSON.parse(envelope.message); } catch { throw new Error('KEETA_ORDER_WEBHOOK_MESSAGE_INVALID_JSON'); }
  if (!isRecord(raw)) throw new Error('KEETA_ORDER_WEBHOOK_MESSAGE_INVALID_SHAPE');
  const payloadShopId = positive(raw.shopId, 'KEETA_REFUND_SHOP_ID_INVALID');
  if (payloadShopId !== envelope.providerShopId) throw new Error('KEETA_ORDER_WEBHOOK_SHOP_ID_MISMATCH');

  const base = {
    eventId: envelope.eventId,
    providerOrderId: String(positive(raw.orderViewId, 'KEETA_REFUND_ORDER_VIEW_ID_INVALID')),
    providerShopId: envelope.providerShopId,
    providerMessageId: envelope.messageId,
    providerRefundStatus: Number.isSafeInteger(raw.status) ? raw.status : (() => { throw new Error('KEETA_REFUND_STATUS_INVALID'); })(),
    afterSaleOrderId: String(positive(raw.afterSaleOrderId, 'KEETA_REFUND_AFTER_SALE_ID_INVALID')),
    refundAmountMinor: positive(raw.money, 'KEETA_REFUND_AMOUNT_INVALID'),
    isAppeal: raw.isAppeal === 0 || raw.isAppeal === 1 ? raw.isAppeal : (() => { throw new Error('KEETA_REFUND_APPEAL_INVALID'); })(),
    raw: Object.freeze({ ...raw }),
    authorityBoundary: 'PROVIDER_EVIDENCE_NOT_FINANCIAL_REFUND_AUTHORITY',
  };
  return Object.freeze(base);
}

export function presentKeetaAfterSaleStatus(evidence) {
  return Object.freeze({
    providerStatus: evidence.providerRefundStatus,
    amountMinor: evidence.refundAmountMinor,
    presentation: 'PROVIDER_AFTERSALE_EVIDENCE',
    financialLifecycleDecision: 'UNRESOLVED_BY_KEETA_ADAPTER',
  });
}

export function buildKeetaAfterSaleDecisionShape(input) {
  const approve = input.decision === 'APPROVE';
  if (!approve && input.decision !== 'REJECT') throw new Error('KEETA_AFTERSALE_DECISION_INVALID');
  const params = identity(input);
  if (!approve) {
    if (![100000, 100001, 100002].includes(input.rejectCode)) throw new Error('KEETA_REFUND_REJECT_CODE_INVALID');
    if (input.rejectCode === 100000 && (!input.rejectReason || input.rejectReason.trim().length === 0)) {
      throw new Error('KEETA_REFUND_REJECT_REASON_REQUIRED');
    }
  }
  return Object.freeze({
    providerOperation: approve ? PROVIDER_OPERATIONS.refundAgree : PROVIDER_OPERATIONS.refundReject,
    params: Object.freeze(approve ? params : {
      ...params,
      rejectCode: input.rejectCode,
      ...(input.rejectReason ? { rejectReason: input.rejectReason } : {}),
    }),
    action: approve ? 'APPROVE_AFTERSALE' : 'REJECT_AFTERSALE',
    authorityGate: EXECUTION_GATE.BLOCKED_CANONICAL_AUTHORITY,
    executionGate: EXECUTION_GATE.NOT_WIRED,
  });
}
