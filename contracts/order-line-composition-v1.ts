export const MFK_ORDER_LINE_COMPOSITION_SCHEMA='MFK_ORDER_LINE_COMPOSITION_V1' as const;

export type MfkOrderLineServiceMode='takeaway'|'dine-in';
export type MfkOrderLineComboRole='MAIN_COURSE'|'SNACK'|'DRINK';

export interface MfkOrderLineOptionSelections{
  readonly [groupId:string]:readonly string[];
}

export interface MfkOrderLineComponentSnapshotV1{
  readonly productId:string;
  readonly name:string;
  readonly unitMinor:number;
  readonly serviceMode:MfkOrderLineServiceMode;
  readonly detail?:string;
  readonly optionSelections?:MfkOrderLineOptionSelections;
  readonly freeNote?:string;
}

export interface MfkOrderLineComboComponentV1{
  readonly groupId:string;
  readonly groupName:string;
  readonly role:MfkOrderLineComboRole;
  readonly choiceId:string;
  readonly choiceLabel:string;
  readonly sourceLineId:string;
  readonly snapshot:MfkOrderLineComponentSnapshotV1;
}

export interface MfkOrderLineComboResolvedChoiceV1{
  readonly groupId:string;
  readonly groupName:string;
  readonly role:MfkOrderLineComboRole;
  readonly choiceId:string;
  readonly choiceLabel:string;
  readonly priceAdjustmentMinor:number;
}

export interface MfkOrderLineComboPendingGroupV1{
  readonly groupId:string;
  readonly groupName:string;
  readonly role:MfkOrderLineComboRole;
  readonly required:boolean;
}

export interface MfkOrderLineComboV1{
  readonly comboId:string;
  readonly comboName:string;
  readonly pairingLabel:string;
  readonly source:'AUTO'|'SPECIFIED';
  readonly components:readonly MfkOrderLineComboComponentV1[];
  readonly resolvedChoices:readonly MfkOrderLineComboResolvedChoiceV1[];
  readonly pendingGroups:readonly MfkOrderLineComboPendingGroupV1[];
}

export interface MfkOrderLineCompositionV1{
  readonly schema:typeof MFK_ORDER_LINE_COMPOSITION_SCHEMA;
  readonly kind:'PRODUCT'|'COMBO';
  readonly cartLineId:string;
  readonly optionSelections?:MfkOrderLineOptionSelections;
  readonly freeNote?:string;
  readonly combo?:MfkOrderLineComboV1;
}

function row(value:unknown):Record<string,unknown>|null{
  return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:null;
}
function text(value:unknown){
  return typeof value==='string'?value:undefined;
}
function integer(value:unknown){
  const number=Number(value);
  return Number.isSafeInteger(number)?number:undefined;
}
function role(value:unknown):MfkOrderLineComboRole|undefined{
  return value==='MAIN_COURSE'||value==='SNACK'||value==='DRINK'?value:undefined;
}
function selections(value:unknown):MfkOrderLineOptionSelections|undefined{
  const source=row(value);
  if(!source)return undefined;
  const result:Record<string,readonly string[]>={};
  for(const [key,raw] of Object.entries(source)){
    if(!Array.isArray(raw))continue;
    const ids=[...new Set(raw.filter((item):item is string=>typeof item==='string'&&item.length>0))];
    if(ids.length)result[key]=Object.freeze(ids);
  }
  return Object.keys(result).length?Object.freeze(result):undefined;
}
function snapshot(value:unknown):MfkOrderLineComponentSnapshotV1|undefined{
  const source=row(value);
  if(!source)return undefined;
  const productId=text(source.productId);
  const name=text(source.name);
  const unitMinor=integer(source.unitMinor);
  const serviceMode=source.serviceMode==='takeaway'||source.serviceMode==='dine-in'?source.serviceMode:undefined;
  if(!productId||!name||unitMinor===undefined||unitMinor<0||!serviceMode)return undefined;
  const detail=text(source.detail);
  const optionSelections=selections(source.optionSelections);
  const freeNote=text(source.freeNote);
  return Object.freeze({
    productId,name,unitMinor,serviceMode,
    ...(detail!==undefined?{detail}:{}),
    ...(optionSelections?{optionSelections}:{}),
    ...(freeNote!==undefined?{freeNote}:{}),
  });
}
function combo(value:unknown):MfkOrderLineComboV1|undefined{
  const source=row(value);
  if(!source)return undefined;
  const comboId=text(source.comboId);
  const comboName=text(source.comboName);
  const pairingLabel=text(source.pairingLabel);
  const pairingSource=source.source==='AUTO'||source.source==='SPECIFIED'?source.source:undefined;
  if(!comboId||!comboName||!pairingLabel||!pairingSource)return undefined;

  const components=(Array.isArray(source.components)?source.components:[]).flatMap(raw=>{
    const item=row(raw);
    if(!item)return [];
    const groupId=text(item.groupId),groupName=text(item.groupName),itemRole=role(item.role);
    const choiceId=text(item.choiceId),choiceLabel=text(item.choiceLabel),sourceLineId=text(item.sourceLineId);
    const itemSnapshot=snapshot(item.snapshot);
    if(!groupId||!groupName||!itemRole||!choiceId||!choiceLabel||!sourceLineId||!itemSnapshot)return [];
    return [Object.freeze({groupId,groupName,role:itemRole,choiceId,choiceLabel,sourceLineId,snapshot:itemSnapshot})];
  });

  const resolvedChoices=(Array.isArray(source.resolvedChoices)?source.resolvedChoices:[]).flatMap(raw=>{
    const item=row(raw);
    if(!item)return [];
    const groupId=text(item.groupId),groupName=text(item.groupName),itemRole=role(item.role);
    const choiceId=text(item.choiceId),choiceLabel=text(item.choiceLabel),priceAdjustmentMinor=integer(item.priceAdjustmentMinor);
    if(!groupId||!groupName||!itemRole||!choiceId||!choiceLabel||priceAdjustmentMinor===undefined)return [];
    return [Object.freeze({groupId,groupName,role:itemRole,choiceId,choiceLabel,priceAdjustmentMinor})];
  });

  const pendingGroups=(Array.isArray(source.pendingGroups)?source.pendingGroups:[]).flatMap(raw=>{
    const item=row(raw);
    if(!item)return [];
    const groupId=text(item.groupId),groupName=text(item.groupName),itemRole=role(item.role);
    if(!groupId||!groupName||!itemRole||typeof item.required!=='boolean')return [];
    return [Object.freeze({groupId,groupName,role:itemRole,required:item.required})];
  });

  return Object.freeze({
    comboId,comboName,pairingLabel,source:pairingSource,
    components:Object.freeze(components),
    resolvedChoices:Object.freeze(resolvedChoices),
    pendingGroups:Object.freeze(pendingGroups),
  });
}

export function normalizeMfkOrderLineCompositionV1(value:unknown):MfkOrderLineCompositionV1|undefined{
  const source=row(value);
  if(!source||source.schema!==MFK_ORDER_LINE_COMPOSITION_SCHEMA)return undefined;
  if(source.kind!=='PRODUCT'&&source.kind!=='COMBO')return undefined;
  const cartLineId=text(source.cartLineId);
  if(!cartLineId)return undefined;
  const optionSelections=selections(source.optionSelections);
  const freeNote=text(source.freeNote);
  const comboValue=combo(source.combo);
  if(source.kind==='COMBO'&&!comboValue)return undefined;
  return Object.freeze({
    schema:MFK_ORDER_LINE_COMPOSITION_SCHEMA,
    kind:source.kind,
    cartLineId,
    ...(optionSelections?{optionSelections}:{}),
    ...(freeNote!==undefined?{freeNote}:{}),
    ...(comboValue?{combo:comboValue}:{}),
  });
}
