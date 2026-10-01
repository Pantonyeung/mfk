import {
  MFK_CHECKPOINTED_DELTA_SYNC_PROTOCOL,
  MFK_SYNC_SCHEMA_VERSION,
  fingerprintMfkSyncValue,
  type MfkSyncChange,
  type MfkSyncCheckpoint,
  type MfkSyncCheckpointEntity,
  type MfkSyncPort,
} from '../contracts/checkpointed-delta-sync-v1.ts';

type JsonRow=Record<string,unknown>;
export type MfkSyncEntityMap=Readonly<Record<string,MfkSyncCheckpointEntity>>;

function row(value:unknown):JsonRow{
  return value&&typeof value==='object'&&!Array.isArray(value)?value as JsonRow:{};
}
function rows(value:unknown):readonly unknown[]{return Array.isArray(value)?value:[];}
function text(value:unknown){return typeof value==='string'?value.trim():'';}
function safeId(value:unknown,fallback:string){
  const id=text(value);
  return (id||fallback).slice(0,220);
}
function entityKey(entityType:string,entityId:string){return entityType+':'+entityId;}
function clonePayload(value:unknown):Readonly<JsonRow>{
  const normalized=row(value);
  return Object.freeze(JSON.parse(JSON.stringify(normalized)) as JsonRow);
}
function checkpointEntity(entityType:string,entityId:string,payload:unknown,entityRevision=1):MfkSyncCheckpointEntity{
  const normalized=clonePayload(payload);
  return Object.freeze({
    entityType,
    entityId,
    entityRevision:Math.max(1,Math.floor(Number(entityRevision)||1)),
    payload:normalized,
    payloadHash:fingerprintMfkSyncValue(normalized),
  });
}
function put(out:Record<string,MfkSyncCheckpointEntity>,entityType:string,entityId:string,payload:unknown,entityRevision=1){
  const entity=checkpointEntity(entityType,entityId,payload,entityRevision);
  out[entityKey(entity.entityType,entity.entityId)]=entity;
}
function arrayEntities(
  out:Record<string,MfkSyncCheckpointEntity>,
  entityType:string,
  values:unknown,
  idKeys:readonly string[],
){
  rows(values).forEach((value,index)=>{
    const item=row(value);
    const chosen=idKeys.map(key=>safeId(item[key],'')).find(Boolean)||String(index+1);
    put(out,entityType,chosen,item);
  });
}
function keyedObjectEntities(out:Record<string,MfkSyncCheckpointEntity>,entityType:string,value:unknown){
  const source=row(value);
  for(const key of Object.keys(source).sort()){
    const payload=source[key];
    if(payload&&typeof payload==='object'&&!Array.isArray(payload))put(out,entityType,key,payload);
    else put(out,entityType,key,{value:payload});
  }
}

export function buildSmtSyncEntities(snapshot:unknown):MfkSyncEntityMap{
  const root=row(snapshot),catalog=row(root.catalog),optionCenter=row(root.optionCenter);
  const out:Record<string,MfkSyncCheckpointEntity>={};
  arrayEntities(out,'CATEGORY',catalog.categories,['id','categoryId']);
  arrayEntities(out,'PRODUCT',catalog.products,['id','productId','productCode']);
  arrayEntities(out,'COMBO',catalog.combos,['id','comboId']);
  arrayEntities(out,'COMBO_POOL',catalog.comboPools,['id','poolId']);
  arrayEntities(out,'OPTION_SET',optionCenter.sets,['id','setId']);
  rows(optionCenter.productLinks).forEach((value,index)=>{
    const item=row(value);
    const productId=safeId(item.productId,'PRODUCT');
    const setId=safeId(item.setId,String(index+1));
    put(out,'OPTION_PRODUCT_LINK',productId+'::'+setId,item);
  });
  keyedObjectEntities(out,'PRODUCT_MEDIA',root.productMedia);

  const catalogMeta={...catalog};
  delete catalogMeta.categories;delete catalogMeta.products;delete catalogMeta.combos;delete catalogMeta.comboPools;
  if(Object.keys(catalogMeta).length)put(out,'CATALOG_META','ROOT',catalogMeta);
  const optionMeta={...optionCenter};
  delete optionMeta.sets;delete optionMeta.productLinks;
  if(Object.keys(optionMeta).length)put(out,'OPTION_CENTER_META','ROOT',optionMeta);

  for(const key of Object.keys(root).sort()){
    if(key==='catalog'||key==='optionCenter'||key==='productMedia')continue;
    const value=root[key];
    if(value&&typeof value==='object'&&!Array.isArray(value))put(out,'SNAPSHOT_SECTION',key,value);
    else put(out,'SNAPSHOT_SCALAR',key,{value});
  }
  return Object.freeze(out);
}

export function buildCustomerSyncEntities(snapshot:unknown):MfkSyncEntityMap{
  const root=row(snapshot),menu=row(root.menu);
  const out:Record<string,MfkSyncCheckpointEntity>={};
  const store={...row(root.store)};
  delete store.observedAt;
  if(Object.keys(store).length)put(out,'CUSTOMER_STORE',safeId(store.storeId,'STORE'),store);
  arrayEntities(out,'CUSTOMER_CATEGORY',menu.categories,['categoryId','id']);
  arrayEntities(out,'CUSTOMER_PRODUCT',menu.products,['productId','id']);
  arrayEntities(out,'CUSTOMER_COMBO',menu.combos,['comboId','id']);
  arrayEntities(out,'CUSTOMER_COMBO_POOL',menu.comboPools,['poolId','id']);
  arrayEntities(out,'CUSTOMER_PAYMENT_CHANNEL',root.paymentChannels,['channelId','id']);
  const fallback=row(root.fallback);
  if(Object.keys(fallback).length)put(out,'CUSTOMER_FALLBACK','DEFAULT',fallback);
  const menuMeta={...menu};
  delete menuMeta.categories;delete menuMeta.products;delete menuMeta.combos;delete menuMeta.comboPools;
  delete menuMeta.observedAt;delete menuMeta.revision;
  if(Object.keys(menuMeta).length)put(out,'CUSTOMER_MENU_META','ROOT',menuMeta);
  return Object.freeze(out);
}

export function buildSmmSyncEntities(snapshot:unknown):MfkSyncEntityMap{
  const root=row(snapshot),menu=row(root.menu);
  const out:Record<string,MfkSyncCheckpointEntity>={};
  arrayEntities(out,'SMM_CATEGORY',menu.categories,['categoryId','id']);
  arrayEntities(out,'SMM_PRODUCT',menu.products,['productId','id']);
  arrayEntities(out,'SMM_COMBO',menu.combos,['comboId','id']);
  arrayEntities(out,'SMM_COMBO_POOL',menu.comboPools,['poolId','id']);
  arrayEntities(out,'SMM_DINING_TABLE',root.diningTables,['tableId','id']);
  const menuMeta={...menu};
  delete menuMeta.categories;delete menuMeta.products;delete menuMeta.combos;delete menuMeta.comboPools;
  delete menuMeta.observedAt;delete menuMeta.revision;
  if(Object.keys(menuMeta).length)put(out,'SMM_MENU_META','ROOT',menuMeta);
  return Object.freeze(out);
}

export function buildKeetaSyncEntities(projectionPayload:unknown):MfkSyncEntityMap{
  const root=row(projectionPayload);
  const out:Record<string,MfkSyncCheckpointEntity>={};
  arrayEntities(out,'KEETA_CATEGORY',root.shopCategoryList,['openItemCode','id']);
  arrayEntities(out,'KEETA_CHOICE_GROUP',root.choiceGroupList,['openItemCode','id']);
  arrayEntities(out,'KEETA_SPU',root.spuList,['openItemCode','id']);
  const sequenceMap=row(root.spuSequenceCodeMap);
  for(const key of Object.keys(sequenceMap).sort()){
    put(out,'KEETA_CATEGORY_SEQUENCE',key,{spuOpenItemCodes:sequenceMap[key]});
  }
  return Object.freeze(out);
}

export function projectionHashForEntities(entities:MfkSyncEntityMap){
  return fingerprintMfkSyncValue(
    Object.keys(entities).sort().map(key=>({
      key,
      entityRevision:entities[key]!.entityRevision,
      payloadHash:entities[key]!.payloadHash,
    })),
  );
}

export interface MfkSyncDiffInput{
  readonly storeId:string;
  readonly port:MfkSyncPort;
  readonly sourceCommitSeq:number;
  readonly commitId:string;
  readonly startingPortSeq:number;
  readonly previous:MfkSyncEntityMap;
  readonly next:MfkSyncEntityMap;
  readonly createdAt:string;
}
export interface MfkSyncDiffResult{
  readonly changes:readonly MfkSyncChange[];
  readonly headSeq:number;
  readonly projectionHash:string;
  readonly changedKeys:readonly string[];
}

export function diffMfkSyncEntities(input:MfkSyncDiffInput):MfkSyncDiffResult{
  const keys=[...new Set([...Object.keys(input.previous),...Object.keys(input.next)])].sort();
  const changes:MfkSyncChange[]=[];
  let seq=Math.max(0,Math.floor(input.startingPortSeq));
  const changedKeys:string[]=[];
  for(const key of keys){
    const before=input.previous[key],after=input.next[key];
    if(before&&after&&before.payloadHash===after.payloadHash)continue;
    seq+=1;
    changedKeys.push(key);
    const target=after??before!;
    const op=after?'UPSERT' as const:'DELETE' as const;
    const payloadHash=after
      ?after.payloadHash
      :fingerprintMfkSyncValue({entityType:target.entityType,entityId:target.entityId,op:'DELETE'});
    changes.push(Object.freeze({
      schema:'MFK_PORT_CHANGE_V1' as const,
      protocol:MFK_CHECKPOINTED_DELTA_SYNC_PROTOCOL,
      schemaVersion:MFK_SYNC_SCHEMA_VERSION,
      storeId:input.storeId,
      port:input.port,
      portSeq:seq,
      sourceCommitSeq:input.sourceCommitSeq,
      commitId:input.commitId,
      entityType:target.entityType,
      entityId:target.entityId,
      entityRevision:input.sourceCommitSeq,
      op,
      ...(after?{payload:after.payload}:{}),
      payloadHash,
      createdAt:input.createdAt,
    }));
  }
  return Object.freeze({
    changes:Object.freeze(changes),
    headSeq:seq,
    projectionHash:projectionHashForEntities(input.next),
    changedKeys:Object.freeze(changedKeys),
  });
}

export function createMfkSyncCheckpoint(input:{
  readonly storeId:string;
  readonly port:MfkSyncPort;
  readonly checkpointSeq:number;
  readonly sourceCommitSeq:number;
  readonly entities:MfkSyncEntityMap;
  readonly createdAt:string;
}):MfkSyncCheckpoint{
  const entities=Object.keys(input.entities).sort().map(key=>input.entities[key]!);
  const projectionHash=projectionHashForEntities(input.entities);
  const checkpointPreimage={
    storeId:input.storeId,
    port:input.port,
    checkpointSeq:input.checkpointSeq,
    sourceCommitSeq:input.sourceCommitSeq,
    projectionHash,
    entities:entities.map(entity=>({
      entityType:entity.entityType,
      entityId:entity.entityId,
      entityRevision:entity.entityRevision,
      payloadHash:entity.payloadHash,
    })),
  };
  return Object.freeze({
    schema:'MFK_SYNC_CHECKPOINT_V1' as const,
    protocol:MFK_CHECKPOINTED_DELTA_SYNC_PROTOCOL,
    schemaVersion:MFK_SYNC_SCHEMA_VERSION,
    storeId:input.storeId,
    port:input.port,
    checkpointSeq:Math.max(0,Math.floor(input.checkpointSeq)),
    sourceCommitSeq:Math.max(0,Math.floor(input.sourceCommitSeq)),
    projectionHash,
    checkpointHash:fingerprintMfkSyncValue(checkpointPreimage),
    entities:Object.freeze(entities),
    createdAt:input.createdAt,
  });
}

export function entityMapFromCheckpoint(checkpoint:MfkSyncCheckpoint):MfkSyncEntityMap{
  const out:Record<string,MfkSyncCheckpointEntity>={};
  for(const entity of checkpoint.entities)out[entityKey(entity.entityType,entity.entityId)]=entity;
  return Object.freeze(out);
}

export function applyMfkSyncChanges(
  current:MfkSyncEntityMap,
  changes:readonly MfkSyncChange[],
):MfkSyncEntityMap{
  const out:Record<string,MfkSyncCheckpointEntity>={...current};
  for(const change of changes){
    const key=entityKey(change.entityType,change.entityId);
    if(change.op==='DELETE'){delete out[key];continue;}
    if(!change.payload)throw new Error('SYNC_CHANGE_PAYLOAD_REQUIRED');
    out[key]=checkpointEntity(change.entityType,change.entityId,change.payload,change.entityRevision);
  }
  return Object.freeze(out);
}

export function materializeSmtSnapshot(entities:MfkSyncEntityMap):Readonly<JsonRow>{
  const snapshot:JsonRow={};
  const catalog:JsonRow={categories:[],products:[],combos:[],comboPools:[]};
  const optionCenter:JsonRow={sets:[],productLinks:[]};
  const productMedia:JsonRow={};
  for(const entity of Object.values(entities)){
    if(entity.entityType==='CATEGORY')(catalog.categories as unknown[]).push(entity.payload);
    else if(entity.entityType==='PRODUCT')(catalog.products as unknown[]).push(entity.payload);
    else if(entity.entityType==='COMBO')(catalog.combos as unknown[]).push(entity.payload);
    else if(entity.entityType==='COMBO_POOL')(catalog.comboPools as unknown[]).push(entity.payload);
    else if(entity.entityType==='OPTION_SET')(optionCenter.sets as unknown[]).push(entity.payload);
    else if(entity.entityType==='OPTION_PRODUCT_LINK')(optionCenter.productLinks as unknown[]).push(entity.payload);
    else if(entity.entityType==='PRODUCT_MEDIA')productMedia[entity.entityId]=entity.payload;
    else if(entity.entityType==='CATALOG_META')Object.assign(catalog,entity.payload);
    else if(entity.entityType==='OPTION_CENTER_META')Object.assign(optionCenter,entity.payload);
    else if(entity.entityType==='SNAPSHOT_SECTION')snapshot[entity.entityId]=entity.payload;
    else if(entity.entityType==='SNAPSHOT_SCALAR')snapshot[entity.entityId]=row(entity.payload).value;
  }
  snapshot.catalog=catalog;
  if(Object.keys(optionCenter).length)snapshot.optionCenter=optionCenter;
  if(Object.keys(productMedia).length)snapshot.productMedia=productMedia;
  return Object.freeze(snapshot);
}
