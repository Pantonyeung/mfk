export const SMM_STAGE6_PRIORITY=Object.freeze({
  ACTION_REQUIRED:0,
  DELAYED:1,
  UNKNOWN:2,
  NORMAL:3,
});

export function smmStage6Priority(state){
  return Object.prototype.hasOwnProperty.call(SMM_STAGE6_PRIORITY,state)
    ?SMM_STAGE6_PRIORITY[state]
    :SMM_STAGE6_PRIORITY.UNKNOWN;
}

export function smmStage6Sort(items){
  return Object.freeze([...items].sort((a,b)=>{
    const priority=smmStage6Priority(a.state)-smmStage6Priority(b.state);
    if(priority)return priority;
    const at=Date.parse(String(a.orderTime??a.observedAt??''))||0;
    const bt=Date.parse(String(b.orderTime??b.observedAt??''))||0;
    if(at!==bt)return at-bt;
    return String(a.displayCode??a.workId??'').localeCompare(String(b.displayCode??b.workId??''));
  }));
}

export function smmStage6StateLabel(state,statusLabel){
  const supplied=String(statusLabel??'').trim();
  if(supplied)return supplied;
  if(state==='ACTION_REQUIRED')return '需要協助';
  if(state==='DELAYED')return '延遲';
  if(state==='UNKNOWN')return '狀態未明';
  return '正常';
}

export function smmStage6ServiceKind(item){
  const explicit=String(item?.serviceMode??'').toUpperCase();
  if(explicit==='TAKEAWAY')return 'TAKEAWAY';
  if(explicit==='DINE_IN')return 'DINE_IN';
  const kind=String(item?.kind??'').trim().toUpperCase();
  if(kind==='TAKEAWAY'||kind==='外賣')return 'TAKEAWAY';
  if(kind==='DINE_IN'||kind==='堂食')return 'DINE_IN';
  return 'UNKNOWN';
}

export function smmStage6ItemCount(item){
  const count=Number(item?.itemCount);
  if(Number.isSafeInteger(count)&&count>=0)return count;
  if(Array.isArray(item?.items)){
    const total=item.items.reduce((sum,row)=>{
      const quantity=Number(row?.quantity);
      return sum+(Number.isSafeInteger(quantity)&&quantity>0?quantity:0);
    },0);
    return total;
  }
  return null;
}

export function smmStage6MatchesFilter(item,filter){
  if(filter==='ALL')return true;
  if(filter==='ATTENTION')return item.state!=='NORMAL';
  return smmStage6ServiceKind(item)===filter;
}

export function smmStage6Counts(items){
  return Object.freeze({
    ALL:items.length,
    TAKEAWAY:items.filter(item=>smmStage6MatchesFilter(item,'TAKEAWAY')).length,
    DINE_IN:items.filter(item=>smmStage6MatchesFilter(item,'DINE_IN')).length,
    ATTENTION:items.filter(item=>smmStage6MatchesFilter(item,'ATTENTION')).length,
  });
}

export function smmStage6ConnectionState(connection,hasRows){
  if(connection==='LOADING')return Object.freeze({kind:'LOADING',title:'正在讀取待處理隊列',detail:'只會顯示正式投影資料。'});
  if(connection==='NOT_CONNECTED')return Object.freeze({kind:'OFFLINE',title:'門店服務離線',detail:hasRows?'保留最近一次只讀資料；不會建立新狀態。':'目前未有可讀取嘅正式待處理資料。'});
  if(connection==='STALE')return Object.freeze({kind:'STALE',title:'資料較舊',detail:'畫面保留最近一次正式投影；請重新整理。'});
  if(connection==='PARTIAL')return Object.freeze({kind:'PARTIAL',title:'部分資料已讀取',detail:'已成功部分會保留，唔會當成總失敗。'});
  if(connection==='UNKNOWN')return Object.freeze({kind:'UNKNOWN',title:'資料狀態未明',detail:'只代表讀取狀態；唔會改寫訂單或製作狀態。'});
  if(connection==='ERROR')return Object.freeze({kind:'ERROR',title:'待處理資料讀取失敗',detail:'可重新整理；不會執行任何訂單 mutation。'});
  return null;
}

export function smmStage6DisplayCode(item,order){
  const value=String(item?.displayCode??order?.displayCode??'').trim();
  return value||'待讀回';
}

export function smmStage6Source(item,order){
  const value=String(item?.source??order?.source??'').trim();
  return value||'來源待讀回';
}

export function smmStage6ObservedTime(item,order){
  return String(item?.orderTime??order?.observedAt??item?.observedAt??'');
}
