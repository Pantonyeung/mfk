export const SMM_STAGE7_SEGMENTS=Object.freeze(['ACTIVE','HISTORY']);
export const SMM_STAGE7_SOURCE_FILTERS=Object.freeze(['ALL','ONSITE','SMM','OWN_PLATFORM','THIRD_PARTY']);
export const SMM_STAGE7_SEARCH_SCOPES=Object.freeze(['ALL','DISPLAY','PRODUCT','PHONE']);

export function smmStage7IsHistory(row){
  const lifecycle=String(row?.lifecycle??'').trim().toUpperCase();
  return lifecycle==='COMPLETED'||lifecycle==='CANCELLED';
}

export function smmStage7InSegment(row,segment){
  return segment==='HISTORY'?smmStage7IsHistory(row):!smmStage7IsHistory(row);
}

export function smmStage7SourceGroup(row){
  const explicit=String(row?.sourceGroup??'').trim().toUpperCase();
  if(['ONSITE','SMM','OWN_PLATFORM','THIRD_PARTY'].includes(explicit))return explicit;
  const source=String(row?.source??'').trim().toUpperCase().replace(/[\s_-]+/g,'');
  if(!source)return 'UNKNOWN';
  if(['ONSITE','現場','COUNTER','POS','SMT','LOCAL','STORE'].includes(source))return 'ONSITE';
  if(source==='SMM')return 'SMM';
  if(['OWNPLATFORM','自家平台','CUSTOMER','CUSTOMERAPP','APP','WEB','網站','自家APP'].includes(source))return 'OWN_PLATFORM';
  if(['THIRDPARTY','第三方','KEETA','FOODPANDA','DELIVEROO'].includes(source))return 'THIRD_PARTY';
  return 'UNKNOWN';
}

export function smmStage7MatchesSource(row,filter){
  return filter==='ALL'||smmStage7SourceGroup(row)===filter;
}

export function smmStage7Phone(row){
  if(row?.customerPhonePermitted!==true)return null;
  const value=String(row?.customerPhone??'').trim();
  return value||null;
}

export function smmStage7ItemNames(row){
  if(Array.isArray(row?.items)){
    return row.items.map(item=>String(item?.name??'').trim()).filter(Boolean);
  }
  const summary=String(row?.itemSummary??'').trim();
  return summary?[summary]:[];
}

export function smmStage7MatchesSearch(row,query,scope='ALL'){
  const q=String(query??'').trim().toLocaleLowerCase('zh-HK');
  if(!q)return true;
  const display=String(row?.displayCode??'').toLocaleLowerCase('zh-HK');
  const products=smmStage7ItemNames(row).join(' ').toLocaleLowerCase('zh-HK');
  const phone=(smmStage7Phone(row)??'').toLocaleLowerCase('zh-HK');
  if(scope==='DISPLAY')return display.includes(q);
  if(scope==='PRODUCT')return products.includes(q);
  if(scope==='PHONE')return Boolean(phone)&&phone.includes(q);
  return display.includes(q)||products.includes(q)||(Boolean(phone)&&phone.includes(q));
}

function localDateKey(value){
  const date=new Date(String(value??''));
  if(!Number.isFinite(date.getTime()))return null;
  const y=date.getFullYear();
  const m=String(date.getMonth()+1).padStart(2,'0');
  const d=String(date.getDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
}

export function smmStage7OrderTime(row){
  return String(row?.orderTime??row?.observedAt??'');
}

export function smmStage7MatchesDate(row,dateFilter,customDate,nowValue){
  if(dateFilter==='ALL')return true;
  const key=localDateKey(smmStage7OrderTime(row));
  if(!key)return false;
  if(dateFilter==='CUSTOM')return Boolean(customDate)&&key===customDate;
  const now=new Date(nowValue??Date.now());
  if(!Number.isFinite(now.getTime()))return false;
  if(dateFilter==='YESTERDAY')now.setDate(now.getDate()-1);
  const target=localDateKey(now);
  return key===target;
}

export function smmStage7ItemCount(row){
  const direct=Number(row?.itemCount);
  if(Number.isSafeInteger(direct)&&direct>=0)return direct;
  if(Array.isArray(row?.items)){
    return row.items.reduce((sum,item)=>{
      const quantity=Number(item?.quantity);
      return sum+(Number.isSafeInteger(quantity)&&quantity>0?quantity:0);
    },0);
  }
  return null;
}

export function smmStage7AmountLabel(row){
  const value=String(row?.effectiveAmountLabel??row?.amountLabel??'').trim();
  return value||'未有資料';
}

export function smmStage7StatusLabel(row){
  const supplied=String(row?.fulfillmentLabel??'').trim();
  if(supplied)return supplied;
  const lifecycle=String(row?.lifecycle??'').trim().toUpperCase();
  if(['PENDING','NEW','CREATED','RECEIVED'].includes(lifecycle))return '待確認';
  if(['PREPARING','IN_PROGRESS','PROCESSING'].includes(lifecycle))return '製作中';
  if(['READY','READY_FOR_PICKUP'].includes(lifecycle))return '準備完成 / 可取餐';
  if(['PICKED_UP','COLLECTED','COMPLETED'].includes(lifecycle))return '已取餐';
  if(lifecycle==='CANCELLED')return '已取消';
  if(row?.readback==='UNKNOWN')return '狀態未明';
  if(row?.readback==='PARTIAL')return '部分資料';
  return '未有資料';
}

export function smmStage7ConnectionState(connection,hasRows){
  if(connection==='LOADING')return Object.freeze({kind:'LOADING',title:'正在讀取訂單',detail:'只會顯示正式訂單投影。'});
  if(connection==='NOT_CONNECTED')return Object.freeze({kind:'OFFLINE',title:'訂單服務離線',detail:hasRows?'保留最近一次只讀資料；不會建立新訂單狀態。':'目前未有可讀取嘅正式訂單資料。'});
  if(connection==='STALE')return Object.freeze({kind:'STALE',title:'訂單資料較舊',detail:'保留最近一次正式投影；可重新整理。'});
  if(connection==='PARTIAL')return Object.freeze({kind:'PARTIAL',title:'部分訂單資料已讀取',detail:'已成功部分會保留，唔會當成總失敗。'});
  if(connection==='UNKNOWN')return Object.freeze({kind:'UNKNOWN',title:'訂單資料狀態未明',detail:'只做重新讀取，不會推斷或改寫訂單狀態。'});
  if(connection==='ERROR')return Object.freeze({kind:'ERROR',title:'訂單資料讀取失敗',detail:'可重新整理；不會執行任何訂單 mutation。'});
  return null;
}
