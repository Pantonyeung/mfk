import { EXECUTION_GATE } from './constants.js';
import { buildKeetaProductAliasRequest } from './mapping.js';

const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const record = (value, code) => {
  if (!isRecord(value)) throw new Error(code);
  return value;
};
const array = (value, code) => {
  if (!Array.isArray(value)) throw new Error(code);
  return value;
};
const text = (value, code) => {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(code);
  return value.trim();
};
const integer = (value, code, minimum = 0) => {
  if (!Number.isSafeInteger(value) || value < minimum) throw new Error(code);
  return value;
};
const optionalArray = (value) => value === undefined || value === null ? [] : array(value, 'KEETA_STANDARD_ARRAY_INVALID');

function unwrapOrderInfo(input) {
  const root = record(input, 'KEETA_STANDARD_ORDER_INFO_REQUIRED');
  return isRecord(root.orderInfo) ? root.orderInfo : root;
}

function feeValue(feeDtls, code, currency) {
  const matches = feeDtls
    .map((entry) => record(entry, 'KEETA_STANDARD_FEE_INVALID'))
    .filter((entry) => entry.code === code);
  if (matches.length === 0) return undefined;
  if (matches.length !== 1) throw new Error(`KEETA_COMMERCIAL_FEE_AMBIGUOUS:${code}`);
  const fee = matches[0];
  if (text(fee.currency, 'KEETA_STANDARD_FEE_CURRENCY_REQUIRED') !== currency) {
    throw new Error(`KEETA_COMMERCIAL_FEE_CURRENCY_MISMATCH:${code}`);
  }
  return integer(fee.price, 'KEETA_STANDARD_FEE_PRICE_INVALID');
}

function promotionDiscount(promotions) {
  let total = 0;
  for (const entry of promotions) {
    total += integer(record(entry, 'KEETA_STANDARD_PROMOTION_INVALID').reduceFee, 'KEETA_STANDARD_PROMOTION_REDUCE_FEE_INVALID');
    if (!Number.isSafeInteger(total)) throw new Error('KEETA_STANDARD_PROMOTION_TOTAL_INVALID');
  }
  return total;
}

function optionFacts(groups, currency) {
  const out = [];
  const visit = (entries) => {
    for (const rawGroup of entries) {
      const group = record(rawGroup, 'KEETA_STANDARD_OPTION_GROUP_INVALID');
      const providerGroupCode = text(group.groupOpenItemCode, 'KEETA_STANDARD_OPTION_GROUP_OPEN_ITEM_CODE_REQUIRED');
      const groupName = text(group.groupName, 'KEETA_STANDARD_OPTION_GROUP_NAME_REQUIRED');
      for (const rawSku of array(group.shopProductGroupSkuList, 'KEETA_STANDARD_OPTION_GROUP_SKUS_REQUIRED')) {
        const sku = record(rawSku, 'KEETA_STANDARD_OPTION_INVALID');
        if (text(sku.currency, 'KEETA_STANDARD_OPTION_CURRENCY_REQUIRED') !== currency) {
          throw new Error('KEETA_STANDARD_OPTION_CURRENCY_MISMATCH');
        }
        const providerOptionCode = text(sku.groupSkuOpenItemCode, 'KEETA_STANDARD_OPTION_OPEN_ITEM_CODE_REQUIRED');
        out.push(Object.freeze({
          providerGroupCode,
          providerGroupName: groupName,
          providerOptionCode,
          providerOptionName: text(sku.spuName, 'KEETA_STANDARD_OPTION_NAME_REQUIRED'),
          quantity: integer(sku.count, 'KEETA_STANDARD_OPTION_COUNT_INVALID', 1),
          providerUnitPriceMinor: integer(sku.unitPrice, 'KEETA_STANDARD_OPTION_UNIT_PRICE_INVALID'),
          mappingAuthority: 'MFK_MAPPING_AUTHORITY_REQUIRED',
          raw: Object.freeze({ ...sku }),
        }));
        visit(optionalArray(sku.groups));
      }
    }
  };
  visit(groups);
  return Object.freeze(out);
}

function commercialSnapshot(orderInfo, providerOrderId, currency, capturedAt, providerEvidenceRef) {
  const feeDtls = optionalArray(orderInfo.feeDtls);
  const feeDtl = isRecord(orderInfo.feeDtl) ? orderInfo.feeDtl : {};
  const merchantFee = isRecord(feeDtl.merchantFee) ? feeDtl.merchantFee : {};
  const optionalMoney = (value, code) => value === undefined || value === null ? undefined : integer(value, code);

  const merchantCommissionMinor = optionalMoney(merchantFee.basicCommission ?? merchantFee.commission, 'KEETA_COMMERCIAL_COMMISSION_INVALID');
  const merchantActivityFeeMinor = optionalMoney(merchantFee.activityFee, 'KEETA_COMMERCIAL_ACTIVITY_FEE_INVALID');
  const merchantEarningsMinor = optionalMoney(merchantFee.earnings ?? merchantFee.total, 'KEETA_COMMERCIAL_EARNINGS_INVALID');

  return Object.freeze({
    provider: 'KEETA',
    providerOrderId,
    currency,
    merchandiseSubtotalMinor: feeValue(feeDtls, 'productPrice', currency),
    customerPaidMinor: feeValue(feeDtls, 'payTotal', currency),
    shippingFeeMinor: feeValue(feeDtls, 'shippingFee', currency),
    customerPlatformFeeMinor: feeValue(feeDtls, 'platformFee', currency),
    minimumOrderTopUpMinor: feeValue(feeDtls, 'diffPrice', currency),
    merchantCommissionMinor,
    merchantActivityFeeMinor,
    merchantEarningsMinor,
    settlementAuthority: merchantEarningsMinor === undefined ? 'UNKNOWN' : 'PROVIDER_ESTIMATE',
    capturedAt,
    providerEvidenceRef,
    authorityBoundary: 'PROVIDER_COMMERCIAL_EVIDENCE_NOT_MFK_SALES_OR_SETTLEMENT_AUTHORITY',
  });
}

export function normalizeKeetaStandardProviderOrderFacts({
  orderInfo: rawOrderInfo,
  providerCapturedAt,
  providerEvidenceRef,
}) {
  const orderInfo = unwrapOrderInfo(rawOrderInfo);
  const baseOrder = record(orderInfo.baseOrder, 'KEETA_STANDARD_BASE_ORDER_REQUIRED');
  const merchantOrder = record(orderInfo.merchantOrder, 'KEETA_STANDARD_MERCHANT_ORDER_REQUIRED');

  const providerOrderId = text(baseOrder.orderViewIdStr, 'KEETA_STANDARD_ORDER_ID_REQUIRED');
  const merchantProviderOrderId = text(merchantOrder.orderViewIdStr, 'KEETA_STANDARD_MERCHANT_ORDER_ID_REQUIRED');
  if (merchantProviderOrderId !== providerOrderId) throw new Error('KEETA_STANDARD_ORDER_ID_MISMATCH');

  const providerOrderCode = text(merchantOrder.seqNoStr, 'KEETA_STANDARD_ORDER_CODE_REQUIRED');
  const currency = text(baseOrder.currency, 'KEETA_STANDARD_CURRENCY_REQUIRED');
  const products = array(orderInfo.products, 'KEETA_STANDARD_PRODUCTS_REQUIRED');
  if (products.length === 0) throw new Error('KEETA_STANDARD_PRODUCTS_REQUIRED');

  const promotions = optionalArray(orderInfo.orderPromotionDtlList);
  const providerPromotionDiscountMinor = promotionDiscount(promotions);
  const feeDtls = array(orderInfo.feeDtls, 'KEETA_STANDARD_FEES_REQUIRED');
  const providerProductTotalMinor = feeValue(feeDtls, 'productPrice', currency);
  if (providerProductTotalMinor === undefined) throw new Error('KEETA_STANDARD_FEE_PRODUCTPRICE_REQUIRED');
  if (providerPromotionDiscountMinor > providerProductTotalMinor) throw new Error('KEETA_STANDARD_PROMOTION_EXCEEDS_PRODUCT_TOTAL');

  const lines = products.map((rawProduct) => {
    const product = record(rawProduct, 'KEETA_STANDARD_PRODUCT_INVALID');
    const productCurrency = text(product.currency, 'KEETA_STANDARD_PRODUCT_CURRENCY_REQUIRED');
    if (productCurrency !== currency) throw new Error('KEETA_STANDARD_PRODUCT_CURRENCY_MISMATCH');

    const skuOpenItemCode = text(product.skuOpenItemCode, 'KEETA_STANDARD_SKU_OPEN_ITEM_CODE_REQUIRED');
    const spuOpenItemCode = text(product.spuOpenItemCode, 'KEETA_STANDARD_SPU_OPEN_ITEM_CODE_REQUIRED');
    const providerSkuId = String(integer(product.skuId, 'KEETA_STANDARD_PROVIDER_SKU_ID_REQUIRED', 1));
    const providerSpuId = String(integer(product.spuId, 'KEETA_STANDARD_PROVIDER_SPU_ID_REQUIRED', 1));
    const price = record(product.priceWithGroup, 'KEETA_STANDARD_PRODUCT_PRICE_WITH_GROUP_REQUIRED');

    const providerOriginUnitPriceMinor = integer(price.originUnitPrice, 'KEETA_STANDARD_PRODUCT_ORIGIN_UNIT_PRICE_INVALID');
    const providerFinalUnitPriceMinor = integer(price.unitPrice, 'KEETA_STANDARD_PRODUCT_UNIT_PRICE_INVALID');
    const providerOriginAmountMinor = integer(price.originAmount, 'KEETA_STANDARD_PRODUCT_ORIGIN_AMOUNT_INVALID');
    const providerFinalAmountMinor = integer(price.amount, 'KEETA_STANDARD_PRODUCT_AMOUNT_INVALID');

    return Object.freeze({
      providerProductId: String(integer(product.id, 'KEETA_STANDARD_PROVIDER_PRODUCT_ID_REQUIRED', 1)),
      providerSkuId,
      providerSpuId,
      skuOpenItemCode,
      spuOpenItemCode,
      providerProductName: text(product.name, 'KEETA_STANDARD_PRODUCT_NAME_REQUIRED'),
      quantity: integer(product.count, 'KEETA_STANDARD_PRODUCT_COUNT_INVALID', 1),
      providerOriginUnitPriceMinor,
      providerFinalUnitPriceMinor,
      providerUnitAdjustmentMinor: providerFinalUnitPriceMinor - providerOriginUnitPriceMinor,
      providerOriginAmountMinor,
      providerFinalAmountMinor,
      productAliasRequest: buildKeetaProductAliasRequest({
        skuOpenItemCode,
        spuOpenItemCode,
        providerSkuId,
        providerSpuId,
      }),
      selectedOptions: optionFacts(optionalArray(product.groups), currency),
      raw: Object.freeze({ ...product }),
    });
  });

  const capturedAt = text(providerCapturedAt, 'KEETA_STANDARD_PROVIDER_CAPTURED_AT_REQUIRED');
  const evidenceRef = text(providerEvidenceRef, 'KEETA_STANDARD_PROVIDER_EVIDENCE_REQUIRED');

  return Object.freeze({
    provider: 'KEETA',
    providerOrderId,
    providerOrderCode,
    currency,
    providerProductTotalMinor,
    providerPromotionDiscountMinor,
    providerEffectiveProductTotalMinor: providerProductTotalMinor - providerPromotionDiscountMinor,
    providerCapturedAt: capturedAt,
    providerEvidenceRef: evidenceRef,
    lines: Object.freeze(lines),
    providerCommercialSnapshot: commercialSnapshot(orderInfo, providerOrderId, currency, capturedAt, evidenceRef),
    rawOrderInfo: Object.freeze({ ...orderInfo }),
    executionGate: EXECUTION_GATE.NOT_WIRED,
    formalOrderAuthority: 'ABSENT',
    pricingAuthority: 'PROVIDER_ACCEPTED_FACTS_ONLY_MFK_DECIDES_CANONICAL_USE',
  });
}
