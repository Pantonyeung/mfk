import assert from 'node:assert/strict';
import test from 'node:test';

import {
  KEETA_CAPABILITY_COUNT,
  KEETA_CAPABILITY_REGISTRY,
  KEETA_CERTIFICATION_REGISTRY,
  KEETA_EXTERNAL_EVIDENCE,
  KEETA_RUNTIME_POLICY,
  assertKeetaRuntimePlan,
  estimateScheduledInvocationsPerDay,
  assertKeetaReplayCompatible,
  buildKeetaAfterSaleDecisionShape,
  buildKeetaFullMenuSyncShape,
  buildKeetaOrderConfirmShape,
  buildKeetaOrderReadyShape,
  buildKeetaSignaturePreimage,
  buildKeetaWebhookReplayIdentity,
  createKeetaStoreAliasBinding,
  hhmmToSeconds,
  normalizeKeetaOrderPlacementEvidence,
  normalizeKeetaProviderResponse,
  parseKeetaAfterSaleEvidence,
  parseKeetaWebhookEnvelope,
  sha256HexUtf8,
  toKeetaSellabilityShape,
  unknownKeetaProviderResult,
} from '../src/index.js';

test('signature contract preserves official ordering/serialization/UTF-8/SHA-256 output shape', () => {
  const url = 'https://open.mykeeta.com/api/open/product/shopcategory/update';
  const shopCategory = JSON.stringify({ id: 123, name: 'test', type: 0, description: null });
  const preimage = buildKeetaSignaturePreimage(url, {
    appId: 123,
    timestamp: 1682566749,
    accessToken: 'abc',
    shopId: '123',
    shopCategory,
    sig: 'excluded',
  }, 'abc');
  assert.equal(
    preimage,
    `${url}?accessToken=abc&appId=123&shopCategory=${shopCategory}&shopId=123&timestamp=1682566749abc`,
  );
  assert.equal(sha256HexUtf8(preimage), '48eb6d562bb0673e3db753831f032be237fc19d1e5c33fcb5386d89c0eebca86');
});

test('response normalization is fail-closed across required states', () => {
  assert.equal(normalizeKeetaProviderResponse('{"code":0,"message":"ok","data":{}}').status, 'SUCCESS');
  assert.equal(normalizeKeetaProviderResponse('{"code":7,"message":"no"}').status, 'PROVIDER_REJECTED');
  assert.equal(normalizeKeetaProviderResponse('{"code":0,"message":"ok","errorList":[{"x":1}]}').status, 'PARTIAL');
  assert.equal(normalizeKeetaProviderResponse('bad-json').status, 'MALFORMED');
  assert.equal(unknownKeetaProviderResult().status, 'UNKNOWN');
});

test('menu sync is full snapshot and never wired', () => {
  const shape = buildKeetaFullMenuSyncShape({
    providerShopId: 123,
    payload: {
      shopCategoryList: [{ openItemCode: 'CAT-1', name: '飯團' }],
      choiceGroupList: [{ openItemCode: 'GRP-1', choiceGroupSkuList: [{ openItemCode: 'OPT-1' }] }],
      spuList: [{ openItemCode: 'SPU-1', skuList: [{ openItemCode: 'SKU-1' }] }],
    },
  });
  assert.equal(shape.kind, 'FULL_SNAPSHOT');
  assert.equal(shape.executionGate, 'NOT_WIRED');
  assert.match(shape.destructiveOmissionSemantics, /DELETE_PROVIDER_ENTITY/);
});

test('order placement becomes provider evidence only', () => {
  const envelope = parseKeetaWebhookEnvelope({
    sig: 'a'.repeat(64),
    eventId: 1001,
    appId: 1,
    messageId: 'MSG-1',
    shopId: 2,
    timestamp: 1770000000,
    message: JSON.stringify({ orderInfo: { baseOrder: { orderViewIdStr: 'ORDER-9' } } }),
  });
  const evidence = normalizeKeetaOrderPlacementEvidence(envelope);
  assert.equal(evidence.providerOrderId, 'ORDER-9');
  assert.equal(evidence.formalOrderAuthority, 'ABSENT');
  assert.equal(evidence.executionGate, 'NOT_WIRED');
});

test('provider shop identity is alias only', () => {
  const binding = createKeetaStoreAliasBinding({ canonicalStoreId: 'STORE-MFK-1', providerShopId: 123, evidenceRef: 'E-1' });
  assert.equal(binding.aliasOnly, true);
  assert.throws(
    () => createKeetaStoreAliasBinding({ canonicalStoreId: '123', providerShopId: 123, evidenceRef: 'E-1' }),
    /KEETA_PROVIDER_ALIAS_MUST_NOT_EQUAL_CANONICAL_STORE_ID/,
  );
});

test('merchant and ready commands remain inert and ready is not preparing', () => {
  assert.equal(buildKeetaOrderConfirmShape({ orderViewId: 1, providerShopId: 2 }).executionGate, 'NOT_WIRED');
  assert.equal(buildKeetaOrderReadyShape({ orderViewId: 1, providerShopId: 2, fulfillmentSemantic: 'READY' }).providerSemantic, 'FULLY_PREPARED_READY');
  assert.throws(
    () => buildKeetaOrderReadyShape({ orderViewId: 1, providerShopId: 2, fulfillmentSemantic: 'PREPARING' }),
    /KEETA_PREPARE_ENDPOINT_IS_READY_ONLY/,
  );
});

test('sellability translation does not bind MFK availability authority', () => {
  assert.equal(toKeetaSellabilityShape({ openItemCode: 'SPU-1', state: 'AVAILABLE' }).providerStatus, 1);
  assert.equal(toKeetaSellabilityShape({ openItemCode: 'SPU-1', state: 'SOLD_OUT' }).providerStatus, 0);
  assert.equal(toKeetaSellabilityShape({ openItemCode: 'SPU-1', state: 'PAUSED' }).executionGate, 'NOT_WIRED');
});

test('store hours conversion is pure', () => {
  assert.equal(hhmmToSeconds('05:30'), 19800);
});

test('after-sale evidence is separate from financial authority and decisions are blocked', () => {
  const envelope = parseKeetaWebhookEnvelope({
    sig: 'b'.repeat(64),
    eventId: 1005,
    appId: 1,
    messageId: 'MSG-R1',
    shopId: 2,
    timestamp: 1770000000,
    message: JSON.stringify({
      orderViewId: 88,
      shopId: 2,
      status: 10,
      afterSaleOrderId: 99,
      isAppeal: 0,
      money: 500,
      currency: 'HKD',
      applyOpType: 10,
      applyReason: 'provider refund request',
      handleOpType: 20,
      handleReason: 'provider handling',
      opTime: 1770000000123,
    }),
  });
  const evidence = parseKeetaAfterSaleEvidence(envelope);
  assert.equal(evidence.authorityBoundary, 'PROVIDER_EVIDENCE_NOT_FINANCIAL_REFUND_AUTHORITY');
  const decision = buildKeetaAfterSaleDecisionShape({ decision: 'APPROVE', orderViewId: 88, providerShopId: 2 });
  assert.equal(decision.authorityGate, 'BLOCKED_CANONICAL_AUTHORITY');
  assert.equal(decision.executionGate, 'NOT_WIRED');
});

test('webhook dedup identity conflicts fail closed', () => {
  const envelope = parseKeetaWebhookEnvelope({
    sig: 'c'.repeat(64),
    eventId: 1102,
    appId: 1,
    messageId: 'MSG-X',
    shopId: 2,
    timestamp: 1770000000,
    message: '{"status":1}',
  });
  const replay = buildKeetaWebhookReplayIdentity(envelope);
  assert.equal(assertKeetaReplayCompatible(null, replay.fingerprint), 'NEW');
  assert.equal(assertKeetaReplayCompatible(replay.fingerprint, replay.fingerprint), 'DUPLICATE');
  assert.throws(() => assertKeetaReplayCompatible('0'.repeat(64), replay.fingerprint), /KEETA_WEBHOOK_IDENTITY_CONFLICT/);
});

test('registry has no acceptance claims and preserves known external blockers', () => {
  assert.equal(KEETA_CAPABILITY_COUNT, 35);
  assert.equal(new Set(KEETA_CAPABILITY_REGISTRY.map((x) => x.CAP_ID)).size, KEETA_CAPABILITY_COUNT);
  const serialized = JSON.stringify(KEETA_CERTIFICATION_REGISTRY);
  assert.doesNotMatch(serialized, /SIT_PASS|UAT_PASS|KEETA_ACCEPTED/);
  assert.ok(KEETA_EXTERNAL_EVIDENCE.some((x) => x.evidenceId === 'KEETA_LIVE_WEBHOOK_SIGNING_SEMANTICS_MISMATCH'));
});


test('runtime policy forbids legacy high-frequency orchestration patterns', () => {
  assert.equal(KEETA_RUNTIME_POLICY.mode, 'EVENT_DRIVEN_FIRST');
  assert.equal(KEETA_RUNTIME_POLICY.providerRole, 'THIN_EDGE_ADAPTER_ONLY');
  assert.equal(KEETA_RUNTIME_POLICY.businessHours.timeZone, 'Asia/Hong_Kong');
  assert.equal(KEETA_RUNTIME_POLICY.businessHours.startLocal, '10:00');
  assert.equal(KEETA_RUNTIME_POLICY.businessHours.endLocal, '20:30');
  assert.equal(KEETA_RUNTIME_POLICY.offHoursMode, 'LOW_TRAFFIC_MODE');

  assert.equal(estimateScheduledInvocationsPerDay(1), 1440);
  assert.equal(estimateScheduledInvocationsPerDay(30, 810), 27);

  assert.throws(() => assertKeetaRuntimePlan({
    trigger: 'SAFETY_SWEEP',
    purpose: 'liveness poll',
    maxBatch: 1,
    onePurposeOnly: true,
    trafficMode: 'LOW_TRAFFIC_MODE',
    intervalMinutes: 1,
    expectedCpuMs: 1,
    providerCpuLimitMs: 10,
    stopCondition: 'one check',
    backoff: 'none',
  }), /KEETA_SAFETY_SWEEP_TOO_FREQUENT/);

  assert.throws(() => assertKeetaRuntimePlan({
    trigger: 'SAFETY_SWEEP',
    purpose: 'multi-domain drain',
    maxBatch: 50,
    onePurposeOnly: false,
    trafficMode: 'BUSINESS_HOURS',
    intervalMinutes: 5,
    expectedCpuMs: 2,
    providerCpuLimitMs: 10,
    stopCondition: 'bounded',
    backoff: 'exponential',
  }), /KEETA_RUNTIME_ONE_PURPOSE_REQUIRED/);

  assert.throws(() => assertKeetaRuntimePlan({
    trigger: 'WEBHOOK',
    purpose: 'provider ingress',
    maxBatch: 1,
    onePurposeOnly: true,
    backgroundDiscoveryPoll: true,
    expectedCpuMs: 2,
    providerCpuLimitMs: 10,
    stopCondition: 'one webhook',
    backoff: 'provider-safe',
  }), /KEETA_BACKGROUND_DISCOVERY_POLL_FORBIDDEN/);
});

test('runtime policy accepts a thin event-driven provider edge plan', () => {
  assert.equal(assertKeetaRuntimePlan({
    trigger: 'WEBHOOK',
    purpose: 'verify normalize dedup and handoff one provider event',
    maxBatch: 1,
    onePurposeOnly: true,
    backgroundDiscoveryPoll: false,
    usesSleepDelay: false,
    ownsCanonicalTruth: false,
    expectedCpuMs: 2,
    providerCpuLimitMs: 10,
    stopCondition: 'one provider event processed or fail closed',
    backoff: 'no blind retry; canonical readback before retry',
  }), true);
});
