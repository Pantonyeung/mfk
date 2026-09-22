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
  keetaProviderOrderRef,
  normalizeKeetaObservedSystemCancellationEvidence,
  normalizeKeetaOrderLifecycleEventEvidence,
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
  assert.equal(KEETA_CAPABILITY_COUNT, 35);
  assert.equal(KEETA_COMPLETENESS_SCOPE.state, 'PROVIDER_COMPLETE_NOT_WIRED');
  const exclusions = JSON.stringify(KEETA_DONOR_EXCLUSIONS);
  assert.match(exclusions, /LEGACY_D1_CANONICAL_ACCEPTANCE/);
  assert.match(exclusions, /LIVE_RUNTIME_WIRING_FORBIDDEN_DURING_COMPLETENESS/);
});
