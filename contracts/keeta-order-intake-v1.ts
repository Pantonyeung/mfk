export const MFK_KEETA_ORDER_INTENT_SCHEMA='MFK_KEETA_ORDER_INTENT_V1' as const;
export const MFK_KEETA_ORDER_ACK_SCHEMA='MFK_KEETA_ORDER_ACK_V1' as const;

export interface MfkKeetaOrderIntent{
  readonly schema:typeof MFK_KEETA_ORDER_INTENT_SCHEMA;
  readonly storeId:'MF01';
  readonly provider:'KEETA';
  readonly providerShopId:number;
  readonly providerOrderId:string;
  readonly providerMessageId:string;
  readonly providerPushedAt:string;
  readonly receivedAt:string;
  readonly fingerprint:string;
  readonly rawMessage:string;
  readonly state:'PENDING_SMT'|'COMMITTED';
  readonly canonicalOrderId?:string;
  readonly canonicalDisplay?:string;
  readonly committedAt?:string;
}

export interface MfkKeetaOrderAck{
  readonly schema:typeof MFK_KEETA_ORDER_ACK_SCHEMA;
  readonly storeId:'MF01';
  readonly provider:'KEETA';
  readonly providerOrderId:string;
  readonly providerMessageId:string;
  readonly canonicalOrderId:string;
  readonly canonicalDisplay:string;
  readonly committedAt:string;
}

function object(value:unknown,code:string):Record<string,unknown>{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(code);
  return value as Record<string,unknown>;
}
function text(value:unknown,code:string,max=4096){
  if(typeof value!=='string')throw new Error(code);
  const normalized=value.trim();
  if(!normalized||normalized.length>max)throw new Error(code);
  return normalized;
}
function instant(value:unknown,code:string){
  const normalized=text(value,code,80);
  if(!Number.isFinite(Date.parse(normalized)))throw new Error(code);
  return normalized;
}
function positiveInt(value:unknown,code:string){
  const parsed=Number(value);
  if(!Number.isSafeInteger(parsed)||parsed<=0)throw new Error(code);
  return parsed;
}

export function validateMfkKeetaOrderIntent(input:unknown):MfkKeetaOrderIntent{
  const row=object(input,'KEETA_ORDER_INTENT_INVALID');
  if(row.schema!==MFK_KEETA_ORDER_INTENT_SCHEMA)throw new Error('KEETA_ORDER_INTENT_SCHEMA_UNSUPPORTED');
  if(row.storeId!=='MF01')throw new Error('KEETA_ORDER_INTENT_STORE_INVALID');
  if(row.provider!=='KEETA')throw new Error('KEETA_ORDER_INTENT_PROVIDER_INVALID');
  const state=row.state;
  if(state!=='PENDING_SMT'&&state!=='COMMITTED')throw new Error('KEETA_ORDER_INTENT_STATE_INVALID');
  const intent={
    schema:MFK_KEETA_ORDER_INTENT_SCHEMA,
    storeId:'MF01' as const,
    provider:'KEETA' as const,
    providerShopId:positiveInt(row.providerShopId,'KEETA_ORDER_INTENT_SHOP_INVALID'),
    providerOrderId:text(row.providerOrderId,'KEETA_ORDER_INTENT_PROVIDER_ORDER_ID_INVALID',160),
    providerMessageId:text(row.providerMessageId,'KEETA_ORDER_INTENT_MESSAGE_ID_INVALID',160),
    providerPushedAt:instant(row.providerPushedAt,'KEETA_ORDER_INTENT_PUSHED_AT_INVALID'),
    receivedAt:instant(row.receivedAt,'KEETA_ORDER_INTENT_RECEIVED_AT_INVALID'),
    fingerprint:text(row.fingerprint,'KEETA_ORDER_INTENT_FINGERPRINT_INVALID',128),
    rawMessage:text(row.rawMessage,'KEETA_ORDER_INTENT_RAW_MESSAGE_INVALID',250000),
    state,
    ...(row.canonicalOrderId===undefined?{}:{canonicalOrderId:text(row.canonicalOrderId,'KEETA_ORDER_INTENT_CANONICAL_ORDER_ID_INVALID',160)}),
    ...(row.canonicalDisplay===undefined?{}:{canonicalDisplay:text(row.canonicalDisplay,'KEETA_ORDER_INTENT_CANONICAL_DISPLAY_INVALID',80)}),
    ...(row.committedAt===undefined?{}:{committedAt:instant(row.committedAt,'KEETA_ORDER_INTENT_COMMITTED_AT_INVALID')}),
  };
  if(intent.state==='COMMITTED'&&(!intent.canonicalOrderId||!intent.canonicalDisplay||!intent.committedAt)){
    throw new Error('KEETA_ORDER_INTENT_COMMIT_EVIDENCE_REQUIRED');
  }
  return Object.freeze(intent);
}

export function validateMfkKeetaOrderAck(input:unknown):MfkKeetaOrderAck{
  const row=object(input,'KEETA_ORDER_ACK_INVALID');
  if(row.schema!==MFK_KEETA_ORDER_ACK_SCHEMA)throw new Error('KEETA_ORDER_ACK_SCHEMA_UNSUPPORTED');
  if(row.storeId!=='MF01')throw new Error('KEETA_ORDER_ACK_STORE_INVALID');
  if(row.provider!=='KEETA')throw new Error('KEETA_ORDER_ACK_PROVIDER_INVALID');
  return Object.freeze({
    schema:MFK_KEETA_ORDER_ACK_SCHEMA,
    storeId:'MF01',
    provider:'KEETA',
    providerOrderId:text(row.providerOrderId,'KEETA_ORDER_ACK_PROVIDER_ORDER_ID_INVALID',160),
    providerMessageId:text(row.providerMessageId,'KEETA_ORDER_ACK_MESSAGE_ID_INVALID',160),
    canonicalOrderId:text(row.canonicalOrderId,'KEETA_ORDER_ACK_CANONICAL_ORDER_ID_INVALID',160),
    canonicalDisplay:text(row.canonicalDisplay,'KEETA_ORDER_ACK_CANONICAL_DISPLAY_INVALID',80),
    committedAt:instant(row.committedAt,'KEETA_ORDER_ACK_COMMITTED_AT_INVALID'),
  });
}
