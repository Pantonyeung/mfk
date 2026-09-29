import {keetaSpuOpenItemCode} from './keeta-menu-projection.ts';

const record=(value:unknown)=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:null;
const array=(value:unknown)=>Array.isArray(value)?value:[];
const text=(value:unknown)=>typeof value==='string'?value.trim():'';
const hhmm=(value:unknown)=>{
  const match=/^(\d{2}):(\d{2})$/.exec(text(value));
  if(!match)throw new Error('KEETA_STORE_TIME_INVALID:'+String(value??''));
  const h=Number(match[1]),m=Number(match[2]);
  if(h>23||m>59)throw new Error('KEETA_STORE_TIME_INVALID:'+String(value??''));
  return (h*60+m)*60;
};

export interface KeetaSellabilityProjection{
  readonly enabled:boolean;
  readonly available:readonly string[];
  readonly unavailable:readonly string[];
  readonly total:number;
}
export function buildKeetaSellabilityProjection(snapshot:unknown):KeetaSellabilityProjection{
  const root=record(snapshot);if(!root)throw new Error('KEETA_SELLABILITY_ADMIN_SNAPSHOT_REQUIRED');
  const policy=record(root.channelPolicy);
  const catalog=record(root.catalog);
  if(!catalog)throw new Error('KEETA_SELLABILITY_CATALOG_REQUIRED');
  const availability=record(root.availability)??{};
  const products=array(catalog.products).map(record).filter(Boolean) as Record<string,unknown>[];
  const available:string[]=[];
  const unavailable:string[]=[];
  for(const product of products){
    if(product.active===false)continue;
    const id=text(product.id);
    const code=text(product.productCode)||id;
    if(!id||!code)throw new Error('KEETA_SELLABILITY_PRODUCT_ID_REQUIRED');
    const openItemCode=keetaSpuOpenItemCode(code);
    const rule=record(availability[id]);
    if(rule?.sellable===false)unavailable.push(openItemCode);
    else available.push(openItemCode);
  }
  if(available.length+unavailable.length>2000)throw new Error('KEETA_SELLABILITY_SPU_LIMIT_EXCEEDED');
  return Object.freeze({
    enabled:policy?.syncSellability===true,
    available:Object.freeze(available),
    unavailable:Object.freeze(unavailable),
    total:available.length+unavailable.length,
  });
}

const DAY_MAP=Object.freeze([
  ['MON','mon'],['TUE','tue'],['WED','wed'],['THU','thu'],['FRI','fri'],['SAT','sat'],['SUN','sun'],
] as const);

export function buildKeetaWeeklyHoursProjection(snapshot:unknown){
  const root=record(snapshot);if(!root)throw new Error('KEETA_STORE_ADMIN_SNAPSHOT_REQUIRED');
  const settings=record(root.storeSettings);
  const weekly=record(settings?.weeklyHours);
  if(!weekly)throw new Error('KEETA_STORE_WEEKLY_HOURS_REQUIRED');
  const out:Record<string,readonly {startTime:number;endTime:number}[]>={};
  for(const [monday,provider] of DAY_MAP){
    const day=record(weekly[monday]);
    if(!day)throw new Error('KEETA_STORE_WEEKLY_HOURS_'+monday+'_REQUIRED');
    if(day.closed===true){
      out[provider]=Object.freeze([{startTime:0,endTime:0}]);
      continue;
    }
    const startTime=hhmm(day.opensAt),endTime=hhmm(day.closesAt);
    if(endTime<=startTime)throw new Error('KEETA_STORE_HOURS_RANGE_INVALID:'+monday);
    out[provider]=Object.freeze([{startTime,endTime}]);
  }
  return Object.freeze(out);
}

export function chunkKeetaSpuStatus(codes:readonly string[],size=200){
  if(!Number.isSafeInteger(size)||size<=0||size>200)throw new Error('KEETA_SELLABILITY_BATCH_SIZE_INVALID');
  const chunks:readonly string[][]=[];
  const mutable:string[][]=[];
  for(let index=0;index<codes.length;index+=size)mutable.push(codes.slice(index,index+size));
  return Object.freeze(mutable.map(row=>Object.freeze(row)));
}
