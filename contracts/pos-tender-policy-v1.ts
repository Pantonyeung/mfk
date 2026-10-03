export const MFK_POS_TENDER_POLICY_SCHEMA='MFK_POS_TENDER_POLICY_V1' as const;

export type MfkPosTenderKind='CASH'|'NON_CASH';

export interface MfkPosTenderDefinition{
  readonly id:string;
  readonly label:string;
  readonly enabled:boolean;
  readonly kind:MfkPosTenderKind;
}

export interface MfkPosTenderPolicy{
  readonly schema:typeof MFK_POS_TENDER_POLICY_SCHEMA;
  readonly revision:number;
  readonly tenders:readonly MfkPosTenderDefinition[];
}

function object(value:unknown,code:string):Record<string,unknown>{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(code);
  return value as Record<string,unknown>;
}

function policyRevision(value:unknown){
  const revision=Number(value);
  if(!Number.isSafeInteger(revision)||revision<1)throw new Error('POS_TENDER_POLICY_REVISION_INVALID');
  return revision;
}

function tenderId(value:unknown){
  if(typeof value!=='string'||! /^[A-Z][A-Z0-9_]{0,63}$/.test(value)){
    throw new Error('POS_TENDER_POLICY_TENDER_ID_INVALID');
  }
  return value;
}

function label(value:unknown){
  if(typeof value!=='string'||value.length<1||value.length>80||value!==value.trim()||/[\u0000-\u001f\u007f]/.test(value)){
    throw new Error('POS_TENDER_POLICY_TENDER_LABEL_INVALID');
  }
  return value;
}

function tender(value:unknown):MfkPosTenderDefinition{
  const row=object(value,'POS_TENDER_POLICY_TENDER_INVALID');
  const id=tenderId(row.id);
  const acceptedLabel=label(row.label);
  const kind=row.kind;
  if(kind!=='CASH'&&kind!=='NON_CASH')throw new Error('POS_TENDER_POLICY_TENDER_KIND_INVALID');
  if(typeof row.enabled!=='boolean')throw new Error('POS_TENDER_POLICY_TENDER_ENABLED_INVALID');
  return Object.freeze({
    id,
    label:acceptedLabel,
    enabled:row.enabled,
    kind,
  });
}

export function validateMfkPosTenderPolicy(value:unknown):MfkPosTenderPolicy{
  const row=object(value,'POS_TENDER_POLICY_INVALID');
  if(row.schema!==MFK_POS_TENDER_POLICY_SCHEMA)throw new Error('POS_TENDER_POLICY_SCHEMA_UNSUPPORTED');
  if(!Array.isArray(row.tenders)||row.tenders.length>64)throw new Error('POS_TENDER_POLICY_TENDERS_INVALID');
  const ids=new Set<string>();
  const tenders=row.tenders.map(value=>{
    const item=tender(value);
    if(ids.has(item.id))throw new Error('POS_TENDER_POLICY_TENDER_ID_DUPLICATE');
    ids.add(item.id);
    return item;
  });
  return Object.freeze({
    schema:MFK_POS_TENDER_POLICY_SCHEMA,
    revision:policyRevision(row.revision),
    tenders:Object.freeze(tenders),
  });
}

export function nextMfkPosTenderPolicy(
  current:unknown,
  tenders:readonly MfkPosTenderDefinition[],
):MfkPosTenderPolicy{
  const accepted=validateMfkPosTenderPolicy(current);
  if(accepted.revision>=Number.MAX_SAFE_INTEGER)throw new Error('POS_TENDER_POLICY_REVISION_EXHAUSTED');
  return validateMfkPosTenderPolicy({
    schema:MFK_POS_TENDER_POLICY_SCHEMA,
    revision:accepted.revision+1,
    tenders,
  });
}

export const DEFAULT_MFK_POS_TENDER_POLICY:MfkPosTenderPolicy=validateMfkPosTenderPolicy({
  schema:MFK_POS_TENDER_POLICY_SCHEMA,
  revision:1,
  tenders:[
    {id:'CASH',label:'Cash',enabled:true,kind:'CASH'},
    {id:'ALIPAY',label:'Alipay',enabled:true,kind:'NON_CASH'},
    {id:'WECHAT_PAY',label:'WeChat Pay',enabled:true,kind:'NON_CASH'},
    {id:'FPS',label:'FPS',enabled:true,kind:'NON_CASH'},
    {id:'PAYME',label:'PayMe',enabled:true,kind:'NON_CASH'},
  ],
});
