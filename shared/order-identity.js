const pad=(value,size=2)=>String(value).padStart(size,'0');

function terminal(value='SMT'){
  return String(value||'SMT').trim().toUpperCase().replace(/[^A-Z0-9]/g,'')||'SMT';
}

function orderTime(order){
  return Number(order?.acceptedAt||order?.createdAt||order?.checkedOutAt||order?.completedAt||order?.updatedAt||0);
}

function localDateId(value){
  const date=new Date(Number(value));
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
}

function businessDateAt(value,startHour=5){
  const date=new Date(Number(value));
  const start=new Date(date);
  start.setHours(Number(startHour)||0,0,0,0);
  if(date.getTime()<start.getTime())start.setDate(start.getDate()-1);
  return localDateId(start.getTime());
}

function legacySequence(order){
  const explicit=Number(order?.dailySequence);
  if(Number.isInteger(explicit)&&explicit>0&&explicit<=999)return explicit;
  const value=String(order?.displayOrderNo||order?.id||'');
  const match=value.match(/^P(\d{1,4})$/i);
  const sequence=match?Number(match[1]):0;
  return sequence>0&&sequence<=999?sequence:0;
}

export function orderBusinessDate(order,startHour=5){
  if(order?.businessDate)return String(order.businessDate);
  const time=orderTime(order);
  return time?businessDateAt(time,startHour):'';
}

export function orderDisplayNumber(order){
  const candidate=String(order?.displayOrderNo||order?.id||'');
  const match=candidate.match(/^P0*(\d{1,3})$/i);
  return match?`P${pad(Number(match[1]),3)}`:candidate||'—';
}

export function latestOrderDisplayNumber(history){
  const latest=(Array.isArray(history)?history:[]).reduce((current,order)=>{
    if(!current)return order;
    return orderTime(order)>orderTime(current)?order:current;
  },null);
  return latest?orderDisplayNumber(latest):'—';
}

export function activeDineOrderIdentities(dineState){
  return (Array.isArray(dineState?.tables)?dineState.tables:[])
    .map(table=>table?.session?.orderIdentity)
    .filter(identity=>identity?.id&&identity?.displayOrderNo)
    .map(identity=>({...identity,acceptedAt:Number(identity.acceptedAt||identity.createdAt||0)}));
}

export function createOrderIdentity(history,{terminalId='SMT',tableId='',now=Date.now(),startHour=5}={}){
  const businessDate=businessDateAt(now,startHour);
  const highest=(Array.isArray(history)?history:[]).reduce((max,order)=>{
    return orderBusinessDate(order,startHour)===businessDate?Math.max(max,legacySequence(order)):max;
  },0);
  if(highest>=999)throw new Error('今日流水已到 P999，請先聯絡管理員處理，系統不會循環覆蓋舊單');
  const dailySequence=highest+1;
  const displayOrderNo=`P${pad(dailySequence,3)}`;
  const time=new Date(Number(now));
  const datePart=localDateId(now).replaceAll('-','');
  const timePart=`${pad(time.getHours())}${pad(time.getMinutes())}${pad(time.getSeconds())}${pad(time.getMilliseconds(),3)}`;
  const createdTerminalId=terminal(terminalId);
  const tableToken=tableId?(String(tableId)==='戶外'?'OUTDOOR':String(tableId).toUpperCase().replace(/[^A-Z0-9]/g,'')):'';
  return {
    id:`MF-${datePart}-${timePart}-${createdTerminalId}-${displayOrderNo}${tableToken?`-TABLE${tableToken}`:''}`,
    displayOrderNo,
    dailySequence,
    businessDate,
    createdTerminalId,
    ...(tableId?{dineTableId:String(tableId)}:{})
  };
}
