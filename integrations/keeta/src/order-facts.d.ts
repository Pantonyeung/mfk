export interface KeetaSelectedOptionFact{
  readonly providerGroupCode:string;
  readonly providerGroupName:string;
  readonly providerOptionCode:string;
  readonly providerOptionName:string;
  readonly quantity:number;
  readonly providerUnitPriceMinor:number;
}
export interface KeetaOrderLineFact{
  readonly providerProductId:string;
  readonly providerSkuId:string;
  readonly providerSpuId:string;
  readonly skuOpenItemCode:string;
  readonly spuOpenItemCode:string;
  readonly providerProductName:string;
  readonly quantity:number;
  readonly providerOriginUnitPriceMinor:number;
  readonly providerFinalUnitPriceMinor:number;
  readonly providerUnitAdjustmentMinor:number;
  readonly providerOriginAmountMinor:number;
  readonly providerFinalAmountMinor:number;
  readonly selectedOptions:readonly KeetaSelectedOptionFact[];
}
export interface KeetaStandardProviderOrderFacts{
  readonly provider:'KEETA';
  readonly providerOrderId:string;
  readonly providerOrderCode:string;
  readonly currency:string;
  readonly providerProductTotalMinor:number;
  readonly providerPromotionDiscountMinor:number;
  readonly providerEffectiveProductTotalMinor:number;
  readonly providerCapturedAt:string;
  readonly providerEvidenceRef:string;
  readonly lines:readonly KeetaOrderLineFact[];
  readonly providerCommercialSnapshot:Readonly<Record<string,unknown>>;
  readonly rawOrderInfo:Readonly<Record<string,unknown>>;
}
export function normalizeKeetaStandardProviderOrderFacts(input:{
  readonly orderInfo:unknown;
  readonly providerCapturedAt:string;
  readonly providerEvidenceRef:string;
}):KeetaStandardProviderOrderFacts;
