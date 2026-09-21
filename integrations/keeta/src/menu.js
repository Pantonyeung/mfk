import { EXECUTION_GATE, PROVIDER_OPERATIONS } from './constants.js';

const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const nonEmpty = (value) => typeof value === 'string' && value.trim().length > 0;
const duplicate = (values) => new Set(values).size !== values.length;

function validateIdentityList(list, prefix, issues) {
  if (!Array.isArray(list)) {
    issues.push(`KEETA_MENU_${prefix}_LIST_REQUIRED`);
    return [];
  }
  const codes = [];
  for (const entry of list) {
    if (!isRecord(entry) || !nonEmpty(entry.openItemCode)) {
      issues.push(`KEETA_MENU_${prefix}_OPEN_ITEM_CODE_REQUIRED`);
      continue;
    }
    codes.push(entry.openItemCode);
  }
  if (duplicate(codes)) issues.push(`KEETA_MENU_${prefix}_OPEN_ITEM_CODE_DUPLICATE`);
  return list;
}

export function validateKeetaFullMenuSnapshot(payload) {
  const issues = [];
  if (!isRecord(payload)) return Object.freeze({ ok: false, issues: ['KEETA_MENU_PAYLOAD_REQUIRED'] });

  const categories = validateIdentityList(payload.shopCategoryList, 'CATEGORY', issues);
  const groups = validateIdentityList(payload.choiceGroupList, 'CHOICE_GROUP', issues);
  const spus = validateIdentityList(payload.spuList, 'SPU', issues);

  if (categories.length > 100) issues.push('KEETA_MENU_CATEGORY_LIMIT_EXCEEDED');
  if (groups.length > 2000) issues.push('KEETA_MENU_CHOICE_GROUP_LIMIT_EXCEEDED');
  if (spus.length > 2000) issues.push('KEETA_MENU_SPU_LIMIT_EXCEEDED');

  const categoryNames = categories.filter(isRecord).map((x) => x.name).filter(nonEmpty);
  if (categoryNames.length !== categories.length) issues.push('KEETA_MENU_CATEGORY_NAME_REQUIRED');
  if (duplicate(categoryNames)) issues.push('KEETA_MENU_CATEGORY_NAME_DUPLICATE');

  const skus = [];
  for (const spu of spus) {
    if (!isRecord(spu) || !Array.isArray(spu.skuList)) {
      issues.push('KEETA_MENU_SKU_LIST_REQUIRED');
      continue;
    }
    skus.push(...spu.skuList);
  }
  validateIdentityList(skus, 'SKU', issues);

  const options = [];
  for (const group of groups) {
    if (!isRecord(group) || !Array.isArray(group.choiceGroupSkuList)) {
      issues.push('KEETA_MENU_CHOICE_GROUP_SKU_LIST_REQUIRED');
      continue;
    }
    options.push(...group.choiceGroupSkuList);
  }
  if (options.length > 10000) issues.push('KEETA_MENU_CHOICE_GROUP_SKU_LIMIT_EXCEEDED');
  validateIdentityList(options, 'CHOICE_GROUP_SKU', issues);

  return issues.length === 0
    ? Object.freeze({ ok: true, issues: [] })
    : Object.freeze({ ok: false, issues: Object.freeze([...new Set(issues)]) });
}

export function buildKeetaFullMenuSyncShape({ providerShopId, payload, snapshotDisposition = 'FULL_STORE_MENU' }) {
  if (!Number.isSafeInteger(providerShopId) || providerShopId <= 0) throw new Error('KEETA_PROVIDER_SHOP_ID_INVALID');
  if (snapshotDisposition !== 'FULL_STORE_MENU') throw new Error('KEETA_MENU_SYNC_REQUIRES_FULL_STORE_MENU');
  const validation = validateKeetaFullMenuSnapshot(payload);
  if (!validation.ok) throw new Error(validation.issues.join(','));

  return Object.freeze({
    providerOperation: PROVIDER_OPERATIONS.menuSync,
    kind: 'FULL_SNAPSHOT',
    destructiveOmissionSemantics: 'OMITTED_EXISTING_OPEN_ITEM_CODE_MAY_DELETE_PROVIDER_ENTITY',
    executionGate: EXECUTION_GATE.NOT_WIRED,
    providerShopId,
    payload: Object.freeze({ ...payload }),
  });
}

const parseMessage = (envelope) => {
  let parsed;
  try {
    parsed = JSON.parse(envelope.message);
  } catch {
    throw new Error('KEETA_MENU_WEBHOOK_MESSAGE_INVALID_JSON');
  }
  if (!isRecord(parsed)) throw new Error('KEETA_MENU_WEBHOOK_MESSAGE_INVALID_SHAPE');
  return parsed;
};

const positive = (value, code) => {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(code);
  return value;
};

const optionalPositive = (value, code) => value === undefined || value === null ? null : positive(value, code);

const parseErrors = (value, code) => {
  if (value === undefined || value === null) return Object.freeze([]);
  if (!Array.isArray(value)) throw new Error(code);
  return Object.freeze(value.map((entry) => {
    if (!isRecord(entry)) throw new Error(code);
    return Object.freeze({
      openItemCode: typeof entry.openItemCode === 'string' ? entry.openItemCode : undefined,
      code: typeof entry.code === 'number' ? entry.code : undefined,
      message: typeof entry.message === 'string' ? entry.message : undefined,
      raw: Object.freeze({ ...entry }),
    });
  }));
};

export function parseKeetaMenuCompletion(envelope) {
  if (envelope.eventId !== 1202) throw new Error('KEETA_MENU_WEBHOOK_EVENT_MISMATCH');
  const payload = parseMessage(envelope);
  const shopId = positive(payload.shopId, 'KEETA_MENU_WEBHOOK_SHOP_ID_INVALID');
  if (shopId !== envelope.providerShopId) throw new Error('KEETA_MENU_WEBHOOK_SHOP_ID_MISMATCH');
  const errors = parseErrors(payload.errorSpuDTOList, 'KEETA_MENU_WEBHOOK_ERROR_SPU_LIST_INVALID');
  return Object.freeze({
    eventId: 1202,
    providerShopId: envelope.providerShopId,
    providerMessageId: envelope.messageId,
    taskId: positive(payload.taskId, 'KEETA_MENU_WEBHOOK_TASK_ID_INVALID'),
    pictureTaskId: optionalPositive(payload.pictureTaskId, 'KEETA_MENU_WEBHOOK_PICTURE_TASK_ID_INVALID'),
    errors,
    completionStatus: errors.length === 0 ? 'SUCCESS' : 'PARTIAL',
  });
}

export function parseKeetaPictureTaskCompletion(envelope) {
  if (envelope.eventId !== 1201) throw new Error('KEETA_MENU_WEBHOOK_EVENT_MISMATCH');
  const payload = parseMessage(envelope);
  const shopId = positive(payload.shopId, 'KEETA_MENU_WEBHOOK_SHOP_ID_INVALID');
  if (shopId !== envelope.providerShopId) throw new Error('KEETA_MENU_WEBHOOK_SHOP_ID_MISMATCH');
  const errors = parseErrors(payload.errorList, 'KEETA_MENU_WEBHOOK_ERROR_LIST_INVALID');
  return Object.freeze({
    eventId: 1201,
    providerShopId: envelope.providerShopId,
    providerMessageId: envelope.messageId,
    taskId: positive(payload.taskId, 'KEETA_MENU_WEBHOOK_TASK_ID_INVALID'),
    mainTaskId: optionalPositive(payload.mainTaskId, 'KEETA_MENU_WEBHOOK_MAIN_TASK_ID_INVALID'),
    errors,
    completionStatus: errors.length === 0 ? 'SUCCESS' : 'PARTIAL',
  });
}

export function unknownKeetaMenuReadback(reason = 'COMPLETION_WEBHOOK_NOT_OBSERVED') {
  return Object.freeze({ completionStatus: 'UNKNOWN', reason, executionGate: EXECUTION_GATE.NOT_WIRED });
}
