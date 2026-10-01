import {fingerprintMfkSyncValue,type MfkSyncPort} from '../contracts/checkpointed-delta-sync-v1.ts';

export interface MfkProjectedEntity{
  readonly entityType:string;
  readonly entityId:string;
  readonly payload:Readonly<Record<string,unknown>>;
  readonly payloadHash:string;
}

export interface MfkProjectedEntityDiff{
  readonly entityType:string;
  readonly entityId:string;
  readonly op:'UPSERT'|'DELETE';
  readonly payload?:Readonly<Record<string,unknown>>;
  readonly payloadHash:string;
}

function record(value:unknown):Record<string,unknown>{
  return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
}
function array(value:unknown):readonly unknown[]{return Array.isArray(value)?value:[];}
function text(value:unknown){return typeof value==='string'?value.trim():'';}

function freezePayload(value:Record<string,unknown>){
  return Object.freeze({...value});
}
function entity(entityType:string,entityId:string,payload:Record<string,unknown>):MfkProjectedEntity{
  const frozen=freezePayload(payload);
  return Object.freeze({entityType,entityId,payload:frozen,payloadHash:fingerprintMfkSyncValue(frozen)});
}
function indexedEntities(entityType:string,input:unknown,idFields:readonly string[]){
  return array(input).flatMap((raw,index)=>{
    const row=record(raw);
    const id=idFields.map(field=>text(row[field])).find(Boolean)||'INDEX:'+String(index);
    return id?[entity(entityType,id,row)]:[];
  });
}
function objectEntities(entityType:string,input:unknown){
  const source=record(input);
  return Object.keys(source).sort().map(id=>entity(entityType,id,record(source[id])));
}
function sectionEntity(snapshot:Record<string,unknown>,key:string){
  const value=snapshot[key];
  if(!value||typeof value!=='object')return[] as MfkProjectedEntity[];
  const payload=Array.isArray(value)?{items:value}:{...record(value)};
  return [entity('SECTION',key,payload)];
}

function commerceEntities(snapshot:Record<string,unknown>){
  const catalog=record(snapshot.catalog);
  const optionCenter=record(snapshot.optionCenter);
  return [
    ...indexedEntities('CATEGORY',catalog.categories,['id','categoryId']),
    ...indexedEntities('PRODUCT',catalog.products,['id','productId','productCode']),
    ...indexedEntities('COMBO',catalog.combos,['id','comboId']),
    ...indexedEntities('COMBO_POOL',catalog.comboPools,['id','poolId']),
    ...indexedEntities('OPTION_SET',optionCenter.sets,['id','setId','optionSetId']),
    ...array(optionCenter.productLinks).flatMap((raw,index)=>{
      const row=record(raw);
      const productId=text(row.productId);
      const setId=text(row.setId)||text(row.optionSetId);
      const id=productId&&setId?productId+':'+setId:'INDEX:'+String(index);
      return [entity('PRODUCT_OPTION_LINK',id,row)];
    }),
    ...objectEntities('PRODUCT_MEDIA',snapshot.productMedia),
  ];
}

const SMT_SECTION_KEYS=[
  'storeSettings','businessDay','logicalPrinters','printTemplates','printRules',
  'quickReasons','capacity','presentation','staffAuth','staff','channelPolicy',
  'channelMapping','availability','inventory','loyalty','coupons','announcements',
  'pricingPromotions','customerChannelPolicy','paymentChannels',
] as const;

const SMM_SECTION_KEYS=[
  'storeSettings','businessDay','capacity','presentation','pricingPromotions',
  'channelPolicy','quickReasons',
] as const;

const CUSTOMER_SECTION_KEYS=[
  'storeSettings','customerChannelPolicy','paymentChannels','pricingPromotions',
  'loyalty','coupons','announcements',
] as const;

const KEETA_SECTION_KEYS=[
  'storeSettings','channelMapping','keetaChannelMapping','pricingPromotions',
] as const;

function customerPresentation(snapshot:Record<string,unknown>){
  const presentation=record(snapshot.presentation);
  const customer=record(presentation.customer);
  return Object.keys(customer).length?[entity('CUSTOMER_PRESENTATION','customer',customer)]:[];
}

export function projectMfkSyncEntities(snapshotInput:unknown,port:MfkSyncPort):readonly MfkProjectedEntity[]{
  const snapshot=record(snapshotInput);
  const commerce=commerceEntities(snapshot);
  const sectionKeys=port==='SMT'?SMT_SECTION_KEYS
    :port==='SMM'?SMM_SECTION_KEYS
      :port==='CUSTOMER'?CUSTOMER_SECTION_KEYS
        :KEETA_SECTION_KEYS;

  const sections=sectionKeys.flatMap(key=>sectionEntity(snapshot,key));
  const extra=port==='CUSTOMER'?customerPresentation(snapshot):[];
  const entities=[...commerce,...sections,...extra]
    .sort((a,b)=>a.entityType.localeCompare(b.entityType)||a.entityId.localeCompare(b.entityId));

  // Per-port projection is deliberately allow-listed. Sensitive Admin-only sections are
  // never copied merely because they exist in the canonical snapshot.
  return Object.freeze(entities);
}

export function fingerprintMfkPortProjection(snapshot:unknown,port:MfkSyncPort){
  const entities=projectMfkSyncEntities(snapshot,port);
  return fingerprintMfkSyncValue(entities.map(item=>({
    entityType:item.entityType,
    entityId:item.entityId,
    payloadHash:item.payloadHash,
  })));
}

export function diffMfkPortProjection(previousSnapshot:unknown,nextSnapshot:unknown,port:MfkSyncPort):readonly MfkProjectedEntityDiff[]{
  const previous=new Map(projectMfkSyncEntities(previousSnapshot,port).map(item=>[item.entityType+'\u0000'+item.entityId,item] as const));
  const next=new Map(projectMfkSyncEntities(nextSnapshot,port).map(item=>[item.entityType+'\u0000'+item.entityId,item] as const));
  const keys=[...new Set([...previous.keys(),...next.keys()])].sort();
  const changes:MfkProjectedEntityDiff[]=[];

  for(const key of keys){
    const before=previous.get(key);
    const after=next.get(key);
    if(before&&after&&before.payloadHash===after.payloadHash)continue;
    if(after){
      changes.push(Object.freeze({
        entityType:after.entityType,
        entityId:after.entityId,
        op:'UPSERT' as const,
        payload:after.payload,
        payloadHash:after.payloadHash,
      }));
      continue;
    }
    if(before){
      changes.push(Object.freeze({
        entityType:before.entityType,
        entityId:before.entityId,
        op:'DELETE' as const,
        payloadHash:fingerprintMfkSyncValue({entityType:before.entityType,entityId:before.entityId,op:'DELETE'}),
      }));
    }
  }
  return Object.freeze(changes);
}
