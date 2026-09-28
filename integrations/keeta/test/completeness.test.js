import assert from 'node:assert/strict';
import test from 'node:test';

import {
  KEETA_CAPABILITY_COUNT,
  KEETA_COMPLETENESS_SCOPE,
  KEETA_DONOR_EXCLUSIONS,
  assessKeetaTokenLifecycle,
  buildKeetaAuthorizationCodeExchangeShape,
  buildKeetaOAuthAuthorizationShape,
  buildKeetaOptionAliasRequest,
  buildKeetaOrderGetShape,
  buildKeetaProductAliasRequest,
  buildKeetaRefreshTokenShape,
  buildKeetaWebhookConfigurationShape,
  buildKeetaOrderCollectShape,
  buildKeetaPartialRefundPreviewShape,
  buildKeetaPartialRefundApplyShape,
  buildKeetaStoreDetailsShape,
  buildKeetaStoreHoursGetShape,
  keetaProviderOrderRef,
  normalizeKeetaObservedSystemCancellationEvidence,
  normalizeKeetaOrderLifecycleEventEvidence,
  normalizeKeetaDeliveryStatusEvidence,
  normalizeKeetaOrderPlacementEvidence,
  normalizeKeetaStandardProviderOrderFacts,
  parseKeetaTokenMaterial,
  parseKeetaWebhookEnvelope,
  resolveKeetaAcceptancePolicy,
  validateKeetaOAuthCallbackShape,
  validateKeetaProviderOrderRef,
} from '../src/index.js';

test('OAuth contract is complete but inert', () => {
  const auth = buildKeetaOAuthAuthorizationShape({
    appId: 123,
    redirectUri: 'https://admin.morefunos.com/integrations/keeta/callback',
    state: 'STATE-1',
  });
  assert.equal(auth.executionGate, 'NOT_WIRED');
  assert.match(auth.authorizationUrl, /responseType=authorization_code/);
  assert.equal(validateKeetaOAuthCallbackShape({
    expectedState: 'STATE-1',
    returnedState: 'STATE-1',
    code: 'CODE-1',
  }).stateVerified, true);
  assert.throws(() => validateKeetaOAuthCallbackShape({
    expectedState: 'STATE-1',
    returnedState: 'STATE-2',
    code: 'CODE-1',
  }), /KEETA_OAUTH_STATE_INVALID_OR_REUSED/);
});

test('token material, lifecycle, exchange and refresh stay provider-only', () => {
  const token = parseKeetaTokenMaterial(JSON.stringify({
    accessToken: 'ACCESS',
    tokenType: 'bearer',
    expiresIn: 864000,
    refreshToken: 'REFRESH',
    scope: 'all',
    issuedAtTime: 1_780_000_000_000,
  }));
  assert.equal(token.tokenType, 'bearer');
  assert.equal(assessKeetaTokenLifecycle({
    issuedAtTime: 1_780_000_000_000,
    expiresIn: 864000,
    nowMs: 1_780_000_001_000,
  }).disposition, 'VALID');
  assert.equal(buildKeetaAuthorizationCodeExchangeShape({
    appId: 123,
    timestamp: 1_780_000_000,
    code: 'CODE',
  }).executionGate, 'NOT_WIRED');
  assert.equal(buildKeetaRefreshTokenShape({
    appId: 123,
    timestamp: 1_780_000_000,
    refreshToken: 'REFRESH',
  }).executionGate, 'NOT_WIRED');
});

test('observed event 1008 is accepted as provider evidence, not cancel authority', () => {
  const envelope = parseKeetaWebhookEnvelope({
    sig: 'a'.repeat(64),
    eventId: 1008,
    appId: 1,
    messageId: 'MSG-1008',
    shopId: 721578302,
    timestamp: 1788613897,
    message: JSON.stringify({
      orderViewId: 5133443347282396,
      opTime: 1788613897209,
      cancelType: 5042,
      opType: 0,
      shopId: 721578302,
      cancelReason: '商家未接單',
      status: 50,
    }),
  });
  const evidence = normalizeKeetaObservedSystemCancellationEvidence(envelope);
  assert.equal(evidence.providerOrderId, '5133443347282396');
  assert.equal(evidence.executionGate, 'NOT_WIRED');
  assert.match(evidence.authorityBoundary, /NOT_MFK_CANCEL_AUTHORITY/);
  assert.equal(normalizeKeetaOrderLifecycleEventEvidence(envelope).eventId, 1008);
});

test('provider order identity and order readback are isolated aliases', () => {
  assert.equal(keetaProviderOrderRef('ORDER-9'), 'KEETA:ORDER-9');
  assert.equal(validateKeetaProviderOrderRef({
    providerOrderId: 'ORDER-9',
    providerRef: 'KEETA:ORDER-9',
  }).aliasOnly, true);
  assert.throws(() => validateKeetaProviderOrderRef({
    providerOrderId: 'ORDER-9',
    providerRef: 'KEETA:OTHER',
  }), /KEETA_PROVIDER_REF_IDENTITY_MISMATCH/);
  const readback = buildKeetaOrderGetShape({ orderViewId: 99, providerShopId: 2 });
  assert.equal(readback.action, 'READBACK');
  assert.equal(readback.executionGate, 'NOT_WIRED');
});

test('product and option mapping stay request contracts only', () => {
  assert.equal(buildKeetaProductAliasRequest({
    skuOpenItemCode: 'SKU-1',
    spuOpenItemCode: 'SPU-1',
    providerSkuId: 'P-SKU-1',
    providerSpuId: 'P-SPU-1',
  }).resolutionAuthority, 'MFK_MAPPING_AUTHORITY_REQUIRED');
  assert.equal(buildKeetaOptionAliasRequest({
    canonicalProductId: 'PRODUCT-1',
    providerGroupCode: 'GROUP-1',
    providerOptionCode: 'OPTION-1',
  }).providerIdsAreAliasesOnly, true);
});

test('acceptance mode is explicit MFK policy input and never live by default', () => {
  const policy = resolveKeetaAcceptancePolicy({
    mode: 'AUTO',
    stormActive: false,
    autoAcceptDelayMs: 3000,
  });
  assert.equal(policy.autoAccept, true);
  assert.equal(policy.autoAcceptDelayMs, 3000);
  assert.equal(policy.executionGate, 'NOT_WIRED');
  assert.throws(() => resolveKeetaAcceptancePolicy({}), /KEETA_ACCEPTANCE_MODE_REQUIRED/);
});

test('completeness ledger keeps live runtime and canonical writers excluded', () => {
  assert.equal(KEETA_CAPABILITY_COUNT, 43);
  assert.equal(KEETA_COMPLETENESS_SCOPE.state, 'PROVIDER_COMPLETE_NOT_WIRED');
  const exclusions = JSON.stringify(KEETA_DONOR_EXCLUSIONS);
  assert.match(exclusions, /LEGACY_D1_CANONICAL_ACCEPTANCE/);
  assert.match(exclusions, /LIVE_RUNTIME_WIRING_FORBIDDEN_DURING_COMPLETENESS/);
});


test('real Standard root baseOrder placement shape is accepted as provider evidence only', () => {
  const envelope = parseKeetaWebhookEnvelope({
    sig: 'b'.repeat(64),
    eventId: 1001,
    appId: 1,
    messageId: 'ROOT-1001',
    shopId: 721578302,
    timestamp: 1788501711,
    message: JSON.stringify({
      tagCodes: [112005, 106100, 103002],
      baseOrder: { orderViewId: 5123443030093253 },
    }),
  });
  const evidence = normalizeKeetaOrderPlacementEvidence(envelope);
  assert.equal(evidence.providerOrderId, '5123443030093253');
  assert.equal(evidence.formalOrderAuthority, 'ABSENT');
  assert.equal(evidence.executionGate, 'NOT_WIRED');
});

test('acceptance completion and cancellation provider events validate documented facts', () => {
  const base = {
    sig: 'c'.repeat(64),
    appId: 1,
    shopId: 466663,
    timestamp: 1751448108,
  };
  const accepted = normalizeKeetaOrderLifecycleEventEvidence(parseKeetaWebhookEnvelope({
    ...base,
    eventId: 1002,
    messageId: 'E-1002',
    message: JSON.stringify({ orderViewId: 1, shopId: 466663, status: 30, opTime: 1751448108144 }),
  }));
  assert.equal(accepted.orderStatus, 30);

  const completed = normalizeKeetaOrderLifecycleEventEvidence(parseKeetaWebhookEnvelope({
    ...base,
    eventId: 1003,
    messageId: 'E-1003',
    message: JSON.stringify({ orderViewId: 1, shopId: 466663, status: 40, opTime: 1751448108144 }),
  }));
  assert.equal(completed.orderStatus, 40);

  const canceled = normalizeKeetaOrderLifecycleEventEvidence(parseKeetaWebhookEnvelope({
    ...base,
    eventId: 1004,
    messageId: 'E-1004',
    message: JSON.stringify({ orderViewId: 1, shopId: 466663, status: 50, opTime: 1751448108144, opType: 10 }),
  }));
  assert.equal(canceled.orderStatus, 50);
  assert.equal(canceled.executionGate, 'NOT_WIRED');
});

test('delivery status accepts only documented logistics statuses and requires opTime', () => {
  for (const logisticsStatus of [0, 10, 20, 25, 30, 50, 99]) {
    const result = normalizeKeetaDeliveryStatusEvidence(parseKeetaWebhookEnvelope({
      sig: 'd'.repeat(64),
      eventId: 1006,
      appId: 1,
      messageId: `E-1006-${logisticsStatus}`,
      shopId: 466663,
      timestamp: 1751448108,
      message: JSON.stringify({
        orderViewId: 756823555555859,
        shopId: 466663,
        logisticsStatus,
        opTime: 1751448108144,
      }),
    }));
    assert.equal(result.logisticsStatus, logisticsStatus);
  }
  assert.throws(() => normalizeKeetaDeliveryStatusEvidence(parseKeetaWebhookEnvelope({
    sig: 'e'.repeat(64),
    eventId: 1006,
    appId: 1,
    messageId: 'E-1006-BAD',
    shopId: 466663,
    timestamp: 1751448108,
    message: JSON.stringify({
      orderViewId: 756823555555859,
      shopId: 466663,
      logisticsStatus: 999,
      opTime: 1751448108144,
    }),
  })), /KEETA_DELIVERY_LOGISTICS_STATUS_INVALID/);
});


test('remaining donor provider request surfaces are present but inert', () => {
  const webhook = buildKeetaWebhookConfigurationShape({
    appId: 1,
    timestamp: 1780000000,
    eventId: 1102,
    callbackUrl: 'https://example.invalid/webhooks/keeta',
    isTest: 1,
  });
  assert.equal(webhook.executionGate, 'NOT_WIRED');

  const collect = buildKeetaOrderCollectShape({ orderViewId: 1, providerShopId: 2 });
  assert.equal(collect.executionGate, 'NOT_WIRED');
  assert.equal(collect.authorityGate, 'BLOCKED_CANONICAL_AUTHORITY');

  const preview = buildKeetaPartialRefundPreviewShape({
    orderViewId: 1,
    providerShopId: 2,
    products: [{ orderProductId: 9, refundCount: 1 }],
  });
  assert.equal(preview.executionGate, 'NOT_WIRED');

  const apply = buildKeetaPartialRefundApplyShape({
    orderViewId: 1,
    providerShopId: 2,
    products: [{ orderProductId: 9, refundCount: 1 }],
    partRefundType: 200001,
  });
  assert.equal(apply.authorityGate, 'BLOCKED_CANONICAL_AUTHORITY');
  assert.equal(apply.executionGate, 'NOT_WIRED');

  assert.equal(buildKeetaStoreDetailsShape({ providerShopId: 2 }).executionGate, 'NOT_WIRED');
  assert.equal(buildKeetaStoreHoursGetShape({ providerShopId: 2 }).executionGate, 'NOT_WIRED');
});


test('standard provider order payload normalizes products options money and mapping seeds without owning Order truth', () => {
  const facts = normalizeKeetaStandardProviderOrderFacts({
    orderInfo: {
      baseOrder: { orderViewIdStr: 'KEETA-O-1', currency: 'HKD' },
      merchantOrder: { orderViewIdStr: 'KEETA-O-1', seqNoStr: 'K-0001' },
      products: [{
        id: 101,
        skuId: 201,
        spuId: 301,
        skuOpenItemCode: 'SKU-1',
        spuOpenItemCode: 'SPU-1',
        name: '紫米飯',
        count: 2,
        currency: 'HKD',
        priceWithGroup: {
          originUnitPrice: 5000,
          unitPrice: 5200,
          originAmount: 10000,
          amount: 10400,
        },
        groups: [{
          groupName: '加料',
          groupOpenItemCode: 'GRP-1',
          shopProductGroupSkuList: [{
            groupSkuOpenItemCode: 'OPT-1',
            spuName: '加蛋',
            count: 1,
            unitPrice: 200,
            currency: 'HKD',
          }],
        }],
      }],
      orderPromotionDtlList: [{ reduceFee: 400 }],
      feeDtls: [
        { code: 'productPrice', currency: 'HKD', price: 10400 },
        { code: 'payTotal', currency: 'HKD', price: 10000 },
      ],
      feeDtl: {
        merchantFee: {
          basicCommission: 1000,
          activityFee: 200,
          earnings: 8800,
        },
      },
    },
    providerCapturedAt: '2026-09-22T12:00:00+08:00',
    providerEvidenceRef: 'KEETA-EVIDENCE-1',
  });
  assert.equal(facts.providerOrderId, 'KEETA-O-1');
  assert.equal(facts.providerEffectiveProductTotalMinor, 10000);
  assert.equal(facts.lines[0].providerUnitAdjustmentMinor, 200);
  assert.equal(facts.lines[0].productAliasRequest.resolutionAuthority, 'MFK_MAPPING_AUTHORITY_REQUIRED');
  assert.equal(facts.lines[0].selectedOptions[0].providerOptionCode, 'OPT-1');
  assert.equal(facts.providerCommercialSnapshot.settlementAuthority, 'PROVIDER_ESTIMATE');
  assert.equal(facts.formalOrderAuthority, 'ABSENT');
  assert.equal(facts.executionGate, 'NOT_WIRED');
});
