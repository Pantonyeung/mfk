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

export interface SmmLanDiningTarget{
  readonly kind:'TABLE'|'WAITING';
  readonly tableId?:string;
  readonly covers?:number;
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
  readonly diningTarget?:SmmLanDiningTarget;
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
  |Readonly<{protocolVersion:1;type:'smm.lan.order.readback.result.v1';submissionId:string;state:'REJECTED';reasonCode:string}>
  |Readonly<{protocolVersion:1;type:'smm.lan.order.readback.result.v1';submissionId:string;state:'UNKNOWN'}>;

export function validSmmLanIdentity(value:string){
  const text=String(value||'');
  return text.length>0&&text.length<=240&&text.trim()===text;
}


function smmRecord(value:unknown,code:string):Record<string,unknown>{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(code);
  return value as Record<string,unknown>;
}
function smmText(value:unknown,code:string,max=240){
  if(typeof value!=='string')throw new Error(code);
  const out=value.trim();
  if(!out||out.length>max)throw new Error(code);
  return out;
}
function smmMoney(value:unknown,code:string){
  const out=Number(value);
  if(!Number.isSafeInteger(out)||out<0)throw new Error(code);
  return out;
}
function smmQty(value:unknown,code:string){
  const out=Number(value);
  if(!Number.isSafeInteger(out)||out<1||out>999)throw new Error(code);
  return out;
}

export function validateSmmLanOrderRequest(input:unknown):SmmLanOrderRequest{
  const row=smmRecord(input,'SMM_ORDER_INVALID');
  if(row.protocolVersion!==1)throw new Error('SMM_ORDER_PROTOCOL_INVALID');
  if(row.type!=='smm.lan.order.submit.v1')throw new Error('SMM_ORDER_TYPE_INVALID');
  if(row.storeId!=='MF01')throw new Error('SMM_ORDER_STORE_INVALID');
  if(!Array.isArray(row.lines)||row.lines.length<1||row.lines.length>100)throw new Error('SMM_ORDER_LINES_INVALID');
  const serviceMode=row.serviceMode==='TAKEAWAY'?'TAKEAWAY':row.serviceMode==='DINE_IN'?'DINE_IN':null;
  if(!serviceMode)throw new Error('SMM_ORDER_SERVICE_MODE_INVALID');
  const tender=['CASH','ALIPAY','WECHAT','FPS','PAYME'].includes(String(row.tender))
    ?String(row.tender) as SmmLanOrderRequest['tender']
    :null;
  if(!tender)throw new Error('SMM_ORDER_TENDER_INVALID');
  const lines=row.lines.map((raw,index)=>{
    const line=smmRecord(raw,'SMM_ORDER_LINE_INVALID_'+index);
    if(!Array.isArray(line.selections))throw new Error('SMM_ORDER_SELECTIONS_INVALID_'+index);
    return Object.freeze({
      lineId:smmText(line.lineId,'SMM_ORDER_LINE_ID_INVALID_'+index,180),
      productId:smmText(line.productId,'SMM_ORDER_PRODUCT_ID_INVALID_'+index,120),
      productName:smmText(line.productName,'SMM_ORDER_PRODUCT_NAME_INVALID_'+index,200),
      quantity:smmQty(line.quantity,'SMM_ORDER_QTY_INVALID_'+index),
      ...(typeof line.selectedVariationId==='string'&&line.selectedVariationId.trim()?{selectedVariationId:smmText(line.selectedVariationId,'SMM_ORDER_VARIATION_ID_INVALID_'+index,120)}:{}),
      ...(typeof line.selectedVariationName==='string'&&line.selectedVariationName.trim()?{selectedVariationName:smmText(line.selectedVariationName,'SMM_ORDER_VARIATION_NAME_INVALID_'+index,160)}:{}),
      ...(line.publishedUnitPriceMinor!==undefined?{publishedUnitPriceMinor:smmMoney(line.publishedUnitPriceMinor,'SMM_ORDER_UNIT_PRICE_INVALID_'+index)}:{}),
      selections:Object.freeze(line.selections.map((rawSelection,selectionIndex)=>{
        const selection=smmRecord(rawSelection,'SMM_ORDER_SELECTION_INVALID_'+index+'_'+selectionIndex);
        return Object.freeze({
          optionGroupId:smmText(selection.optionGroupId,'SMM_ORDER_SELECTION_GROUP_INVALID_'+index+'_'+selectionIndex,120),
          optionId:smmText(selection.optionId,'SMM_ORDER_SELECTION_ID_INVALID_'+index+'_'+selectionIndex,120),
          optionName:smmText(selection.optionName,'SMM_ORDER_SELECTION_NAME_INVALID_'+index+'_'+selectionIndex,160),
          ...(selection.publishedAdjustmentMinor!==undefined?{
            publishedAdjustmentMinor:Number(selection.publishedAdjustmentMinor),
          }:{}),
        });
      })),
    });
  });
  return Object.freeze({
    protocolVersion:1,
    type:'smm.lan.order.submit.v1',
    requestId:smmText(row.requestId,'SMM_ORDER_REQUEST_ID_INVALID',180),
    submissionId:smmText(row.submissionId,'SMM_ORDER_SUBMISSION_ID_INVALID',180),
    idempotencyKey:smmText(row.idempotencyKey,'SMM_ORDER_IDEMPOTENCY_INVALID',240),
    storeId:'MF01',
    menuRevision:smmText(row.menuRevision,'SMM_ORDER_MENU_REVISION_INVALID',120),
    publishedTotalMinor:smmMoney(row.publishedTotalMinor,'SMM_ORDER_TOTAL_INVALID'),
    serviceMode,
    tender,
    ...(serviceMode==='DINE_IN'?{
      diningTarget:(()=>{
        const raw=smmRecord(row.diningTarget,'SMM_DINING_TARGET_REQUIRED');
        const kind=raw.kind==='TABLE'?'TABLE':raw.kind==='WAITING'?'WAITING':null;
        if(!kind)throw new Error('SMM_DINING_TARGET_INVALID');
        const covers=Math.max(1,Math.min(30,Math.floor(Number(raw.covers)||1)));
        if(kind==='TABLE'){
          const tableId=smmText(raw.tableId,'SMM_DINING_TABLE_REQUIRED',16);
          if(!/^T\d{2}$/.test(tableId))throw new Error('SMM_DINING_TABLE_INVALID');
          return Object.freeze({kind:'TABLE' as const,tableId,covers});
        }
        return Object.freeze({kind:'WAITING' as const,covers});
      })(),
    }:{}),
    lines:Object.freeze(lines),
  });
}
