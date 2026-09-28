export const MFK_ADMIN_REFUND_SCHEMA='MFK_ADMIN_REFUND_EVENT_V1' as const;

export interface AdminRefundLine{
  readonly lineId:string;
  readonly itemName:string;
  readonly quantity:number;
  readonly amountMinor:number;
}

export interface AdminRefundEvent{
  readonly schema:typeof MFK_ADMIN_REFUND_SCHEMA;
  readonly refundId:string;
  readonly storeId:string;
  readonly orderId:string;
  readonly display:string;
  readonly originalBusinessDate:string;
  readonly originalCreatedAt:string;
  readonly executionAt:string;
  readonly executionBusinessDate:string;
  readonly method:string;
  readonly amountMinor:number;
  readonly lines:readonly AdminRefundLine[];
  readonly note:string;
  readonly source:'ADMIN';
  readonly originalDayCloseVersion:number;
  readonly addendumSequence:number;
  readonly addendumVersionLabel:string;
}

export interface AdminDayCloseRefundAddendum{
  readonly schema:'MFK_DAY_CLOSE_REFUND_ADDENDUM_V1';
  readonly id:string;
  readonly storeId:string;
  readonly businessDate:string;
  readonly baseVersion:number;
  readonly addendumSequence:number;
  readonly versionLabel:string;
  readonly createdAt:string;
  readonly refundId:string;
  readonly orderId:string;
  readonly display:string;
  readonly originalCreatedAt:string;
  readonly executionAt:string;
  readonly executionBusinessDate:string;
  readonly method:string;
  readonly amountMinor:number;
  readonly lines:readonly AdminRefundLine[];
  readonly note:string;
  readonly postingMode:'NON_POSTING_REFERENCE';
}

function row(value:unknown,code:string){
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(code);
  return value as Record<string,unknown>;
}
function text(value:unknown,code:string,max=240){
  if(typeof value!=='string')throw new Error(code);
  const v=value.trim();
  if(!v||v.length>max)throw new Error(code);
  return v;
}
function minor(value:unknown,code:string){
  const n=Number(value);
  if(!Number.isSafeInteger(n)||n<=0)throw new Error(code);
  return n;
}
function date(value:unknown,code:string){
  const v=text(value,code,64);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(v))throw new Error(code);
  return v;
}
function iso(value:unknown,code:string){
  const v=text(value,code,64);
  if(!Number.isFinite(Date.parse(v)))throw new Error(code);
  return v;
}

export function validateAdminRefundEvent(input:unknown):AdminRefundEvent{
  const value=row(input,'ADMIN_REFUND_EVENT_INVALID');
  if(value.schema!==MFK_ADMIN_REFUND_SCHEMA)throw new Error('ADMIN_REFUND_SCHEMA_UNSUPPORTED');
  const linesRaw=value.lines;
  if(!Array.isArray(linesRaw)||!linesRaw.length||linesRaw.length>100)throw new Error('ADMIN_REFUND_LINES_INVALID');
  const lines=linesRaw.map(raw=>{
    const line=row(raw,'ADMIN_REFUND_LINE_INVALID');
    return Object.freeze({
      lineId:text(line.lineId,'ADMIN_REFUND_LINE_ID_INVALID',180),
      itemName:text(line.itemName,'ADMIN_REFUND_ITEM_NAME_INVALID',240),
      quantity:minor(line.quantity,'ADMIN_REFUND_QUANTITY_INVALID'),
      amountMinor:minor(line.amountMinor,'ADMIN_REFUND_LINE_AMOUNT_INVALID'),
    });
  });
  const amountMinor=minor(value.amountMinor,'ADMIN_REFUND_AMOUNT_INVALID');
  if(lines.reduce((sum,line)=>sum+line.amountMinor,0)!==amountMinor)throw new Error('ADMIN_REFUND_LINE_SUM_MISMATCH');
  const originalDayCloseVersion=minor(value.originalDayCloseVersion,'ADMIN_REFUND_CLOSE_VERSION_INVALID');
  const addendumSequence=minor(value.addendumSequence,'ADMIN_REFUND_ADDENDUM_SEQUENCE_INVALID');
  const addendumVersionLabel=text(value.addendumVersionLabel,'ADMIN_REFUND_ADDENDUM_VERSION_INVALID',32);
  if(addendumVersionLabel!==String(originalDayCloseVersion)+'.'+String(addendumSequence)){
    throw new Error('ADMIN_REFUND_ADDENDUM_VERSION_MISMATCH');
  }
  return Object.freeze({
    schema:MFK_ADMIN_REFUND_SCHEMA,
    refundId:text(value.refundId,'ADMIN_REFUND_ID_INVALID',180),
    storeId:text(value.storeId,'ADMIN_REFUND_STORE_INVALID',64),
    orderId:text(value.orderId,'ADMIN_REFUND_ORDER_INVALID',180),
    display:text(value.display,'ADMIN_REFUND_DISPLAY_INVALID',64),
    originalBusinessDate:date(value.originalBusinessDate,'ADMIN_REFUND_ORIGINAL_DATE_INVALID'),
    originalCreatedAt:iso(value.originalCreatedAt,'ADMIN_REFUND_ORIGINAL_CREATED_AT_INVALID'),
    executionAt:iso(value.executionAt,'ADMIN_REFUND_EXECUTION_AT_INVALID'),
    executionBusinessDate:date(value.executionBusinessDate,'ADMIN_REFUND_EXECUTION_DATE_INVALID'),
    method:text(value.method,'ADMIN_REFUND_METHOD_INVALID',64),
    amountMinor,
    lines:Object.freeze(lines),
    note:typeof value.note==='string'?value.note.trim().slice(0,500):'',
    source:'ADMIN',
    originalDayCloseVersion,
    addendumSequence,
    addendumVersionLabel,
  });
}

export function validateAdminRefundList(input:unknown){
  const value=row(input,'ADMIN_REFUND_LIST_INVALID');
  if(!Array.isArray(value.refunds))throw new Error('ADMIN_REFUND_LIST_INVALID');
  return Object.freeze(value.refunds.map(validateAdminRefundEvent));
}
