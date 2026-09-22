const nonEmpty = (value, code) => {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(code);
  return value.trim();
};

const providerIdentityText = (value, code) => {
  if ((typeof value !== 'string' && typeof value !== 'number') || !String(value).trim()) throw new Error(code);
  return String(value).trim();
};

export function keetaProviderOrderRef(providerOrderId) {
  return `KEETA:${providerIdentityText(providerOrderId, 'KEETA_PROVIDER_ORDER_ID_REQUIRED')}`;
}

export function validateKeetaProviderOrderRef({ providerOrderId, providerRef }) {
  const normalizedOrderId = providerIdentityText(providerOrderId, 'KEETA_PROVIDER_ORDER_ID_REQUIRED');
  const expected = `KEETA:${normalizedOrderId}`;
  if (nonEmpty(providerRef, 'KEETA_PROVIDER_REF_REQUIRED') !== expected) {
    throw new Error('KEETA_PROVIDER_REF_IDENTITY_MISMATCH');
  }
  return Object.freeze({
    provider: 'KEETA',
    providerOrderId: normalizedOrderId,
    providerRef: expected,
    aliasOnly: true,
    canonicalOrderAuthority: 'ABSENT',
  });
}

export function buildKeetaProductAliasRequest({
  skuOpenItemCode,
  spuOpenItemCode,
  providerSkuId,
  providerSpuId,
}) {
  return Object.freeze({
    provider: 'KEETA',
    skuOpenItemCode: nonEmpty(skuOpenItemCode, 'KEETA_STANDARD_SKU_OPEN_ITEM_CODE_REQUIRED'),
    spuOpenItemCode: nonEmpty(spuOpenItemCode, 'KEETA_STANDARD_SPU_OPEN_ITEM_CODE_REQUIRED'),
    providerSkuId: providerIdentityText(providerSkuId, 'KEETA_STANDARD_PROVIDER_SKU_ID_REQUIRED'),
    providerSpuId: providerIdentityText(providerSpuId, 'KEETA_STANDARD_PROVIDER_SPU_ID_REQUIRED'),
    resolutionAuthority: 'MFK_MAPPING_AUTHORITY_REQUIRED',
    providerIdsAreAliasesOnly: true,
  });
}

export function buildKeetaOptionAliasRequest({
  canonicalProductId,
  providerGroupCode,
  providerOptionCode,
}) {
  return Object.freeze({
    provider: 'KEETA',
    canonicalProductId: nonEmpty(canonicalProductId, 'MFK_CANONICAL_PRODUCT_ID_REQUIRED'),
    providerGroupCode: nonEmpty(providerGroupCode, 'KEETA_PROVIDER_GROUP_CODE_REQUIRED'),
    providerOptionCode: nonEmpty(providerOptionCode, 'KEETA_PROVIDER_OPTION_CODE_REQUIRED'),
    resolutionAuthority: 'MFK_MAPPING_AUTHORITY_REQUIRED',
    providerIdsAreAliasesOnly: true,
  });
}
