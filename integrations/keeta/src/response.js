const malformed = (reason, raw = undefined) => Object.freeze({
  ok: false,
  status: 'MALFORMED',
  failClosed: true,
  reason,
  ...(raw === undefined ? {} : { raw }),
});

export function normalizeKeetaProviderResponse(rawBody) {
  if (typeof rawBody !== 'string') return malformed('KEETA_RESPONSE_BODY_NOT_STRING');

  let parsed;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return malformed('KEETA_RESPONSE_INVALID_JSON');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)
    || typeof parsed.code !== 'number'
    || !Number.isFinite(parsed.code)
    || typeof parsed.message !== 'string'
    || (parsed.errorList !== undefined && !Array.isArray(parsed.errorList))) {
    return malformed('KEETA_RESPONSE_INVALID_SHAPE', parsed);
  }

  const base = {
    code: parsed.code,
    message: parsed.message,
    data: parsed.data,
    errorList: parsed.errorList,
  };

  if (parsed.code !== 0) {
    return Object.freeze({ ok: false, status: 'PROVIDER_REJECTED', failClosed: true, ...base });
  }
  if (Array.isArray(parsed.errorList) && parsed.errorList.length > 0) {
    return Object.freeze({ ok: false, status: 'PARTIAL', failClosed: true, ...base });
  }
  return Object.freeze({ ok: true, status: 'SUCCESS', failClosed: false, ...base });
}

export function unknownKeetaProviderResult(reason = 'NO_AUTHORITATIVE_PROVIDER_RESPONSE') {
  return Object.freeze({
    ok: false,
    status: 'UNKNOWN',
    failClosed: true,
    reason,
  });
}
