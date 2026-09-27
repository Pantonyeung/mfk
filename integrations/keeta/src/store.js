import { EXECUTION_GATE, PROVIDER_OPERATIONS } from './constants.js';

const weekdays = Object.freeze(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);

const positive = (value, code) => {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(code);
  return value;
};

export function createKeetaStoreAliasBinding({ canonicalStoreId, providerShopId, evidenceRef }) {
  if (typeof canonicalStoreId !== 'string' || canonicalStoreId.trim().length === 0) throw new Error('MFK_CANONICAL_STORE_ID_REQUIRED');
  positive(providerShopId, 'KEETA_PROVIDER_SHOP_ID_INVALID');
  if (String(providerShopId) === canonicalStoreId.trim()) throw new Error('KEETA_PROVIDER_ALIAS_MUST_NOT_EQUAL_CANONICAL_STORE_ID');
  if (typeof evidenceRef !== 'string' || evidenceRef.trim().length === 0) throw new Error('KEETA_STORE_ALIAS_EVIDENCE_REQUIRED');
  return Object.freeze({
    canonicalStoreId: canonicalStoreId.trim(),
    provider: 'KEETA',
    providerShopId,
    evidenceRef: evidenceRef.trim(),
    aliasOnly: true,
  });
}

export function toKeetaSellabilityShape({ openItemCode, state, target = 'SPU' }) {
  if (typeof openItemCode !== 'string' || openItemCode.trim().length === 0) throw new Error('KEETA_OPEN_ITEM_CODE_REQUIRED');
  if (!['AVAILABLE', 'SOLD_OUT', 'PAUSED'].includes(state)) throw new Error('KEETA_SELLABILITY_STATE_INVALID');
  if (!['SPU', 'CHOICE_GROUP_SKU'].includes(target)) throw new Error('KEETA_SELLABILITY_TARGET_INVALID');
  return Object.freeze({
    target,
    openItemCode: openItemCode.trim(),
    sourceState: state,
    providerStatus: state === 'AVAILABLE' ? 1 : 0,
    executionGate: EXECUTION_GATE.NOT_WIRED,
    authorityBoundary: 'TRANSLATION_ONLY_NO_MFK_AVAILABILITY_BINDING',
  });
}

export function hhmmToSeconds(value) {
  if (typeof value !== 'string') throw new Error('KEETA_STORE_TIME_INVALID');
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error('KEETA_STORE_TIME_INVALID');
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) throw new Error('KEETA_STORE_TIME_INVALID');
  return (hour * 60 + minute) * 60;
}

export function validateKeetaBusinessHours(hours) {
  if (!hours || typeof hours !== 'object' || Array.isArray(hours)) throw new Error('KEETA_STORE_BUSINESS_HOURS_REQUIRED');
  for (const day of weekdays) {
    const periods = hours[day];
    if (!Array.isArray(periods)) throw new Error(`KEETA_STORE_BUSINESS_HOURS_${day.toUpperCase()}_REQUIRED`);
    if (periods.length > 1 && periods.some((p) => p.startTime === 0 && p.endTime === 0)) {
      throw new Error('KEETA_STORE_FULL_DAY_CLOSURE_MUST_BE_SINGLE_PERIOD');
    }
    const normalized = [...periods].sort((a, b) => a.startTime - b.startTime);
    for (const period of normalized) {
      if (!Number.isSafeInteger(period.startTime) || !Number.isSafeInteger(period.endTime)
        || period.startTime < 0 || period.endTime < 0
        || period.startTime > 86400 || period.endTime > 86400) {
        throw new Error('KEETA_STORE_BUSINESS_HOUR_RANGE_INVALID');
      }
    }
    for (let i = 1; i < normalized.length; i += 1) {
      if (normalized[i - 1].endTime > normalized[i].startTime) throw new Error('KEETA_STORE_BUSINESS_HOURS_OVERLAP');
    }
  }
  return true;
}

export function buildKeetaStoreHoursShape({ providerShopId, businessHourOfTheWeek }) {
  positive(providerShopId, 'KEETA_PROVIDER_SHOP_ID_INVALID');
  validateKeetaBusinessHours(businessHourOfTheWeek);
  return Object.freeze({
    providerOperation: PROVIDER_OPERATIONS.storeHoursUpdate,
    params: Object.freeze({ shopId: providerShopId, businessHourOfTheWeek }),
    executionGate: EXECUTION_GATE.NOT_WIRED,
    authorityBoundary: 'NO_ADMIN_STORE_CONFIG_BINDING',
  });
}

export function buildKeetaStoreOperationalShape({ providerShopId, action }) {
  positive(providerShopId, 'KEETA_PROVIDER_SHOP_ID_INVALID');
  if (!['REST', 'OPEN'].includes(action)) throw new Error('KEETA_STORE_OPERATIONAL_ACTION_INVALID');
  return Object.freeze({
    providerOperation: action === 'REST' ? PROVIDER_OPERATIONS.storeRest : PROVIDER_OPERATIONS.storeOpen,
    params: Object.freeze({ shopId: providerShopId }),
    action,
    executionGate: EXECUTION_GATE.NOT_WIRED,
    invariant: 'KEETA_REST_OPEN_IS_NOT_MFK_STORE_ACTIVE_INACTIVE_LIFECYCLE',
  });
}


export function buildKeetaStoreDetailsShape({ providerShopId }) {
  if (!Number.isSafeInteger(providerShopId) || providerShopId <= 0) throw new Error('KEETA_PROVIDER_SHOP_ID_INVALID');
  return Object.freeze({
    providerOperation: PROVIDER_OPERATIONS.storeDetails,
    params: Object.freeze({ shopId: providerShopId }),
    action: 'STORE_DETAILS_READBACK',
    authorityBoundary: 'PROVIDER_READBACK_ONLY',
    executionGate: EXECUTION_GATE.NOT_WIRED,
  });
}

export function buildKeetaStoreHoursGetShape({ providerShopId }) {
  if (!Number.isSafeInteger(providerShopId) || providerShopId <= 0) throw new Error('KEETA_PROVIDER_SHOP_ID_INVALID');
  return Object.freeze({
    providerOperation: PROVIDER_OPERATIONS.storeHoursGet,
    params: Object.freeze({ shopId: providerShopId }),
    action: 'STORE_HOURS_READBACK',
    authorityBoundary: 'PROVIDER_READBACK_ONLY',
    executionGate: EXECUTION_GATE.NOT_WIRED,
  });
}
