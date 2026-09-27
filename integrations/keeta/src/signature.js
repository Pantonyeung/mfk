import { createHash, timingSafeEqual } from 'node:crypto';

const signatureValue = (value) => {
  if (value === null) return 'null';
  if (value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

export function buildKeetaSignaturePreimage(url, params, appSecret) {
  if (typeof url !== 'string' || url.length === 0) throw new Error('KEETA_SIGNATURE_URL_REQUIRED');
  if (typeof appSecret !== 'string' || appSecret.length === 0) throw new Error('KEETA_APP_SECRET_UNAVAILABLE');
  if (!params || typeof params !== 'object' || Array.isArray(params)) throw new Error('KEETA_SIGNATURE_PARAMS_INVALID');

  const ordered = Object.keys(params)
    .filter((key) => key !== 'sig')
    .sort()
    .map((key) => `${key}=${signatureValue(params[key])}`)
    .join('&');

  return `${url}?${ordered}${appSecret}`;
}

export function sha256HexUtf8(value) {
  if (typeof value !== 'string') throw new Error('KEETA_SIGNATURE_PREIMAGE_REQUIRED');
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function signKeetaShape(url, params, appSecret) {
  const preimage = buildKeetaSignaturePreimage(url, params, appSecret);
  return Object.freeze({
    algorithm: 'SHA-256',
    encoding: 'UTF-8',
    output: 'LOWERCASE_HEX_64',
    preimage,
    sig: sha256HexUtf8(preimage),
  });
}

export function verifyKeetaSignatureShape(url, signedParams, appSecret) {
  if (!signedParams || typeof signedParams !== 'object' || Array.isArray(signedParams)) {
    throw new Error('KEETA_SIGNATURE_PARAMS_INVALID');
  }
  const provided = signedParams.sig;
  if (typeof provided !== 'string' || !/^[0-9a-fA-F]{64}$/.test(provided)) {
    throw new Error('KEETA_WEBHOOK_SIGNATURE_INVALID');
  }
  const preimage = buildKeetaSignaturePreimage(url, signedParams, appSecret);
  const expected = Buffer.from(sha256HexUtf8(preimage), 'hex');
  const actual = Buffer.from(provided.toLowerCase(), 'hex');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new Error('KEETA_WEBHOOK_SIGNATURE_INVALID');
  }
  return Object.freeze({
    verified: true,
    algorithm: 'SHA-256',
    encoding: 'UTF-8',
    preimageRule: 'ASCII_KEY_ORDER_SIG_EXCLUDED_EMPTY_INCLUDED_JSON_AS_SERIALIZED',
  });
}

export function credentialRef(name = 'KEETA_APP_SECRET') {
  if (typeof name !== 'string' || name.trim().length === 0) throw new Error('KEETA_CREDENTIAL_REF_REQUIRED');
  return Object.freeze({ provider: 'KEETA', kind: 'SECRET_REF', name: name.trim() });
}

export function missingSecretFailure(ref = credentialRef()) {
  return Object.freeze({
    ok: false,
    code: 'KEETA_APP_SECRET_UNAVAILABLE',
    classification: 'MISSING_SECRET',
    credentialRef: ref,
    failClosed: true,
  });
}
