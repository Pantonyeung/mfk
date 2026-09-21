export interface LocalReportOrder{
  readonly id:string;
  readonly display:string;
  readonly createdAt:string;
  readonly totalMinor:number;
  readonly paymentLabel:string;
  readonly fulfillmentLabel:string;
  readonly sourceLabel:string;
  readonly items:readonly {readonly id:string;readonly name:string;readonly qty:number;readonly unitMinor:number}[];
}

export interface LocalReport{
  readonly businessDate:string;
  readonly completedOrders:number;
  readonly netSalesMinor:number;
  readonly cashSalesMinor:number;
  readonly itemUnits:number;
  readonly averageOrderMinor:number;
  readonly topProducts:readonly {readonly name:string;readonly quantity:number;readonly salesMinor:number}[];
}

export interface LocalDayClose{
  readonly id:string;
  readonly businessDate:string;
  readonly version:number;
  readonly createdAt:number;
  readonly openingCashMinor:number;
  readonly cashSalesMinor:number;
  readonly expectedCashMinor:number;
  readonly countedCashMinor:number;
  readonly cashDifferenceMinor:number;
  readonly note:string;
}

export interface LocalBackup{
  readonly contract:'mfk.local.backup.v1';
  readonly createdAt:number;
  readonly values:Readonly<Record<string,string>>;
  readonly checksum:string;
}

const HK_OFFSET_MS=8*60*60*1000;

function businessWindow(now:number,businessStartHour:number){
  const shifted=new Date(now+HK_OFFSET_MS);
  const year=shifted.getUTCFullYear();
  const month=shifted.getUTCMonth();
  const date=shifted.getUTCDate();
  let startShifted=Date.UTC(year,month,date,businessStartHour,0,0,0);
  if(now+HK_OFFSET_MS<startShifted)startShifted-=24*60*60*1000;
  const start=startShifted-HK_OFFSET_MS;
  const end=start+24*60*60*1000;
  const idDate=new Date(start+HK_OFFSET_MS);
  const businessDate=[
    idDate.getUTCFullYear(),
    String(idDate.getUTCMonth()+1).padStart(2,'0'),
    String(idDate.getUTCDate()).padStart(2,'0'),
  ].join('-');
  return {start,end,businessDate};
}

export function buildLocalReport(
  orders:readonly LocalReportOrder[],
  options:{readonly now?:number;readonly businessStartHour?:number}={},
):LocalReport{
  const now=options.now??Date.now();
  const businessStartHour=options.businessStartHour??5;
  const window=businessWindow(now,businessStartHour);
  const selected=orders.filter(order=>{
    const at=Date.parse(order.createdAt);
    return Number.isFinite(at)&&at>=window.start&&at<window.end;
  });
  const netSalesMinor=selected.reduce((sum,order)=>sum+Math.max(0,Number(order.totalMinor)||0),0);
  const cashSalesMinor=selected
    .filter(order=>String(order.paymentLabel).toUpperCase().includes('CASH')||String(order.paymentLabel).includes('現金'))
    .reduce((sum,order)=>sum+Math.max(0,Number(order.totalMinor)||0),0);
  const itemUnits=selected.reduce((sum,order)=>sum+order.items.reduce((s,item)=>s+Math.max(0,Number(item.qty)||0),0),0);
  const products=new Map<string,{name:string;quantity:number;salesMinor:number}>();
  for(const order of selected){
    for(const item of order.items){
      const row=products.get(item.name)??{name:item.name,quantity:0,salesMinor:0};
      const qty=Math.max(0,Number(item.qty)||0);
      row.quantity+=qty;
      row.salesMinor+=qty*Math.max(0,Number(item.unitMinor)||0);
      products.set(item.name,row);
    }
  }
  const topProducts=[...products.values()].sort((a,b)=>b.salesMinor-a.salesMinor||b.quantity-a.quantity||a.name.localeCompare(b.name,'zh-HK'));
  return Object.freeze({
    businessDate:window.businessDate,
    completedOrders:selected.length,
    netSalesMinor,
    cashSalesMinor,
    itemUnits,
    averageOrderMinor:selected.length?Math.round(netSalesMinor/selected.length):0,
    topProducts:Object.freeze(topProducts.map(row=>Object.freeze({...row}))),
  });
}

export function createLocalDayClose(input:{
  readonly orders:readonly LocalReportOrder[];
  readonly now?:number;
  readonly businessStartHour?:number;
  readonly openingCashMinor:number;
  readonly countedCashMinor:number;
  readonly existing:readonly LocalDayClose[];
  readonly note?:string;
}):LocalDayClose{
  const now=input.now??Date.now();
  const report=buildLocalReport(input.orders,{now,businessStartHour:input.businessStartHour??5});
  const version=input.existing
    .filter(row=>row.businessDate===report.businessDate)
    .reduce((max,row)=>Math.max(max,row.version),0)+1;
  const openingCashMinor=Math.max(0,Math.round(input.openingCashMinor));
  const countedCashMinor=Math.max(0,Math.round(input.countedCashMinor));
  const expectedCashMinor=openingCashMinor+report.cashSalesMinor;
  return Object.freeze({
    id:`DAYCLOSE-${report.businessDate}-V${version}`,
    businessDate:report.businessDate,
    version,
    createdAt:now,
    openingCashMinor,
    cashSalesMinor:report.cashSalesMinor,
    expectedCashMinor,
    countedCashMinor,
    cashDifferenceMinor:countedCashMinor-expectedCashMinor,
    note:String(input.note??'').trim(),
  });
}

function stable(value:unknown):string{
  if(Array.isArray(value))return '['+value.map(stable).join(',')+']';
  if(value&&typeof value==='object'){
    const row=value as Record<string,unknown>;
    return '{'+Object.keys(row).sort().map(key=>JSON.stringify(key)+':'+stable(row[key])).join(',')+'}';
  }
  return JSON.stringify(value);
}
function checksum(value:unknown):string{
  const text=stable(value);
  let hash=0x811c9dc5;
  for(let i=0;i<text.length;i++){
    hash^=text.charCodeAt(i);
    hash=Math.imul(hash,0x01000193)>>>0;
  }
  return 'fnv1a32-'+hash.toString(16).padStart(8,'0');
}

export function createLocalBackup(values:Readonly<Record<string,string>>,options:{readonly now?:number}={}):LocalBackup{
  const createdAt=options.now??Date.now();
  const localValues=Object.fromEntries(
    Object.entries(values)
      .filter(([key])=>key.startsWith('mfk.'))
      .sort(([a],[b])=>a.localeCompare(b)),
  );
  const body={contract:'mfk.local.backup.v1' as const,createdAt,values:localValues};
  return Object.freeze({...body,checksum:checksum(body)});
}

export function validateLocalBackup(backup:unknown):{ok:boolean;errors:string[]}{
  const errors:string[]=[];
  if(!backup||typeof backup!=='object'||Array.isArray(backup))return{ok:false,errors:['BACKUP_INVALID']};
  const row=backup as Partial<LocalBackup>;
  if(row.contract!=='mfk.local.backup.v1')errors.push('BACKUP_CONTRACT_INVALID');
  if(!row.values||typeof row.values!=='object'||Array.isArray(row.values))errors.push('BACKUP_VALUES_INVALID');
  else if(Object.keys(row.values).some(key=>!key.startsWith('mfk.')))errors.push('BACKUP_KEY_SCOPE_INVALID');
  if(typeof row.createdAt!=='number'||!Number.isFinite(row.createdAt))errors.push('BACKUP_CREATED_AT_INVALID');
  if(errors.length===0){
    const expected=checksum({contract:row.contract,createdAt:row.createdAt,values:row.values});
    if(row.checksum!==expected)errors.push('BACKUP_CHECKSUM_INVALID');
  }
  return{ok:errors.length===0,errors};
}

export function restoreLocalBackup(current:Readonly<Record<string,string>>,backup:LocalBackup):Record<string,string>{
  const validation=validateLocalBackup(backup);
  if(!validation.ok)throw new Error(validation.errors.join('|'));
  const next:Record<string,string>={...current};
  for(const key of Object.keys(next))if(key.startsWith('mfk.'))delete next[key];
  Object.assign(next,backup.values);
  return next;
}

export const LOCAL_DAY_CLOSE_KEY='mfk.v2local.day-closes.v1';

export function readLocalDayCloses(storage:Pick<Storage,'getItem'>=localStorage):LocalDayClose[]{
  try{
    const value=JSON.parse(storage.getItem(LOCAL_DAY_CLOSE_KEY)||'[]');
    return Array.isArray(value)?value:[];
  }catch{return []}
}

export function writeLocalDayCloses(rows:readonly LocalDayClose[],storage:Pick<Storage,'setItem'>=localStorage):void{
  storage.setItem(LOCAL_DAY_CLOSE_KEY,JSON.stringify(rows));
}

export function snapshotMfkStorage(storage:Storage=localStorage):Record<string,string>{
  const values:Record<string,string>={};
  for(let i=0;i<storage.length;i++){
    const key=storage.key(i);
    if(!key||!key.startsWith('mfk.'))continue;
    const value=storage.getItem(key);
    if(value!==null)values[key]=value;
  }
  return values;
}

export function applyMfkStorageSnapshot(values:Readonly<Record<string,string>>,storage:Storage=localStorage):void{
  const keys:string[]=[];
  for(let i=0;i<storage.length;i++){
    const key=storage.key(i);
    if(key?.startsWith('mfk.'))keys.push(key);
  }
  keys.forEach(key=>storage.removeItem(key));
  Object.entries(values).forEach(([key,value])=>{if(key.startsWith('mfk.'))storage.setItem(key,value)});
}
