import {
  validateMfkSyncChangeBatch,
  type MfkSyncChange,
  type MfkSyncChangeBatch,
} from '../contracts/checkpointed-delta-sync-v1.ts';
import type {MfkSyncEntityMap} from '../sync/checkpointed-delta-sync.ts';

export const MFK_KEETA_PROVIDER_MUTATION_PLAN_SCHEMA='MFK_KEETA_PROVIDER_MUTATION_PLAN_V1' as const;

export const KEETA_PROVIDER_ENDPOINTS=Object.freeze({
  categoryList:'/product/shopcategory/list',
  categoryCreate:'/product/shopcategory/create',
  categoryUpdate:'/product/shopcategory/update',
  categoryDelete:'/product/shopcategory/batchdel',
  categorySequence:'/product/shopcategory/batchupdatesequence',
  spuList:'/product/spu/list',
  spuDetail:'/product/spu/detail',
  spuCreate:'/product/spu/batchcreate',
  spuUpdate:'/product/spu/batchupdate',
  spuDelete:'/product/spu/batchdel',
  spuSequence:'/product/spu/batchupdatesequence',
  choiceGroupList:'/product/choicegroup/list',
  choiceGroupCreate:'/product/choicegroup/batchcreate',
  choiceGroupUpdate:'/product/choicegroup/batchupdate',
  choiceGroupDelete:'/product/choicegroup/batchdel',
  choiceGroupAppliedSpu:'/product/choicegroup/listappliedspu',
} as const);

export type KeetaProviderMutationState='PENDING'|'APPLIED'|'REJECTED'|'UNKNOWN';
export type KeetaProviderMutationKind=
  |'CATEGORY_UPSERT'|'CATEGORY_DELETE'|'CATEGORY_SEQUENCE'
  |'CHOICE_GROUP_UPSERT'|'CHOICE_GROUP_DELETE'
  |'SPU_UPSERT'|'SPU_DELETE'|'SPU_SEQUENCE'
  |'NO_PROVIDER_MUTATION';

export interface KeetaProviderOperationContract{
  readonly strategy:'READBACK_THEN_CREATE_OR_UPDATE'|'READBACK_THEN_DELETE'|'SEQUENCE_UPDATE'|'NOOP';
  readonly readback?:string;
  readonly create?:string;
  readonly update?:string;
  readonly execute?:string;
  readonly reason?:string;
}

export interface KeetaProviderMutation{
  readonly operationId:string;
  readonly kind:KeetaProviderMutationKind;
  readonly entityId:string;
  readonly sourcePortSeqs:readonly number[];
  readonly dependencyOrder:number;
  readonly dependencies:readonly string[];
  readonly providerOperation:KeetaProviderOperationContract;
  readonly payload?:Readonly<Record<string,unknown>>;
  readonly payloadHash:string;
}

export interface KeetaProviderMutationPlan{
  readonly schema:typeof MFK_KEETA_PROVIDER_MUTATION_PLAN_SCHEMA;
  readonly storeId:string;
  readonly sourceFromSeq:number;
  readonly sourceToSeq:number;
  readonly headSeq:number;
  readonly mutations:readonly KeetaProviderMutation[];
}

interface MutationDraft{
  kind:KeetaProviderMutationKind;
  entityId:string;
  sourcePortSeqs:number[];
  dependencyOrder:number;
  dependencies:string[];
  providerOperation:KeetaProviderOperationContract;
  payload?:Readonly<Record<string,unknown>>;
  payloadHash:string;
}

const OPERATION_BY_KIND:Readonly<Record<KeetaProviderMutationKind,KeetaProviderOperationContract>>=Object.freeze({
  CATEGORY_UPSERT:Object.freeze({
    strategy:'READBACK_THEN_CREATE_OR_UPDATE',readback:KEETA_PROVIDER_ENDPOINTS.categoryList,
    create:KEETA_PROVIDER_ENDPOINTS.categoryCreate,update:KEETA_PROVIDER_ENDPOINTS.categoryUpdate,
  }),
  CATEGORY_DELETE:Object.freeze({
    strategy:'READBACK_THEN_DELETE',readback:KEETA_PROVIDER_ENDPOINTS.categoryList,
    execute:KEETA_PROVIDER_ENDPOINTS.categoryDelete,
  }),
  CATEGORY_SEQUENCE:Object.freeze({
    strategy:'SEQUENCE_UPDATE',readback:KEETA_PROVIDER_ENDPOINTS.categoryList,
    execute:KEETA_PROVIDER_ENDPOINTS.categorySequence,
  }),
  CHOICE_GROUP_UPSERT:Object.freeze({
    strategy:'READBACK_THEN_CREATE_OR_UPDATE',readback:KEETA_PROVIDER_ENDPOINTS.choiceGroupList,
    create:KEETA_PROVIDER_ENDPOINTS.choiceGroupCreate,update:KEETA_PROVIDER_ENDPOINTS.choiceGroupUpdate,
  }),
  CHOICE_GROUP_DELETE:Object.freeze({
    strategy:'READBACK_THEN_DELETE',readback:KEETA_PROVIDER_ENDPOINTS.choiceGroupList,
    execute:KEETA_PROVIDER_ENDPOINTS.choiceGroupDelete,
  }),
  SPU_UPSERT:Object.freeze({
    strategy:'READBACK_THEN_CREATE_OR_UPDATE',readback:KEETA_PROVIDER_ENDPOINTS.spuList,
    create:KEETA_PROVIDER_ENDPOINTS.spuCreate,update:KEETA_PROVIDER_ENDPOINTS.spuUpdate,
  }),
  SPU_DELETE:Object.freeze({
    strategy:'READBACK_THEN_DELETE',readback:KEETA_PROVIDER_ENDPOINTS.spuList,
    execute:KEETA_PROVIDER_ENDPOINTS.spuDelete,
  }),
  SPU_SEQUENCE:Object.freeze({
    strategy:'SEQUENCE_UPDATE',readback:KEETA_PROVIDER_ENDPOINTS.spuList,
    execute:KEETA_PROVIDER_ENDPOINTS.spuSequence,
  }),
  NO_PROVIDER_MUTATION:Object.freeze({
    strategy:'NOOP',reason:'No provider write is required for a removed category-local sequence or redundant global ChoiceGroup/SPU order.',
  }),
});

function record(value:unknown):Readonly<Record<string,unknown>>{
  return value&&typeof value==='object'&&!Array.isArray(value)?value as Readonly<Record<string,unknown>>:Object.freeze({});
}

function strings(value:unknown):readonly string[]{
  return Array.isArray(value)?value.map(String).filter(Boolean):[];
}

function entityPayload(entities:MfkSyncEntityMap,entityType:string,entityId:string){
  return Object.values(entities).find(entity=>entity.entityType===entityType&&entity.entityId===entityId)?.payload;
}

function dependentSpuIds(entities:MfkSyncEntityMap,choiceGroupId:string){
  return Object.values(entities)
    .filter(entity=>entity.entityType==='KEETA_SPU')
    .filter(entity=>{
      const payload=record(entity.payload);
      return (Array.isArray(payload.skuList)?payload.skuList:[]).some(rawSku=>{
        const sku=record(rawSku);
        return strings(sku.choiceGroupOpenItemCodeList).includes(choiceGroupId);
      });
    })
    .map(entity=>entity.entityId)
    .sort();
}

function spuDependencies(payload:Readonly<Record<string,unknown>>){
  const dependencies=[...strings(payload.shopCategoryOpenItemCodeList)];
  for(const rawSku of Array.isArray(payload.skuList)?payload.skuList:[]){
    dependencies.push(...strings(record(rawSku).choiceGroupOpenItemCodeList));
  }
  return [...new Set(dependencies)].sort();
}

function mutationForChange(change:MfkSyncChange):MutationDraft{
  const payload=record(change.payload);
  if(change.entityType==='KEETA_CATEGORY')return{
    kind:change.op==='DELETE'?'CATEGORY_DELETE':'CATEGORY_UPSERT',entityId:change.entityId,
    sourcePortSeqs:[change.portSeq],dependencyOrder:change.op==='DELETE'?50:10,dependencies:[],
    providerOperation:OPERATION_BY_KIND[change.op==='DELETE'?'CATEGORY_DELETE':'CATEGORY_UPSERT'],
    ...(change.op==='UPSERT'?{payload}:{}),payloadHash:change.payloadHash,
  };
  if(change.entityType==='KEETA_CHOICE_GROUP')return{
    kind:change.op==='DELETE'?'CHOICE_GROUP_DELETE':'CHOICE_GROUP_UPSERT',entityId:change.entityId,
    sourcePortSeqs:[change.portSeq],dependencyOrder:change.op==='DELETE'?50:20,dependencies:[],
    providerOperation:OPERATION_BY_KIND[change.op==='DELETE'?'CHOICE_GROUP_DELETE':'CHOICE_GROUP_UPSERT'],
    ...(change.op==='UPSERT'?{payload}:{}),payloadHash:change.payloadHash,
  };
  if(change.entityType==='KEETA_SPU')return{
    kind:change.op==='DELETE'?'SPU_DELETE':'SPU_UPSERT',entityId:change.entityId,
    sourcePortSeqs:[change.portSeq],dependencyOrder:change.op==='DELETE'?40:30,
    dependencies:change.op==='UPSERT'?[...spuDependencies(payload)]:[],
    providerOperation:OPERATION_BY_KIND[change.op==='DELETE'?'SPU_DELETE':'SPU_UPSERT'],
    ...(change.op==='UPSERT'?{payload}:{}),payloadHash:change.payloadHash,
  };
  if(change.entityType==='KEETA_CATEGORY_SEQUENCE'){
    const spuCodes=strings(payload.spuOpenItemCodes);
    const noop=change.op==='DELETE'||spuCodes.length===0;
    return{
      kind:noop?'NO_PROVIDER_MUTATION':'SPU_SEQUENCE',entityId:change.entityId,
      sourcePortSeqs:[change.portSeq],dependencyOrder:noop?80:60,
      dependencies:noop?[]:[change.entityId,...spuCodes],
      providerOperation:OPERATION_BY_KIND[noop?'NO_PROVIDER_MUTATION':'SPU_SEQUENCE'],
      ...(!noop?{payload}:{}),payloadHash:change.payloadHash,
    };
  }
  if(change.entityType==='ENTITY_ORDER'&&change.entityId==='KEETA:CATEGORY')return{
    kind:'CATEGORY_SEQUENCE',entityId:change.entityId,sourcePortSeqs:[change.portSeq],dependencyOrder:60,
    dependencies:[...strings(payload.ids)],providerOperation:OPERATION_BY_KIND.CATEGORY_SEQUENCE,
    payload,payloadHash:change.payloadHash,
  };
  if(change.entityType==='ENTITY_ORDER'&&(change.entityId==='KEETA:CHOICE_GROUP'||change.entityId==='KEETA:SPU'))return{
    kind:'NO_PROVIDER_MUTATION',entityId:change.entityId,sourcePortSeqs:[change.portSeq],dependencyOrder:80,
    dependencies:[],providerOperation:OPERATION_BY_KIND.NO_PROVIDER_MUTATION,
    payload,payloadHash:change.payloadHash,
  };
  throw new Error('KEETA_PROVIDER_MUTATION_ENTITY_UNSUPPORTED:'+change.entityType+':'+change.entityId);
}

function mergeMutation(target:Map<string,MutationDraft>,draft:MutationDraft){
  const key=draft.kind+':'+draft.entityId;
  const existing=target.get(key);
  if(!existing){target.set(key,draft);return;}
  existing.sourcePortSeqs=[...new Set([...existing.sourcePortSeqs,...draft.sourcePortSeqs])].sort((a,b)=>a-b);
  existing.dependencies=[...new Set([...existing.dependencies,...draft.dependencies])].sort();
  if(draft.payload)existing.payload=draft.payload;
  existing.payloadHash=draft.payloadHash;
  existing.dependencyOrder=Math.min(existing.dependencyOrder,draft.dependencyOrder);
}

export function planKeetaProviderMutations(input:{
  readonly batch:unknown;
  readonly currentEntities:MfkSyncEntityMap;
}):KeetaProviderMutationPlan{
  const batch:MfkSyncChangeBatch=validateMfkSyncChangeBatch(input.batch);
  if(batch.port!=='KEETA')throw new Error('KEETA_PROVIDER_MUTATION_PORT_REQUIRED');
  const terminal=new Map<string,{change:MfkSyncChange;sourcePortSeqs:number[]}>();
  for(const change of batch.changes){
    const key=change.entityType+':'+change.entityId;
    const current=terminal.get(key);
    terminal.set(key,{change,sourcePortSeqs:[...(current?.sourcePortSeqs??[]),change.portSeq]});
  }
  const effectiveChanges=[...terminal.values()];
  const drafts=new Map<string,MutationDraft>();
  for(const effective of effectiveChanges){
    const draft=mutationForChange(effective.change);
    draft.sourcePortSeqs=effective.sourcePortSeqs;
    mergeMutation(drafts,draft);
  }

  for(const {change,sourcePortSeqs} of effectiveChanges){
    if(change.entityType!=='KEETA_CHOICE_GROUP'||change.op!=='UPSERT')continue;
    for(const spuId of dependentSpuIds(input.currentEntities,change.entityId)){
      const entity=Object.values(input.currentEntities).find(row=>row.entityType==='KEETA_SPU'&&row.entityId===spuId);
      if(!entity)continue;
      mergeMutation(drafts,{
        kind:'SPU_UPSERT',entityId:spuId,sourcePortSeqs:[...sourcePortSeqs],dependencyOrder:30,
        dependencies:spuDependencies(record(entity.payload)),providerOperation:OPERATION_BY_KIND.SPU_UPSERT,
        payload:record(entity.payload),payloadHash:entity.payloadHash,
      });
    }
  }

  for(const draft of drafts.values()){
    if(draft.kind==='CHOICE_GROUP_DELETE'&&dependentSpuIds(input.currentEntities,draft.entityId).length){
      throw new Error('KEETA_PROVIDER_CHOICE_GROUP_STILL_REFERENCED:'+draft.entityId);
    }
    if(draft.kind==='CATEGORY_DELETE'){
      const dependent=Object.values(input.currentEntities).filter(entity=>
        entity.entityType==='KEETA_SPU'&&strings(record(entity.payload).shopCategoryOpenItemCodeList).includes(draft.entityId));
      if(dependent.length)throw new Error('KEETA_PROVIDER_CATEGORY_STILL_REFERENCED:'+draft.entityId);
    }
  }

  const mutations=[...drafts.values()].map(draft=>Object.freeze({
    ...draft,
    sourcePortSeqs:Object.freeze([...draft.sourcePortSeqs]),
    dependencies:Object.freeze([...draft.dependencies]),
    operationId:['KEETA',batch.storeId,draft.sourcePortSeqs[0],draft.kind,draft.entityId,draft.payloadHash].join(':'),
  })).sort((a,b)=>a.dependencyOrder-b.dependencyOrder||a.entityId.localeCompare(b.entityId)||a.operationId.localeCompare(b.operationId));

  return Object.freeze({
    schema:MFK_KEETA_PROVIDER_MUTATION_PLAN_SCHEMA,
    storeId:batch.storeId,
    sourceFromSeq:batch.fromExclusive,
    sourceToSeq:batch.toInclusive,
    headSeq:batch.headSeq,
    mutations:Object.freeze(mutations),
  });
}

export interface KeetaProviderMutationStorage{
  get(key:string):Promise<unknown>;
  put(key:string,value:unknown):Promise<void>;
}

export interface KeetaProviderReceipt{
  readonly code:number;
  readonly message:string;
  readonly data:unknown;
  readonly errorList:readonly unknown[];
}

export type KeetaProviderRequest=(path:string,params:Readonly<Record<string,unknown>>)=>Promise<KeetaProviderReceipt>;

export const KEETA_PROVIDER_STATUS_KEY='provider:mutation:status';
const operationKey=(operationId:string)=>'provider:mutation:operation:'+operationId;
const sequenceKey=(seq:number)=>'provider:mutation:seq:'+String(seq).padStart(16,'0');

function rows(value:unknown){
  return Array.isArray(value)?value.map(record):[];
}

function stable(value:unknown):string{
  if(Array.isArray(value))return '['+value.map(stable).join(',')+']';
  if(value&&typeof value==='object'){
    const item=value as Record<string,unknown>;
    return '{'+Object.keys(item).sort().map(key=>JSON.stringify(key)+':'+stable(item[key])).join(',')+'}';
  }
  return JSON.stringify(value)??'undefined';
}

function comparable(value:unknown):unknown{
  if(Array.isArray(value))return value.map(comparable);
  if(!value||typeof value!=='object')return value;
  const out:Record<string,unknown>={};
  for(const [key,entry] of Object.entries(value as Record<string,unknown>)){
    if(entry===undefined||key==='id'||key==='sequence'||key==='shopCategoryList'||key==='choiceGroupList')continue;
    out[key]=comparable(entry);
  }
  return out;
}

function providerMatchesDesired(provider:Readonly<Record<string,unknown>>|undefined,desired:Readonly<Record<string,unknown>>|undefined){
  if(!provider||!desired)return false;
  const expected=comparable(desired) as Record<string,unknown>;
  const actual=comparable(provider) as Record<string,unknown>;
  return Object.entries(expected).every(([key,value])=>stable(actual[key])===stable(value));
}

type InventoryKind='CATEGORY'|'CHOICE_GROUP'|'SPU';
interface ExecutionContext{
  inventories:Partial<Record<InventoryKind,readonly Readonly<Record<string,unknown>>[]>>;
  currentEntities:MfkSyncEntityMap;
  providerShopId:number;
  request:KeetaProviderRequest;
}

function inventoryEndpoint(kind:InventoryKind){
  return kind==='CATEGORY'?KEETA_PROVIDER_ENDPOINTS.categoryList
    :kind==='CHOICE_GROUP'?KEETA_PROVIDER_ENDPOINTS.choiceGroupList
      :KEETA_PROVIDER_ENDPOINTS.spuList;
}

async function loadInventory(context:ExecutionContext,kind:InventoryKind,force=false){
  if(!force&&context.inventories[kind])return context.inventories[kind]!;
  const receipt=await context.request(inventoryEndpoint(kind),{shopId:context.providerShopId});
  const result=Object.freeze(rows(receipt.data));
  context.inventories[kind]=result;
  return result;
}

function findByOpenItemCode(inventory:readonly Readonly<Record<string,unknown>>[],openItemCode:string){
  return inventory.find(item=>String(item.openItemCode||'')===openItemCode);
}

function replaceInventoryRow(context:ExecutionContext,kind:InventoryKind,row:Readonly<Record<string,unknown>>){
  const current=context.inventories[kind]??[];
  const code=String(row.openItemCode||'');
  context.inventories[kind]=Object.freeze([...current.filter(item=>String(item.openItemCode||'')!==code),row]);
}

function desiredEntity(context:ExecutionContext,entityType:string,entityId:string){
  return record(entityPayload(context.currentEntities,entityType,entityId));
}

function requiredProviderRow(inventory:readonly Readonly<Record<string,unknown>>[],code:string,kind:string){
  const found=findByOpenItemCode(inventory,code);
  if(!found||!Number.isSafeInteger(Number(found.id))||Number(found.id)<=0){
    throw Object.assign(new Error('KEETA_PROVIDER_DEPENDENCY_UNRESOLVED:'+kind+':'+code),{providerRejected:true});
  }
  return found;
}

async function providerPayloadForUpsert(context:ExecutionContext,mutation:KeetaProviderMutation,existing?:Readonly<Record<string,unknown>>){
  const desired=record(mutation.payload);
  if(mutation.kind==='CATEGORY_UPSERT')return Object.freeze({...desired,...(existing?{id:Number(existing.id)}:{})});
  if(mutation.kind==='CHOICE_GROUP_UPSERT'){
    const existingOptions=new Map(rows(existing?.choiceGroupSkuList).map(item=>[String(item.openItemCode||''),item]));
    const choiceGroupSkuList=rows(desired.choiceGroupSkuList).map(option=>{
      const current=existingOptions.get(String(option.openItemCode||''));
      return Object.freeze({...option,...(current&&Number(current.id)>0?{id:Number(current.id)}:{})});
    });
    return Object.freeze({...desired,...(existing?{id:Number(existing.id)}:{}),choiceGroupSkuList:Object.freeze(choiceGroupSkuList)});
  }

  const categories=await loadInventory(context,'CATEGORY');
  const groups=await loadInventory(context,'CHOICE_GROUP');
  const existingSkus=new Map(rows(existing?.skuList).map(item=>[String(item.openItemCode||''),item]));
  const shopCategoryList=strings(desired.shopCategoryOpenItemCodeList).map(code=>{
    const provider=requiredProviderRow(categories,code,'CATEGORY');
    return Object.freeze({...desiredEntity(context,'KEETA_CATEGORY',code),id:Number(provider.id)});
  });
  const skuList=rows(desired.skuList).map(sku=>{
    const current=existingSkus.get(String(sku.openItemCode||''));
    const choiceGroupList=strings(sku.choiceGroupOpenItemCodeList).map(code=>{
      const provider=requiredProviderRow(groups,code,'CHOICE_GROUP');
      const groupDesired=desiredEntity(context,'KEETA_CHOICE_GROUP',code);
      const providerOptions=new Map(rows(provider.choiceGroupSkuList).map(item=>[String(item.openItemCode||''),item]));
      const choiceGroupSkuList=rows(groupDesired.choiceGroupSkuList).map(option=>{
        const providerOption=providerOptions.get(String(option.openItemCode||''));
        return Object.freeze({...option,...(providerOption&&Number(providerOption.id)>0?{id:Number(providerOption.id)}:{})});
      });
      return Object.freeze({...groupDesired,id:Number(provider.id),choiceGroupSkuList:Object.freeze(choiceGroupSkuList)});
    });
    return Object.freeze({...sku,...(current&&Number(current.id)>0?{id:Number(current.id)}:{}),choiceGroupList:Object.freeze(choiceGroupList)});
  });
  return Object.freeze({...desired,...(existing?{id:Number(existing.id)}:{}),shopCategoryList:Object.freeze(shopCategoryList),skuList:Object.freeze(skuList)});
}

function mutationInventoryKind(kind:KeetaProviderMutationKind):InventoryKind|null{
  if(kind.startsWith('CATEGORY_'))return 'CATEGORY';
  if(kind.startsWith('CHOICE_GROUP_'))return 'CHOICE_GROUP';
  if(kind.startsWith('SPU_'))return 'SPU';
  return null;
}

function operationRecord(mutation:KeetaProviderMutation,state:KeetaProviderMutationState,extra:Readonly<Record<string,unknown>>={}){
  return Object.freeze({
    schema:'MFK_KEETA_PROVIDER_OPERATION_V1',operationId:mutation.operationId,kind:mutation.kind,
    entityId:mutation.entityId,sourcePortSeqs:mutation.sourcePortSeqs,state,observedAt:new Date().toISOString(),...extra,
  });
}

function successfulReceiptRow(receipt:KeetaProviderReceipt,mutation:KeetaProviderMutation,existing?:Readonly<Record<string,unknown>>){
  const candidates=Array.isArray(receipt.data)?rows(receipt.data):[record(receipt.data)];
  return candidates.find(item=>String(item.openItemCode||'')===mutation.entityId)
    ??candidates.find(item=>existing&&Number(item.id)===Number(existing.id));
}

async function executeUpsert(context:ExecutionContext,mutation:KeetaProviderMutation){
  const kind=mutationInventoryKind(mutation.kind)!;
  const inventory=await loadInventory(context,kind);
  const existing=findByOpenItemCode(inventory,mutation.entityId);
  const payload=await providerPayloadForUpsert(context,mutation,existing);
  const path=existing?mutation.providerOperation.update:mutation.providerOperation.create;
  if(!path)throw Object.assign(new Error('KEETA_PROVIDER_UPSERT_ENDPOINT_MISSING'),{providerRejected:true});
  const params=mutation.kind==='CATEGORY_UPSERT'
    ?{shopId:context.providerShopId,shopCategory:payload}
    :mutation.kind==='CHOICE_GROUP_UPSERT'
      ?{shopId:context.providerShopId,choiceGroupList:[payload]}
      :{shopId:context.providerShopId,spuList:[payload]};
  const receipt=await context.request(path,params);
  if(receipt.errorList.length)throw Object.assign(new Error('KEETA_PROVIDER_PARTIAL_REJECTED'),{providerRejected:true,receipt});
  const readback=successfulReceiptRow(receipt,mutation,existing);
  if(!readback)throw Object.assign(new Error('KEETA_PROVIDER_SUCCESS_READBACK_MISSING'),{unknown:true,receipt});
  replaceInventoryRow(context,kind,Object.freeze({...payload,...readback}));
  return Object.freeze({path,receipt,readback});
}

async function executeDelete(context:ExecutionContext,mutation:KeetaProviderMutation){
  const kind=mutationInventoryKind(mutation.kind)!;
  const inventory=await loadInventory(context,kind);
  const existing=findByOpenItemCode(inventory,mutation.entityId);
  if(!existing)return Object.freeze({path:null,receipt:null,readback:'ALREADY_ABSENT'});
  const id=Number(existing.id);
  if(!Number.isSafeInteger(id)||id<=0)throw Object.assign(new Error('KEETA_PROVIDER_DELETE_ID_UNAVAILABLE'),{providerRejected:true});
  const path=mutation.providerOperation.execute!;
  const params=mutation.kind==='CATEGORY_DELETE'
    ?{shopId:context.providerShopId,shopCategoryIdList:[id]}
    :mutation.kind==='CHOICE_GROUP_DELETE'
      ?{shopId:context.providerShopId,choiceGroupIdList:[id]}
      :{shopId:context.providerShopId,spuIdList:[id],linkedDel:false};
  const receipt=await context.request(path,params);
  if(receipt.errorList.length)throw Object.assign(new Error('KEETA_PROVIDER_PARTIAL_REJECTED'),{providerRejected:true,receipt});
  const applied=Array.isArray(receipt.data)&&receipt.data.map(Number).includes(id);
  if(!applied)throw Object.assign(new Error('KEETA_PROVIDER_DELETE_READBACK_MISSING'),{unknown:true,receipt});
  context.inventories[kind]=Object.freeze(inventory.filter(item=>Number(item.id)!==id));
  return Object.freeze({path,receipt,readback:id});
}

async function executeSequence(context:ExecutionContext,mutation:KeetaProviderMutation){
  const path=mutation.providerOperation.execute!;
  if(mutation.kind==='CATEGORY_SEQUENCE'){
    const inventory=await loadInventory(context,'CATEGORY');
    const ids=strings(record(mutation.payload).ids);
    const openShopCategorySequenceDTOList=ids.map((code,index)=>({
      shopCategoryId:Number(requiredProviderRow(inventory,code,'CATEGORY').id),sequence:index+1,
    }));
    const receipt=await context.request(path,{shopId:context.providerShopId,openShopCategorySequenceDTOList});
    return Object.freeze({path,receipt,readback:openShopCategorySequenceDTOList});
  }
  const categories=await loadInventory(context,'CATEGORY');
  const spus=await loadInventory(context,'SPU');
  const spuSequenceDTOList=strings(record(mutation.payload).spuOpenItemCodes).map((code,index)=>({
    spuId:Number(requiredProviderRow(spus,code,'SPU').id),sequence:index+1,
  }));
  const shopCategoryId=Number(requiredProviderRow(categories,mutation.entityId,'CATEGORY').id);
  const receipt=await context.request(path,{shopId:context.providerShopId,shopCategoryId,spuSequenceDTOList});
  return Object.freeze({path,receipt,readback:spuSequenceDTOList});
}

async function readbackBeforeRetry(context:ExecutionContext,mutation:KeetaProviderMutation){
  if(mutation.kind==='NO_PROVIDER_MUTATION')return true;
  const kind=mutationInventoryKind(mutation.kind)!;
  const inventory=await loadInventory(context,kind,true);
  const existing=findByOpenItemCode(inventory,mutation.entityId);
  if(mutation.kind.endsWith('_DELETE'))return !existing;
  if(mutation.kind.endsWith('_UPSERT'))return providerMatchesDesired(existing,mutation.payload);
  return false;
}

async function refreshSequenceStates(storage:KeetaProviderMutationStorage,plan:KeetaProviderMutationPlan){
  for(let seq=plan.sourceFromSeq+1;seq<=plan.sourceToSeq;seq++){
    const operationIds=plan.mutations.filter(item=>item.sourcePortSeqs.includes(seq)).map(item=>item.operationId);
    const states=await Promise.all(operationIds.map(async id=>String(record(await storage.get(operationKey(id))).state||'PENDING')));
    const state:KeetaProviderMutationState=states.every(value=>value==='APPLIED')?'APPLIED'
      :states.some(value=>value==='REJECTED')?'REJECTED'
        :states.some(value=>value==='UNKNOWN')?'UNKNOWN':'PENDING';
    await storage.put(sequenceKey(seq),Object.freeze({
      schema:'MFK_KEETA_PROVIDER_SEQUENCE_V1',portSeq:seq,operationIds:Object.freeze(operationIds),state,observedAt:new Date().toISOString(),
    }));
  }
}

async function contiguousAppliedSeq(storage:KeetaProviderMutationStorage,current:number,target:number){
  let applied=current;
  for(let seq=current+1;seq<=target;seq++){
    if(String(record(await storage.get(sequenceKey(seq))).state||'')!=='APPLIED')break;
    applied=seq;
  }
  return applied;
}

export async function executeKeetaProviderMutationPlan(input:{
  readonly plan:KeetaProviderMutationPlan;
  readonly currentEntities:MfkSyncEntityMap;
  readonly providerShopId:number;
  readonly storage:KeetaProviderMutationStorage;
  readonly request:KeetaProviderRequest;
}){
  const currentStatus=record(await input.storage.get(KEETA_PROVIDER_STATUS_KEY));
  const currentApplied=Math.max(0,Number(currentStatus.providerAppliedSeq)||0);
  if(currentApplied>=input.plan.sourceToSeq)return currentStatus;
  if(currentApplied!==input.plan.sourceFromSeq){
    const status=Object.freeze({
      schema:'MFK_KEETA_PROVIDER_STATUS_V1',headSeq:input.plan.headSeq,providerAppliedSeq:currentApplied,
      behindCount:Math.max(0,input.plan.headSeq-currentApplied),lastOperation:null,taskId:null,state:'UNKNOWN',
      observedAt:new Date().toISOString(),error:'KEETA_PROVIDER_JOURNAL_GAP',
    });
    await input.storage.put(KEETA_PROVIDER_STATUS_KEY,status);
    return status;
  }

  await input.storage.put(KEETA_PROVIDER_STATUS_KEY,Object.freeze({
    schema:'MFK_KEETA_PROVIDER_STATUS_V1',headSeq:input.plan.headSeq,providerAppliedSeq:currentApplied,
    behindCount:Math.max(0,input.plan.headSeq-currentApplied),lastOperation:currentStatus.lastOperation??null,
    taskId:null,state:'PENDING',observedAt:new Date().toISOString(),error:null,
  }));

  const context:ExecutionContext={
    inventories:{},currentEntities:input.currentEntities,providerShopId:input.providerShopId,request:input.request,
  };
  let lastOperation:Readonly<Record<string,unknown>>|null=null;
  for(const mutation of input.plan.mutations){
    const key=operationKey(mutation.operationId);
    const previous=record(await input.storage.get(key));
    if(previous.state==='APPLIED'){lastOperation=previous;continue;}
    if(previous.state==='REJECTED'){lastOperation=previous;break;}
    await input.storage.put(key,operationRecord(mutation,'PENDING',{attemptedAt:new Date().toISOString()}));
    try{
      if((previous.state==='UNKNOWN'||previous.state==='PENDING')&&await readbackBeforeRetry(context,mutation)){
        const applied=operationRecord(mutation,'APPLIED',{providerOperation:'READBACK_CONFIRMED',readbackAt:new Date().toISOString()});
        await input.storage.put(key,applied);lastOperation=applied;continue;
      }
      const result=mutation.kind==='NO_PROVIDER_MUTATION'
        ?Object.freeze({path:null,receipt:null,readback:mutation.providerOperation.reason})
        :mutation.kind.endsWith('_UPSERT')
          ?await executeUpsert(context,mutation)
          :mutation.kind.endsWith('_DELETE')
            ?await executeDelete(context,mutation)
            :await executeSequence(context,mutation);
      const applied=operationRecord(mutation,'APPLIED',{
        providerOperation:result.path,providerReceipt:result.receipt,readback:result.readback,readbackAt:new Date().toISOString(),
      });
      await input.storage.put(key,applied);lastOperation=applied;
    }catch(error){
      const rejected=Boolean(record(error).providerRejected);
      const failed=operationRecord(mutation,rejected?'REJECTED':'UNKNOWN',{
        providerOperation:null,error:error instanceof Error?error.message:'KEETA_PROVIDER_MUTATION_FAILED',
      });
      await input.storage.put(key,failed);lastOperation=failed;break;
    }
  }

  await refreshSequenceStates(input.storage,input.plan);
  const providerAppliedSeq=await contiguousAppliedSeq(input.storage,currentApplied,input.plan.sourceToSeq);
  const state=providerAppliedSeq===input.plan.headSeq?'APPLIED':String(lastOperation?.state||'PENDING') as KeetaProviderMutationState;
  const lastOperationSummary=lastOperation?Object.freeze({
    operationId:lastOperation.operationId,kind:lastOperation.kind,entityId:lastOperation.entityId,
    state:lastOperation.state,providerOperation:lastOperation.providerOperation??null,
  }):null;
  const status=Object.freeze({
    schema:'MFK_KEETA_PROVIDER_STATUS_V1',headSeq:input.plan.headSeq,providerAppliedSeq,
    behindCount:Math.max(0,input.plan.headSeq-providerAppliedSeq),lastOperation:lastOperationSummary,taskId:null,state,
    observedAt:new Date().toISOString(),error:lastOperation?.error??null,
  });
  await input.storage.put(KEETA_PROVIDER_STATUS_KEY,status);
  return status;
}
