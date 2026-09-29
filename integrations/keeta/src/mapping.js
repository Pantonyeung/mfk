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


const mappingRecord = (value, code) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(code);
  return value;
};

export function resolveKeetaProductMapping(aliasRequest, registry) {
  const alias = mappingRecord(aliasRequest, 'KEETA_PRODUCT_ALIAS_REQUIRED');
  const rows = Array.isArray(registry) ? registry : [];
  const matches = rows.filter((raw) => {
    const row = mappingRecord(raw, 'KEETA_PRODUCT_MAPPING_INVALID');
    if (row.enabled === false) return false;
    return (
      (row.skuOpenItemCode && row.skuOpenItemCode === alias.skuOpenItemCode) ||
      (row.spuOpenItemCode && row.spuOpenItemCode === alias.spuOpenItemCode) ||
      (row.providerSkuId && String(row.providerSkuId) === String(alias.providerSkuId)) ||
      (row.providerSpuId && String(row.providerSpuId) === String(alias.providerSpuId))
    );
  });
  if (matches.length === 0) throw new Error('KEETA_PRODUCT_MAPPING_NOT_FOUND');
  const identities = new Set(matches.map((row) => nonEmpty(row.mappingId, 'KEETA_PRODUCT_MAPPING_ID_REQUIRED')));
  if (identities.size !== 1) throw new Error('KEETA_PRODUCT_MAPPING_AMBIGUOUS');
  const mapping = matches[0];
  const components = Array.isArray(mapping.components) ? mapping.components : [];
  if (!components.length) throw new Error('KEETA_PRODUCT_MAPPING_COMPONENTS_REQUIRED');
  return Object.freeze({
    mappingId: nonEmpty(mapping.mappingId, 'KEETA_PRODUCT_MAPPING_ID_REQUIRED'),
    channelProductName: typeof mapping.channelProductName === 'string' ? mapping.channelProductName.trim() : '',
    components: Object.freeze(components.map((raw) => {
      const component = mappingRecord(raw, 'KEETA_PRODUCT_MAPPING_COMPONENT_INVALID');
      return Object.freeze({
        canonicalProductId: nonEmpty(component.canonicalProductId, 'MFK_CANONICAL_PRODUCT_ID_REQUIRED'),
        quantity: Number.isSafeInteger(component.quantity) && component.quantity > 0 ? component.quantity : 1,
        role: typeof component.role === 'string' && component.role.trim() ? component.role.trim() : 'PRODUCTION',
      });
    })),
    providerIdsAreAliasesOnly: true,
    canonicalProductAuthority: 'MFK',
  });
}

export function resolveKeetaOptionMapping({ canonicalProductId, providerGroupCode, providerOptionCode }, registry) {
  const request = buildKeetaOptionAliasRequest({ canonicalProductId, providerGroupCode, providerOptionCode });
  const rows = Array.isArray(registry) ? registry : [];
  const matches = rows.filter((raw) => {
    const row = mappingRecord(raw, 'KEETA_OPTION_MAPPING_INVALID');
    return row.enabled !== false &&
      row.canonicalProductId === request.canonicalProductId &&
      row.providerGroupCode === request.providerGroupCode &&
      row.providerOptionCode === request.providerOptionCode;
  });
  if (matches.length === 0) throw new Error('KEETA_OPTION_MAPPING_NOT_FOUND');
  if (matches.length > 1) throw new Error('KEETA_OPTION_MAPPING_AMBIGUOUS');
  const mapping = matches[0];
  return Object.freeze({
    canonicalProductId: request.canonicalProductId,
    canonicalOptionSetId: nonEmpty(mapping.canonicalOptionSetId, 'MFK_CANONICAL_OPTION_SET_ID_REQUIRED'),
    canonicalOptionId: nonEmpty(mapping.canonicalOptionId, 'MFK_CANONICAL_OPTION_ID_REQUIRED'),
    providerIdsAreAliasesOnly: true,
    canonicalOptionAuthority: 'MFK',
  });
}
