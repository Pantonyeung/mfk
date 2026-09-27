import {capacityPoolCanActivate,type CapacityPoolDefinitionV1} from '../../../contracts/capacity-pool-v1.ts';
import {readBusinessCutoff} from './cash-opening.ts';
import {readSmtCapacityConfig} from './admin-operational-config.ts';
import {resolveBusinessWindow} from './local-operations.ts';

export const LOCAL_CAPACITY_POOL_STATE_KEY='mfk.v2local.capacity-pools.v1';

export interface CapacityPoolOrderEvent{
  readonly id:string;
  readonly kind:'DEDUCT'|'RESTORE';
  readonly orderId:string;
  readonly admissionId:string;
  readonly businessDate:string;
  readonly poolId:string;
  readonly quantity:number;
  readonly createdAt:string;
  readonly sourceEventId?:string;
  readonly overrideAllocations?:readonly {readonly overrideId:string;readonly quantity:number}[];
}

export type CapacityOverrideScope='FIRST_PARTY'|'THIRD_PARTY'|'ALL_REMOTE';

export interface LocalCapacityOverrideApproval{
  readonly id:string;
  readonly submissionId:string;
  readonly requestSignature:string;
  readonly businessDate:string;
  readonly poolId:string;
  readonly scope:CapacityOverrideScope;
  readonly approvedQty:number;
  readonly remainingAllowance:number;
  readonly createdAt:number;
  readonly fromQty:number;
  readonly toQty:number;
  readonly staffId?:string;
  readonly staffName?:string;
  readonly note:string;
}

export interface LocalCapacityManualAdjustment{
  readonly id:string;
  readonly businessDate:string;
  readonly poolId:string;
  readonly createdAt:number;
  readonly fromQty:number;
  readonly toQty:number;
  readonly staffId?:string;
  readonly staffName?:string;
  readonly note:string;
}

export interface LocalCapacityPoolStateRow{
  readonly businessDate:string;
  readonly poolId:string;
  readonly initialQtyAtOpen:number;
  readonly remainingQty:number;
  readonly createdAt:number;
  readonly updatedAt:number;
  readonly appliedEventIds?:readonly string[];
  readonly manualAdjustments?:readonly LocalCapacityManualAdjustment[];
  readonly overrides?:readonly LocalCapacityOverrideApproval[];
}

export interface SmtCapacityPoolStateViewRow{
  readonly poolId:string;
  readonly name:string;
  readonly businessDate:string;
  readonly initialQtyAtOpen:number;
  readonly configuredInitialQty:number;
  readonly remainingQty:number;
  readonly productIds:readonly string[];
  readonly firstPartyStopAt:number;
  readonly thirdPartyStopAt:number;
  readonly firstPartyAccepting:boolean;
  readonly thirdPartyAccepting:boolean;
  readonly firstPartyOverrideRemaining:number;
  readonly thirdPartyOverrideRemaining:number;
  readonly activeOverrideCount:number;
  readonly note:string;
}

export interface SmtCapacityPoolStateView{
  readonly businessDate:string;
  readonly pools:readonly SmtCapacityPoolStateViewRow[];
  readonly invalidActivePoolIds:readonly string[];
}

function whole(value:unknown){
  const n=Number(value);
  if(!Number.isSafeInteger(n)||n<0)throw new Error('CAPACITY_POOL_STATE_INVALID');
  return n;
}
function eventIds(value:unknown){
  if(!Array.isArray(value))return Object.freeze([] as string[]);
  return Object.freeze([...new Set(value.map(item=>String(item||'').trim()).filter(Boolean))]);
}
function parseOverride(value:unknown):LocalCapacityOverrideApproval{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('CAPACITY_OVERRIDE_INVALID');
  const row=value as Record<string,unknown>;
  const id=String(row.id??'').trim();
  const submissionId=String(row.submissionId??'').trim();
  const requestSignature=String(row.requestSignature??'').trim();
  const businessDate=String(row.businessDate??'').trim();
  const poolId=String(row.poolId??'').trim();
  const scope=row.scope;
  const approvedQty=Number(row.approvedQty);
  const remainingAllowance=Number(row.remainingAllowance);
  const createdAt=Number(row.createdAt);
  const fromQty=Number(row.fromQty);
  const toQty=Number(row.toQty);
  const note=String(row.note??'').trim();
  if(!id||!submissionId||!requestSignature||!poolId||!/^\d{4}-\d{2}-\d{2}$/.test(businessDate)||
     !['FIRST_PARTY','THIRD_PARTY','ALL_REMOTE'].includes(String(scope))||
     !Number.isSafeInteger(approvedQty)||approvedQty<=0||
     !Number.isSafeInteger(remainingAllowance)||remainingAllowance<0||remainingAllowance>approvedQty||
     !Number.isFinite(createdAt)||!Number.isSafeInteger(fromQty)||fromQty<0||
     !Number.isSafeInteger(toQty)||toQty<fromQty){
    throw new Error('CAPACITY_OVERRIDE_INVALID');
  }
  const staffId=String(row.staffId??'').trim();
  const staffName=String(row.staffName??'').trim();
  return Object.freeze({
    id,submissionId,requestSignature,businessDate,poolId,
    scope:scope as CapacityOverrideScope,approvedQty,remainingAllowance,createdAt,fromQty,toQty,note,
    ...(staffId?{staffId}:{}),
    ...(staffName?{staffName}:{}),
  });
}
function overrides(value:unknown){
  if(!Array.isArray(value))return Object.freeze([] as LocalCapacityOverrideApproval[]);
  return Object.freeze(value.map(parseOverride));
}
function parseManualAdjustment(value:unknown):LocalCapacityManualAdjustment{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('CAPACITY_MANUAL_ADJUSTMENT_INVALID');
  const row=value as Record<string,unknown>;
  const id=String(row.id??'').trim();
  const businessDate=String(row.businessDate??'').trim();
  const poolId=String(row.poolId??'').trim();
  const createdAt=Number(row.createdAt);
  const fromQty=Number(row.fromQty);
  const toQty=Number(row.toQty);
  const note=String(row.note??'').trim();
  if(!id||!poolId||!/^\d{4}-\d{2}-\d{2}$/.test(businessDate)||!Number.isFinite(createdAt)||
     !Number.isSafeInteger(fromQty)||fromQty<0||!Number.isSafeInteger(toQty)||toQty<0){
    throw new Error('CAPACITY_MANUAL_ADJUSTMENT_INVALID');
  }
  const staffId=String(row.staffId??'').trim();
  const staffName=String(row.staffName??'').trim();
  return Object.freeze({
    id,businessDate,poolId,createdAt,fromQty,toQty,note,
    ...(staffId?{staffId}:{}),
    ...(staffName?{staffName}:{}),
  });
}
function manualAdjustments(value:unknown){
  if(!Array.isArray(value))return Object.freeze([] as LocalCapacityManualAdjustment[]);
  return Object.freeze(value.map(parseManualAdjustment));
}
function parseEvent(value:unknown):CapacityPoolOrderEvent{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('CAPACITY_POOL_EVENT_INVALID');
  const row=value as Record<string,unknown>;
  const kind=row.kind;
  const id=String(row.id??'').trim();
  const orderId=String(row.orderId??'').trim();
  const admissionId=String(row.admissionId??'').trim();
  const businessDate=String(row.businessDate??'').trim();
  const poolId=String(row.poolId??'').trim();
  const createdAt=String(row.createdAt??'').trim();
  const quantity=Number(row.quantity);
  if((kind!=='DEDUCT'&&kind!=='RESTORE')||!id||!orderId||!admissionId||!poolId||
     !/^\d{4}-\d{2}-\d{2}$/.test(businessDate)||!Number.isSafeInteger(quantity)||quantity<=0||
     !Number.isFinite(Date.parse(createdAt))){
    throw new Error('CAPACITY_POOL_EVENT_INVALID');
  }
  const sourceEventId=String(row.sourceEventId??'').trim();
  const rawAllocations=Array.isArray(row.overrideAllocations)?row.overrideAllocations:[];
  const overrideAllocations=rawAllocations.map(raw=>{
    if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('CAPACITY_POOL_EVENT_INVALID');
    const item=raw as Record<string,unknown>;
    const overrideId=String(item.overrideId??'').trim();
    const allocated=Number(item.quantity);
    if(!overrideId||!Number.isSafeInteger(allocated)||allocated<=0)throw new Error('CAPACITY_POOL_EVENT_INVALID');
    return Object.freeze({overrideId,quantity:allocated});
  });
  if(overrideAllocations.reduce((sum,item)=>sum+item.quantity,0)>quantity)throw new Error('CAPACITY_POOL_EVENT_INVALID');
  return Object.freeze({
    id,kind,orderId,admissionId,businessDate,poolId,quantity,createdAt,
    ...(sourceEventId?{sourceEventId}:{}),
    ...(overrideAllocations.length?{overrideAllocations:Object.freeze(overrideAllocations)}:{}),
  });
}
function parseRow(value:unknown):LocalCapacityPoolStateRow{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('CAPACITY_POOL_STATE_INVALID');
  const row=value as Record<string,unknown>;
  const businessDate=String(row.businessDate??'').trim();
  const poolId=String(row.poolId??'').trim();
  const createdAt=Number(row.createdAt);
  const updatedAt=Number(row.updatedAt);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(businessDate)||!poolId||!Number.isFinite(createdAt)||!Number.isFinite(updatedAt)){
    throw new Error('CAPACITY_POOL_STATE_INVALID');
  }
  return Object.freeze({
    businessDate,
    poolId,
    initialQtyAtOpen:whole(row.initialQtyAtOpen),
    remainingQty:whole(row.remainingQty),
    createdAt,
    updatedAt,
    appliedEventIds:eventIds(row.appliedEventIds),
    manualAdjustments:manualAdjustments(row.manualAdjustments),
    overrides:overrides(row.overrides),
  });
}
function assertUnique(rows:readonly LocalCapacityPoolStateRow[]){
  const seen=new Set<string>();
  for(const row of rows){
    const key=row.businessDate+'::'+row.poolId;
    if(seen.has(key))throw new Error('CAPACITY_POOL_STATE_DUPLICATE');
    seen.add(key);
  }
}
export function capacityBusinessDate(now:number){
  const cutoff=readBusinessCutoff();
  return resolveBusinessWindow(now,cutoff.hour,cutoff.minute).businessDate;
}
function activePoolConfig(){
  const pools=readSmtCapacityConfig().pools;
  const seen=new Set<string>();
  const valid:CapacityPoolDefinitionV1[]=[];
  const invalid:string[]=[];
  for(const pool of pools){
    if(!pool.active)continue;
    if(seen.has(pool.id))throw new Error('CAPACITY_POOL_CONFIG_DUPLICATE_ID');
    seen.add(pool.id);
    if(!capacityPoolCanActivate(pool)){invalid.push(pool.id||'UNKNOWN');continue;}
    valid.push(pool);
  }
  return {valid,invalid};
}

export function readLocalCapacityPoolRows(storage:Pick<Storage,'getItem'>=localStorage):LocalCapacityPoolStateRow[]{
  const raw=storage.getItem(LOCAL_CAPACITY_POOL_STATE_KEY);
  if(raw===null)return [];
  let value:unknown;
  try{value=JSON.parse(raw);}catch{throw new Error('CAPACITY_POOL_STATE_INVALID');}
  if(!Array.isArray(value))throw new Error('CAPACITY_POOL_STATE_INVALID');
  const rows=value.map(parseRow);
  assertUnique(rows);
  return rows;
}

export function writeLocalCapacityPoolRows(
  rows:readonly LocalCapacityPoolStateRow[],
  storage:Pick<Storage,'setItem'>=localStorage,
){
  const normalized=rows.map(parseRow);
  assertUnique(normalized);
  storage.setItem(LOCAL_CAPACITY_POOL_STATE_KEY,JSON.stringify(normalized));
}

function normalizeEvents(events:readonly CapacityPoolOrderEvent[]){
  const normalized=events.map(parseEvent);
  const seen=new Set<string>();
  for(const event of normalized){
    if(seen.has(event.id))throw new Error('CAPACITY_POOL_EVENT_DUPLICATE');
    seen.add(event.id);
  }
  return normalized;
}
function applyPendingEvents(
  rows:readonly LocalCapacityPoolStateRow[],
  events:readonly CapacityPoolOrderEvent[],
){
  let changed=false;
  const next=rows.map(row=>{
    const applied=new Set(row.appliedEventIds??[]);
    const pending=events
      .filter(event=>event.businessDate===row.businessDate&&event.poolId===row.poolId&&!applied.has(event.id))
      .sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));
    if(!pending.length)return row;
    let remaining=row.remainingQty;
    let updatedAt=row.updatedAt;
    let currentOverrides=[...(row.overrides??[])];
    for(const event of pending){
      if(event.kind==='DEDUCT'){
        if(event.quantity>remaining)throw new Error('CAPACITY_POOL_PROJECTION_UNDERFLOW:'+row.poolId);
        remaining-=event.quantity;
        for(const allocation of event.overrideAllocations??[]){
          const index=currentOverrides.findIndex(approval=>approval.id===allocation.overrideId);
          if(index<0)throw new Error('CAPACITY_OVERRIDE_LEDGER_MISMATCH:'+row.poolId);
          const approval=currentOverrides[index]!;
          if(allocation.quantity>approval.remainingAllowance)throw new Error('CAPACITY_OVERRIDE_LEDGER_MISMATCH:'+row.poolId);
          currentOverrides[index]=Object.freeze({...approval,remainingAllowance:approval.remainingAllowance-allocation.quantity});
        }
      }else{
        remaining+=event.quantity;
      }
      applied.add(event.id);
      updatedAt=Math.max(updatedAt,Date.parse(event.createdAt));
    }
    changed=true;
    return Object.freeze({
      ...row,
      remainingQty:remaining,
      updatedAt,
      appliedEventIds:Object.freeze([...applied]),
      overrides:Object.freeze(currentOverrides),
    });
  });
  return {rows:next,changed};
}

function scopeMatches(scope:CapacityOverrideScope,channel:'FIRST_PARTY'|'THIRD_PARTY'){
  return scope==='ALL_REMOTE'||scope===channel;
}
function overrideAllowance(row:LocalCapacityPoolStateRow,channel:'FIRST_PARTY'|'THIRD_PARTY'){
  return (row.overrides??[])
    .filter(approval=>scopeMatches(approval.scope,channel))
    .reduce((sum,approval)=>sum+approval.remainingAllowance,0);
}
function planOverrideAllocations(
  row:LocalCapacityPoolStateRow,
  channel:'FIRST_PARTY'|'THIRD_PARTY',
  quantity:number,
){
  let needed=quantity;
  const allocations:{overrideId:string;quantity:number}[]=[];
  const candidates=[...(row.overrides??[])]
    .filter(approval=>scopeMatches(approval.scope,channel)&&approval.remainingAllowance>0)
    .sort((a,b)=>a.createdAt-b.createdAt||a.id.localeCompare(b.id));
  for(const approval of candidates){
    if(needed<=0)break;
    const used=Math.min(needed,approval.remainingAllowance);
    if(used>0){allocations.push({overrideId:approval.id,quantity:used});needed-=used;}
  }
  if(needed>0)throw new Error('CAPACITY_OVERRIDE_INSUFFICIENT:'+channel+':'+row.poolId);
  return Object.freeze(allocations.map(item=>Object.freeze(item)));
}

export function ensureCurrentCapacityPoolState(
  now=Date.now(),
  storage:Pick<Storage,'getItem'|'setItem'>=localStorage,
  orderEvents:readonly CapacityPoolOrderEvent[]=[],
):SmtCapacityPoolStateView{
  const businessDate=capacityBusinessDate(now);
  const events=normalizeEvents(orderEvents);
  const existing=readLocalCapacityPoolRows(storage);
  const reconciled=applyPendingEvents(existing,events);
  const baseRows=reconciled.rows;
  const byKey=new Map(baseRows.map(row=>[row.businessDate+'::'+row.poolId,row] as const));
  const {valid,invalid}=activePoolConfig();
  const created:LocalCapacityPoolStateRow[]=[];
  for(const pool of valid){
    const key=businessDate+'::'+pool.id;
    if(byKey.has(key))continue;
    const row:LocalCapacityPoolStateRow=Object.freeze({
      businessDate,
      poolId:pool.id,
      initialQtyAtOpen:pool.initialQty,
      remainingQty:pool.initialQty,
      createdAt:now,
      updatedAt:now,
      appliedEventIds:Object.freeze([]),
    });
    created.push(row);
    byKey.set(key,row);
  }
  const afterCreate=created.length?applyPendingEvents([...baseRows,...created],events):{rows:baseRows,changed:false};
  const finalRows=afterCreate.rows;
  if(reconciled.changed||created.length||afterCreate.changed)writeLocalCapacityPoolRows(finalRows,storage);
  const finalByKey=new Map(finalRows.map(row=>[row.businessDate+'::'+row.poolId,row] as const));
  const current=valid.map(pool=>{
    const row=finalByKey.get(businessDate+'::'+pool.id);
    if(!row)throw new Error('CAPACITY_POOL_STATE_MISSING:'+pool.id);
    const firstPartyOverrideRemaining=Math.min(row.remainingQty,overrideAllowance(row,'FIRST_PARTY'));
    const thirdPartyOverrideRemaining=Math.min(row.remainingQty,overrideAllowance(row,'THIRD_PARTY'));
    return Object.freeze({
      poolId:pool.id,
      name:pool.name,
      businessDate,
      initialQtyAtOpen:row.initialQtyAtOpen,
      configuredInitialQty:pool.initialQty,
      remainingQty:row.remainingQty,
      productIds:Object.freeze([...pool.productIds]),
      firstPartyStopAt:pool.firstPartyStopAt,
      thirdPartyStopAt:pool.thirdPartyStopAt,
      firstPartyAccepting:row.remainingQty>pool.firstPartyStopAt||firstPartyOverrideRemaining>0,
      thirdPartyAccepting:row.remainingQty>pool.thirdPartyStopAt||thirdPartyOverrideRemaining>0,
      firstPartyOverrideRemaining,
      thirdPartyOverrideRemaining,
      activeOverrideCount:(row.overrides??[]).filter(approval=>approval.remainingAllowance>0).length,
      note:pool.note,
    });
  });
  return Object.freeze({
    businessDate,
    pools:Object.freeze(current),
    invalidActivePoolIds:Object.freeze(invalid),
  });
}


function demandedQuantity(items:readonly {readonly id:string;readonly qty:number}[],productIds:readonly string[]){
  const linked=new Set(productIds);
  return items.reduce((sum,item)=>{
    const qty=Number(item.qty);
    if(!linked.has(String(item.id))||!Number.isSafeInteger(qty)||qty<=0)return sum;
    return sum+qty;
  },0);
}

export function planCapacityDeductionEvents(input:{
  readonly orderId:string;
  readonly admissionId:string;
  readonly items:readonly {readonly id:string;readonly qty:number}[];
  readonly existingEvents:readonly CapacityPoolOrderEvent[];
  readonly channel?:CapacityRemoteChannel;
  readonly now?:number;
  readonly storage?:Pick<Storage,'getItem'|'setItem'>;
}):readonly CapacityPoolOrderEvent[]{
  const orderId=String(input.orderId||'').trim();
  const admissionId=String(input.admissionId||'').trim();
  if(!orderId||!admissionId)throw new Error('CAPACITY_ADMISSION_ID_REQUIRED');
  const now=input.now??Date.now();
  const storage=input.storage??localStorage;
  const existing=normalizeEvents(input.existingEvents);
  const config=readSmtCapacityConfig();
  for(const pool of config.pools){
    if(!pool.active||capacityPoolCanActivate(pool))continue;
    if(demandedQuantity(input.items,pool.productIds)>0)throw new Error('CAPACITY_POOL_CONFIG_INVALID:'+(pool.id||'UNKNOWN'));
  }
  const view=ensureCurrentCapacityPoolState(now,storage,existing);
  const events:CapacityPoolOrderEvent[]=[];
  for(const pool of config.pools){
    if(!pool.active||!capacityPoolCanActivate(pool))continue;
    const quantity=demandedQuantity(input.items,pool.productIds);
    if(quantity<=0)continue;
    const prior=existing.find(event=>
      event.kind==='DEDUCT'&&event.orderId===orderId&&event.admissionId===admissionId&&event.poolId===pool.id
    );
    if(prior)continue;
    const state=view.pools.find(row=>row.poolId===pool.id);
    if(!state)throw new Error('CAPACITY_POOL_STATE_MISSING:'+pool.id);
    if(quantity>state.remainingQty)throw new Error('CAPACITY_POOL_INSUFFICIENT:'+pool.id);
    let overrideAllocations:readonly {overrideId:string;quantity:number}[]|undefined;
    if(input.channel){
      const threshold=input.channel==='FIRST_PARTY'?pool.firstPartyStopAt:pool.thirdPartyStopAt;
      if(state.remainingQty<=threshold){
        const rows=readLocalCapacityPoolRows(storage);
        const stateRow=rows.find(row=>row.businessDate===view.businessDate&&row.poolId===pool.id);
        if(!stateRow)throw new Error('CAPACITY_POOL_STATE_MISSING:'+pool.id);
        overrideAllocations=planOverrideAllocations(stateRow,input.channel,quantity);
      }
    }
    events.push(Object.freeze({
      id:['CAPD',view.businessDate,orderId,admissionId,pool.id].join(':'),
      kind:'DEDUCT' as const,
      orderId,
      admissionId,
      businessDate:view.businessDate,
      poolId:pool.id,
      quantity,
      createdAt:new Date(now).toISOString(),
      ...(overrideAllocations?.length?{overrideAllocations}:{}),
    }));
  }
  return Object.freeze(events);
}

export function planCapacityRestoreEvents(input:{
  readonly orderId:string;
  readonly existingEvents:readonly CapacityPoolOrderEvent[];
  readonly now?:number;
}):readonly CapacityPoolOrderEvent[]{
  const orderId=String(input.orderId||'').trim();
  if(!orderId)throw new Error('CAPACITY_RESTORE_ORDER_ID_REQUIRED');
  const now=input.now??Date.now();
  const existing=normalizeEvents(input.existingEvents);
  const restoredSources=new Set(existing.filter(event=>event.kind==='RESTORE').map(event=>event.sourceEventId).filter(Boolean));
  const events=existing
    .filter(event=>event.kind==='DEDUCT'&&event.orderId===orderId&&!restoredSources.has(event.id))
    .map(deduction=>Object.freeze({
      id:'CAPR:'+deduction.id,
      kind:'RESTORE' as const,
      orderId,
      admissionId:'CANCEL',
      businessDate:deduction.businessDate,
      poolId:deduction.poolId,
      quantity:deduction.quantity,
      createdAt:new Date(now).toISOString(),
      sourceEventId:deduction.id,
    }));
  return Object.freeze(events);
}


export function applyManualCapacityCorrection(
  input:{
    readonly poolId:string;
    readonly remainingQty:number;
    readonly note?:string;
    readonly now?:number;
    readonly staffId?:string;
    readonly staffName?:string;
    readonly orderEvents?:readonly CapacityPoolOrderEvent[];
  },
  storage:Pick<Storage,'getItem'|'setItem'>=localStorage,
):SmtCapacityPoolStateView{
  const poolId=String(input.poolId||'').trim();
  const remainingQty=Number(input.remainingQty);
  if(!poolId)throw new Error('CAPACITY_POOL_ID_REQUIRED');
  if(!Number.isSafeInteger(remainingQty)||remainingQty<0)throw new Error('CAPACITY_MANUAL_QUANTITY_INVALID');
  const now=input.now??Date.now();
  const events=input.orderEvents??[];
  const view=ensureCurrentCapacityPoolState(now,storage,events);
  if(!view.pools.some(pool=>pool.poolId===poolId))throw new Error('CAPACITY_POOL_NOT_ACTIVE');

  const rows=readLocalCapacityPoolRows(storage);
  const index=rows.findIndex(row=>row.businessDate===view.businessDate&&row.poolId===poolId);
  if(index<0)throw new Error('CAPACITY_POOL_STATE_MISSING:'+poolId);
  const current=rows[index]!;
  if(current.remainingQty===remainingQty)return view;

  const history=current.manualAdjustments??[];
  const adjustment:LocalCapacityManualAdjustment=Object.freeze({
    id:['CAPADJ',view.businessDate,poolId,String(now),String(history.length+1)].join(':'),
    businessDate:view.businessDate,
    poolId,
    createdAt:now,
    fromQty:current.remainingQty,
    toQty:remainingQty,
    ...(String(input.staffId||'').trim()?{staffId:String(input.staffId).trim()}:{}),
    ...(String(input.staffName||'').trim()?{staffName:String(input.staffName).trim()}:{}),
    note:String(input.note||'').trim(),
  });
  const updated:LocalCapacityPoolStateRow=Object.freeze({
    ...current,
    remainingQty,
    updatedAt:now,
    manualAdjustments:Object.freeze([...history,adjustment]),
  });
  writeLocalCapacityPoolRows(rows.map((row,rowIndex)=>rowIndex===index?updated:row),storage);
  return ensureCurrentCapacityPoolState(now,storage,events);
}


export function applyCapacityOverrideApproval(
  input:{
    readonly poolId:string;
    readonly submissionId:string;
    readonly scope:CapacityOverrideScope;
    readonly quantity:number;
    readonly note?:string;
    readonly now?:number;
    readonly staffId?:string;
    readonly staffName?:string;
    readonly orderEvents?:readonly CapacityPoolOrderEvent[];
  },
  storage:Pick<Storage,'getItem'|'setItem'>=localStorage,
):SmtCapacityPoolStateView{
  const poolId=String(input.poolId||'').trim();
  const submissionId=String(input.submissionId||'').trim();
  const scope=input.scope;
  const quantity=Number(input.quantity);
  const note=String(input.note||'').trim();
  if(!poolId)throw new Error('CAPACITY_POOL_ID_REQUIRED');
  if(!submissionId||submissionId.length>200)throw new Error('CAPACITY_OVERRIDE_SUBMISSION_REQUIRED');
  if(!['FIRST_PARTY','THIRD_PARTY','ALL_REMOTE'].includes(scope))throw new Error('CAPACITY_OVERRIDE_SCOPE_INVALID');
  if(!Number.isSafeInteger(quantity)||quantity<=0)throw new Error('CAPACITY_OVERRIDE_QUANTITY_INVALID');

  const now=input.now??Date.now();
  const events=input.orderEvents??[];
  const view=ensureCurrentCapacityPoolState(now,storage,events);
  if(!view.pools.some(pool=>pool.poolId===poolId))throw new Error('CAPACITY_POOL_NOT_ACTIVE');

  const rows=readLocalCapacityPoolRows(storage);
  const allApprovals=rows.flatMap(row=>row.overrides??[]);
  const requestSignature=JSON.stringify([view.businessDate,poolId,scope,quantity,note]);
  const prior=allApprovals.find(approval=>approval.submissionId===submissionId);
  if(prior){
    if(prior.requestSignature!==requestSignature)throw new Error('CAPACITY_OVERRIDE_SUBMISSION_CONFLICT');
    return view;
  }

  const index=rows.findIndex(row=>row.businessDate===view.businessDate&&row.poolId===poolId);
  if(index<0)throw new Error('CAPACITY_POOL_STATE_MISSING:'+poolId);
  const current=rows[index]!;
  const toQty=current.remainingQty+quantity;
  if(!Number.isSafeInteger(toQty))throw new Error('CAPACITY_OVERRIDE_QUANTITY_INVALID');
  const approval:LocalCapacityOverrideApproval=Object.freeze({
    id:['CAPOVR',view.businessDate,poolId,submissionId].join(':'),
    submissionId,
    requestSignature,
    businessDate:view.businessDate,
    poolId,
    scope,
    approvedQty:quantity,
    remainingAllowance:quantity,
    createdAt:now,
    fromQty:current.remainingQty,
    toQty,
    ...(String(input.staffId||'').trim()?{staffId:String(input.staffId).trim()}:{}),
    ...(String(input.staffName||'').trim()?{staffName:String(input.staffName).trim()}:{}),
    note,
  });
  const updated:LocalCapacityPoolStateRow=Object.freeze({
    ...current,
    remainingQty:toQty,
    updatedAt:now,
    overrides:Object.freeze([...(current.overrides??[]),approval]),
  });
  writeLocalCapacityPoolRows(rows.map((row,rowIndex)=>rowIndex===index?updated:row),storage);
  return ensureCurrentCapacityPoolState(now,storage,events);
}

export type CapacityRemoteChannel='FIRST_PARTY'|'THIRD_PARTY';

export function assertCapacityChannelAdmission(input:{
  readonly channel:CapacityRemoteChannel;
  readonly items:readonly {readonly id:string;readonly qty:number}[];
  readonly orderEvents?:readonly CapacityPoolOrderEvent[];
  readonly now?:number;
  readonly storage?:Pick<Storage,'getItem'|'setItem'>;
}):SmtCapacityPoolStateView{
  const channel=input.channel;
  if(channel!=='FIRST_PARTY'&&channel!=='THIRD_PARTY')throw new Error('CAPACITY_CHANNEL_INVALID');
  const now=input.now??Date.now();
  const storage=input.storage??localStorage;
  const events=input.orderEvents??[];
  const config=readSmtCapacityConfig();
  for(const pool of config.pools){
    if(!pool.active||capacityPoolCanActivate(pool))continue;
    if(demandedQuantity(input.items,pool.productIds)>0)throw new Error('CAPACITY_POOL_CONFIG_INVALID:'+(pool.id||'UNKNOWN'));
  }
  const view=ensureCurrentCapacityPoolState(now,storage,events);
  for(const pool of view.pools){
    const quantity=demandedQuantity(input.items,pool.productIds);
    if(quantity<=0)continue;
    if(quantity>pool.remainingQty)throw new Error('CAPACITY_POOL_INSUFFICIENT:'+pool.poolId);
    const threshold=channel==='FIRST_PARTY'?pool.firstPartyStopAt:pool.thirdPartyStopAt;
    if(pool.remainingQty<=threshold){
      const allowance=channel==='FIRST_PARTY'?pool.firstPartyOverrideRemaining:pool.thirdPartyOverrideRemaining;
      if(allowance<=0)throw new Error('CAPACITY_CHANNEL_STOP:'+channel+':'+pool.poolId);
      if(quantity>allowance)throw new Error('CAPACITY_OVERRIDE_INSUFFICIENT:'+channel+':'+pool.poolId);
    }
  }
  return view;
}
