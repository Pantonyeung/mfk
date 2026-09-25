export const SMM_LAN_PROTOCOL_VERSION=1 as const;
export const SMM_LAN_SUBMIT_TYPE='smm.lan.order.submit.v1' as const;
export const SMM_LAN_RESULT_TYPE='smm.lan.order.result.v1' as const;

export interface SmmLanLineIntent{
  readonly lineId:string;
  readonly productId:string;
  readonly productName:string;
  readonly quantity:number;
  readonly selectedVariationId?:string;
  readonly selectedVariationName?:string;
  readonly selections:readonly {
    readonly optionGroupId:string;
    readonly optionId:string;
    readonly optionName:string;
    readonly publishedAdjustmentMinor?:number;
  }[];
  readonly publishedUnitPriceMinor?:number;
}

export interface SmmLanOrderRequest{
  readonly protocolVersion:1;
  readonly type:'smm.lan.order.submit.v1';
  readonly requestId:string;
  readonly submissionId:string;
  readonly idempotencyKey:string;
  readonly storeId:string;
  readonly menuRevision:string;
  readonly publishedTotalMinor:number;
  readonly serviceMode:'TAKEAWAY'|'DINE_IN';
  readonly tender:'CASH'|'ALIPAY'|'WECHAT'|'FPS'|'PAYME';
  readonly lines:readonly SmmLanLineIntent[];
}

export type SmmLanOrderResponse=
  |Readonly<{
    protocolVersion:1;
    type:'smm.lan.order.result.v1';
    requestId:string;
    submissionId:string;
    idempotencyKey:string;
    disposition:'ACCEPTED';
    orderId:string;
    canonicalRevision:number;
  }>
  |Readonly<{
    protocolVersion:1;
    type:'smm.lan.order.result.v1';
    requestId:string;
    submissionId:string;
    idempotencyKey:string;
    disposition:'REJECTED';
    reasonCode:string;
  }>;

export interface SmmLanSubmissionReadbackRequest{
  readonly protocolVersion:1;
  readonly type:'smm.lan.order.readback.v1';
  readonly submissionId:string;
  readonly storeId:string;
}

export type SmmLanSubmissionReadbackResponse=
  |Readonly<{protocolVersion:1;type:'smm.lan.order.readback.result.v1';submissionId:string;state:'CONFIRMED';orderId:string;canonicalRevision:number}>
  |Readonly<{protocolVersion:1;type:'smm.lan.order.readback.result.v1';submissionId:string;state:'UNKNOWN'}>;

export function validSmmLanIdentity(value:string){
  const text=String(value||'');
  return text.length>0&&text.length<=240&&text.trim()===text;
}
