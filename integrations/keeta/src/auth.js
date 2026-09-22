import { EXECUTION_GATE } from './constants.js';

export const KEETA_STANDARD_OAUTH_MODE = 'STANDARD_OAUTH_2_REDIRECT_ONLY';
export const KEETA_STANDARD_OAUTH_AUTHORIZE_URL = 'https://merchant.mykeeta.com/m/web/openapi/authorize';
export const KEETA_TOKEN_URL = 'https://open.mykeeta.com/api/open/base/oauth/token';

const PROACTIVE_REFRESH_WINDOW_MS = 5 * 24 * 60 * 60 * 1000;

const positive = (value, code) => {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(code);
  return value;
};

const nonEmpty = (value, code) => {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(code);
  return value.trim();
};

function requireHttpsRedirectUri(redirectUri) {
  let parsed;
  try {
    parsed = new URL(nonEmpty(redirectUri, 'KEETA_OAUTH_REDIRECT_URI_INVALID'));
  } catch {
    throw new Error('KEETA_OAUTH_REDIRECT_URI_INVALID');
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
    throw new Error('KEETA_OAUTH_REDIRECT_URI_INVALID');
  }
  return parsed.toString();
}

export function buildKeetaOAuthAuthorizationShape({ appId, redirectUri, state, scope = 'all' }) {
  positive(appId, 'KEETA_OAUTH_APP_ID_INVALID');
  const normalizedState = nonEmpty(state, 'KEETA_OAUTH_STATE_REQUIRED');
  const normalizedRedirectUri = requireHttpsRedirectUri(redirectUri);
  const url = new URL(KEETA_STANDARD_OAUTH_AUTHORIZE_URL);
  url.searchParams.set('responseType', 'authorization_code');
  url.searchParams.set('appId', String(appId));
  url.searchParams.set('redirectUri', normalizedRedirectUri);
  url.searchParams.set('state', normalizedState);
  url.searchParams.set('scope', nonEmpty(scope, 'KEETA_OAUTH_SCOPE_REQUIRED'));
  return Object.freeze({
    mode: KEETA_STANDARD_OAUTH_MODE,
    authorizationUrl: url.toString(),
    state: normalizedState,
    executionGate: EXECUTION_GATE.NOT_WIRED,
    authorityBoundary: 'PROVIDER_AUTH_SHAPE_ONLY_NO_RUNTIME_STATE_STORE',
  });
}

export function validateKeetaOAuthCallbackShape({ expectedState, returnedState, code }) {
  const expected = nonEmpty(expectedState, 'KEETA_OAUTH_EXPECTED_STATE_REQUIRED');
  const returned = nonEmpty(returnedState, 'KEETA_OAUTH_RETURNED_STATE_REQUIRED');
  if (expected !== returned) throw new Error('KEETA_OAUTH_STATE_INVALID_OR_REUSED');
  return Object.freeze({
    stateVerified: true,
    state: returned,
    authorizationCode: nonEmpty(code, 'KEETA_OAUTH_CODE_REQUIRED'),
    executionGate: EXECUTION_GATE.NOT_WIRED,
  });
}

export function parseKeetaTokenMaterial(rawBody) {
  let parsed;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    throw new Error('KEETA_TOKEN_RESPONSE_INVALID_JSON');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)
    || typeof parsed.accessToken !== 'string' || parsed.accessToken.length === 0
    || parsed.tokenType !== 'bearer'
    || !Number.isFinite(parsed.expiresIn) || parsed.expiresIn <= 0
    || typeof parsed.refreshToken !== 'string' || parsed.refreshToken.length === 0
    || typeof parsed.scope !== 'string'
    || !Number.isFinite(parsed.issuedAtTime) || parsed.issuedAtTime < 0) {
    throw new Error('KEETA_TOKEN_RESPONSE_INVALID_SHAPE');
  }
  return Object.freeze({
    accessToken: parsed.accessToken,
    tokenType: 'bearer',
    expiresIn: parsed.expiresIn,
    refreshToken: parsed.refreshToken,
    scope: parsed.scope,
    issuedAtTime: parsed.issuedAtTime,
  });
}

export function assessKeetaTokenLifecycle({ issuedAtTime, expiresIn, nowMs }) {
  if (!Number.isFinite(issuedAtTime) || issuedAtTime < 0
    || !Number.isFinite(expiresIn) || expiresIn <= 0
    || !Number.isFinite(nowMs) || nowMs < 0) {
    throw new Error('KEETA_TOKEN_METADATA_INVALID');
  }
  const expiresAtMs = issuedAtTime + expiresIn * 1000;
  const refreshAtMs = expiresAtMs - PROACTIVE_REFRESH_WINDOW_MS;
  const disposition = nowMs >= expiresAtMs
    ? 'EXPIRED'
    : nowMs >= refreshAtMs ? 'REFRESH_DUE' : 'VALID';
  return Object.freeze({
    disposition,
    expiresAtMs,
    refreshAtMs,
    refreshAttempts: 3,
    minRefreshIntervalMs: 60_000,
    oldTokenGraceMs: 3_600_000,
  });
}

function tokenRequest(params) {
  return Object.freeze({
    providerOperation: KEETA_TOKEN_URL,
    params: Object.freeze(params),
    executionGate: EXECUTION_GATE.NOT_WIRED,
    signatureRequired: true,
    credentialRef: 'KEETA_APP_SECRET',
    authorityBoundary: 'PROVIDER_AUTH_ONLY_NO_LIVE_SECRET_BINDING',
  });
}

export function buildKeetaAuthorizationCodeExchangeShape({ appId, code, timestamp }) {
  return tokenRequest({
    appId: positive(appId, 'KEETA_TOKEN_REQUEST_INPUT_INVALID'),
    timestamp: positive(timestamp, 'KEETA_TOKEN_REQUEST_INPUT_INVALID'),
    grantType: 'authorization_code',
    code: nonEmpty(code, 'KEETA_AUTHORIZATION_CODE_INPUT_INVALID'),
  });
}

export function buildKeetaRefreshTokenShape({ appId, refreshToken, timestamp }) {
  return tokenRequest({
    appId: positive(appId, 'KEETA_TOKEN_REQUEST_INPUT_INVALID'),
    timestamp: positive(timestamp, 'KEETA_TOKEN_REQUEST_INPUT_INVALID'),
    grantType: 'refresh_token',
    refreshToken: nonEmpty(refreshToken, 'KEETA_TOKEN_REFRESH_INPUT_INVALID'),
  });
}

export function classifyKeetaErrorCode(code) {
  if (!Number.isInteger(code)) return 'OTHER_PROVIDER_ERROR';
  if (code >= 115000100 && code <= 115000199) return 'SIGNATURE';
  if (code >= 115000200 && code <= 115000399) return 'BUSINESS_PARAMETER';
  if (code >= 315000100 && code <= 315000199) return 'SERVER_EXCEPTION';
  return 'OTHER_PROVIDER_ERROR';
}
