export interface CapacityPoolDefinitionV1{
  readonly id:string;
  readonly name:string;
  readonly active:boolean;
  readonly initialQty:number;
  readonly productIds:readonly string[];
  readonly firstPartyStopAt:number;
  readonly thirdPartyStopAt:number;
  readonly note:string;
}

export interface CapacityPoolConfigV1{
  readonly dailyLimit:string;
  readonly warningAt:number;
  readonly hardStop:boolean;
  readonly note:string;
  readonly pools:readonly CapacityPoolDefinitionV1[];
}

function record(value:unknown):Record<string,unknown>{
  return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
}
function cleanText(value:unknown){return typeof value==='string'?value.trim():'';}
function whole(value:unknown,fallback=0){
  const n=Number(value);
  return Number.isFinite(n)?Math.max(0,Math.floor(n)):fallback;
}
function uniqueStrings(value:unknown){
  if(!Array.isArray(value))return [] as string[];
  const out:string[]=[];
  for(const raw of value){
    const item=String(raw??'').trim();
    if(item&&!out.includes(item))out.push(item);
  }
  return out;
}

export function normalizeCapacityPool(value:unknown):CapacityPoolDefinitionV1{
  const row=record(value);
  return Object.freeze({
    id:cleanText(row.id),
    name:cleanText(row.name),
    active:row.active===true,
    initialQty:whole(row.initialQty),
    productIds:Object.freeze(uniqueStrings(row.productIds)),
    firstPartyStopAt:whole(row.firstPartyStopAt),
    thirdPartyStopAt:whole(row.thirdPartyStopAt),
    note:cleanText(row.note),
  });
}

export function capacityPoolCanActivate(pool:CapacityPoolDefinitionV1){
  if(!pool.id||!pool.name||!pool.productIds.length)return false;
  if(!Number.isSafeInteger(pool.initialQty)||pool.initialQty<0)return false;
  if(!Number.isSafeInteger(pool.firstPartyStopAt)||pool.firstPartyStopAt<0||pool.firstPartyStopAt>pool.initialQty)return false;
  if(!Number.isSafeInteger(pool.thirdPartyStopAt)||pool.thirdPartyStopAt<0||pool.thirdPartyStopAt>pool.initialQty)return false;
  return true;
}

export function normalizeCapacityPoolConfig(value:unknown):CapacityPoolConfigV1{
  const row=record(value);
  const warning=Math.min(100,Math.max(1,whole(row.warningAt,80)||80));
  const pools=(Array.isArray(row.pools)?row.pools:[]).map(normalizeCapacityPool);
  return Object.freeze({
    dailyLimit:cleanText(row.dailyLimit),
    warningAt:warning,
    hardStop:row.hardStop===true,
    note:cleanText(row.note),
    pools:Object.freeze(pools),
  });
}

export function nextCapacityPoolId(existing:readonly {readonly id:string}[]){
  const used=new Set(existing.map(row=>String(row.id||'').trim()));
  for(let index=1;index<10000;index++){
    const id='CAP'+String(index).padStart(2,'0');
    if(!used.has(id))return id;
  }
  throw new Error('CAPACITY_POOL_ID_EXHAUSTED');
}
