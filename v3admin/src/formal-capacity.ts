import {
  capacityPoolCanActivate,
  nextCapacityPoolId,
  normalizeCapacityPool,
  normalizeCapacityPoolConfig,
  type CapacityPoolConfigV1,
  type CapacityPoolDefinitionV1,
} from '../../contracts/capacity-pool-v1.ts';

function row(value:unknown):Record<string,unknown>{
  return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
}

export function readFormalCapacity(snapshot:Record<string,unknown>):CapacityPoolConfigV1{
  return normalizeCapacityPoolConfig(snapshot.capacity);
}

export function writeFormalCapacity(snapshot:Record<string,unknown>,config:CapacityPoolConfigV1){
  const current=row(snapshot.capacity);
  return{
    ...snapshot,
    capacity:{
      ...current,
      dailyLimit:config.dailyLimit,
      warningAt:config.warningAt,
      hardStop:config.hardStop,
      note:config.note,
      pools:config.pools.map(pool=>({...pool,productIds:[...pool.productIds]})),
    },
  };
}

export function patchFormalCapacityConfig(snapshot:Record<string,unknown>,patch:Partial<Omit<CapacityPoolConfigV1,'pools'>>){
  const current=readFormalCapacity(snapshot);
  return writeFormalCapacity(snapshot,{...current,...patch});
}

export function addFormalCapacityPool(snapshot:Record<string,unknown>){
  const current=readFormalCapacity(snapshot);
  const id=nextCapacityPoolId(current.pools);
  const pool=normalizeCapacityPool({id,name:'',active:false,initialQty:0,productIds:[],firstPartyStopAt:0,thirdPartyStopAt:0,note:''});
  return {snapshot:writeFormalCapacity(snapshot,{...current,pools:[...current.pools,pool]}),poolId:id};
}

export function replaceFormalCapacityPool(snapshot:Record<string,unknown>,pool:CapacityPoolDefinitionV1){
  const current=readFormalCapacity(snapshot);
  if(!current.pools.some(item=>item.id===pool.id))throw new Error('FORMAL_CAPACITY_POOL_NOT_FOUND');
  const normalized=normalizeCapacityPool(pool);
  if(normalized.active&&!capacityPoolCanActivate(normalized))throw new Error('FORMAL_CAPACITY_POOL_INVALID');
  return writeFormalCapacity(snapshot,{...current,pools:current.pools.map(item=>item.id===pool.id?normalized:item)});
}

export function removeFormalCapacityPool(snapshot:Record<string,unknown>,poolId:string){
  const current=readFormalCapacity(snapshot);
  return writeFormalCapacity(snapshot,{...current,pools:current.pools.filter(pool=>pool.id!==poolId)});
}

export function validateFormalCapacity(snapshot:Record<string,unknown>){
  const config=readFormalCapacity(snapshot);
  const errors:string[]=[];
  const ids=new Set<string>();
  for(const pool of config.pools){
    if(ids.has(pool.id))errors.push('產能 Pool ID 重複：'+pool.id);else ids.add(pool.id);
    if(pool.active&&!capacityPoolCanActivate(pool))errors.push('產能 Pool '+(pool.name||pool.id)+' 未符合啟用條件');
  }
  return errors;
}

export const FORMAL_CAPACITY_RUNTIME_GAP=Object.freeze({
  configAuthority:'ADMIN_FORMAL_DRAFT',
  runtimeAuthority:'SMT',
  status:'SMT_RUNTIME_SEAM_REQUIRED',
  missing:'扣減、回補、Override、自家/第三方停售門檻執行與 readback',
});
