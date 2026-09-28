export const MFK_ORDER_LINE_COMPOSITION_SCHEMA='MFK_ORDER_LINE_COMPOSITION_V1' as const;

export type MfkOrderLineServiceMode='takeaway'|'dine-in';
export type MfkOrderLinePairingRole='MAIN'|'SNACK';

export interface MfkOrderLineOptionSelectionsV1{
  readonly [groupId:string]:readonly string[];
}

export interface MfkOrderLinePairingV1{
  readonly groupLabel:string;
  readonly comboId:string;
  readonly comboName:string;
  readonly role:MfkOrderLinePairingRole;
  readonly sourceLineId?:string;
}

export interface MfkOrderLineCompositionV1{
  readonly schema:typeof MFK_ORDER_LINE_COMPOSITION_SCHEMA;
  readonly cartLineId:string;
  readonly optionSelections?:MfkOrderLineOptionSelectionsV1;
  readonly freeNote?:string;
  readonly pairing?:MfkOrderLinePairingV1;
}

function row(value:unknown):Record<string,unknown>|null{
  return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:null;
}
function text(value:unknown){
  return typeof value==='string'&&value.length>0?value:undefined;
}
function selections(value:unknown):MfkOrderLineOptionSelectionsV1|undefined{
  const source=row(value);
  if(!source)return undefined;
  const result:Record<string,readonly string[]>={};
  for(const [key,raw] of Object.entries(source)){
    if(!key||!Array.isArray(raw))continue;
    const ids=[...new Set(raw.filter((item):item is string=>typeof item==='string'&&item.length>0))];
    if(ids.length)result[key]=Object.freeze(ids);
  }
  return Object.keys(result).length?Object.freeze(result):undefined;
}
function pairing(value:unknown):MfkOrderLinePairingV1|undefined{
  const source=row(value);
  if(!source)return undefined;
  const groupLabel=text(source.groupLabel);
  const comboId=text(source.comboId);
  const comboName=text(source.comboName);
  const role=source.role==='MAIN'||source.role==='SNACK'?source.role:undefined;
  const sourceLineId=text(source.sourceLineId);
  if(!groupLabel||!comboId||!comboName||!role)return undefined;
  return Object.freeze({
    groupLabel,comboId,comboName,role,
    ...(sourceLineId?{sourceLineId}:{}),
  });
}

export function normalizeMfkOrderLineCompositionV1(value:unknown):MfkOrderLineCompositionV1|undefined{
  const source=row(value);
  if(!source||source.schema!==MFK_ORDER_LINE_COMPOSITION_SCHEMA)return undefined;
  const cartLineId=text(source.cartLineId);
  if(!cartLineId)return undefined;
  const optionSelections=selections(source.optionSelections);
  const freeNote=typeof source.freeNote==='string'?source.freeNote:undefined;
  const pairingValue=pairing(source.pairing);
  return Object.freeze({
    schema:MFK_ORDER_LINE_COMPOSITION_SCHEMA,
    cartLineId,
    ...(optionSelections?{optionSelections}:{}),
    ...(freeNote!==undefined?{freeNote}:{}),
    ...(pairingValue?{pairing:pairingValue}:{}),
  });
}
