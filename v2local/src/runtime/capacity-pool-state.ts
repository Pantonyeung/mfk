import {capacityPoolCanActivate,type CapacityPoolDefinitionV1} from '../../../contracts/capacity-pool-v1.ts';
import {readBusinessCutoff} from './cash-opening.ts';
import {readSmtCapacityConfig} from './admin-operational-config.ts';
import {resolveBusinessWindow} from './local-operations.ts';

export const LOCAL_CAPACITY_POOL_STATE_KEY='mfk.v2local.capacity-pools.v1';

export interface LocalCapacityPoolStateRow{
  readonly businessDate:string;
  readonly poolId:string;
  readonly initialQtyAtOpen:number;
  readonly remainingQty:number;
  readonly createdAt:number;
  readonly updatedAt:number;
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
function capacityBusinessDate(now:number){
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

export function ensureCurrentCapacityPoolState(
  now=Date.now(),
  storage:Pick<Storage,'getItem'|'setItem'>=localStorage,
):SmtCapacityPoolStateView{
  const businessDate=capacityBusinessDate(now);
  const existing=readLocalCapacityPoolRows(storage);
  const byKey=new Map(existing.map(row=>[row.businessDate+'::'+row.poolId,row] as const));
  const {valid,invalid}=activePoolConfig();
  const created:LocalCapacityPoolStateRow[]=[];
  const current=valid.map(pool=>{
    const key=businessDate+'::'+pool.id;
    let row=byKey.get(key);
    if(!row){
      row=Object.freeze({
        businessDate,
        poolId:pool.id,
        initialQtyAtOpen:pool.initialQty,
        remainingQty:pool.initialQty,
        createdAt:now,
        updatedAt:now,
      });
      created.push(row);
      byKey.set(key,row);
    }
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
      note:pool.note,
    });
  });
  if(created.length)writeLocalCapacityPoolRows([...existing,...created],storage);
  return Object.freeze({
    businessDate,
    pools:Object.freeze(current),
    invalidActivePoolIds:Object.freeze(invalid),
  });
}
