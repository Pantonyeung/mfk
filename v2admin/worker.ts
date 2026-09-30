import {createMfkAdminConfigEnvelope,validateMfkAdminConfigAck,validateMfkAdminConfigEnvelope} from '../contracts/admin-config-sync-v1.ts';
import {validateSmtProjectionBatch} from '../contracts/smt-projection-v1.ts';
import {MFK_ADMIN_REFUND_SCHEMA,validateAdminRefundEvent} from '../contracts/admin-refund-v1.ts';
import {KeetaRuntimeStore} from './keeta-runtime.ts';
import {CustomerRuntimeStore} from './customer-runtime.ts';
export {KeetaRuntimeStore,CustomerRuntimeStore};

const JSON_HEADERS={'content-type':'application/json; charset=utf-8','cache-control':'no-store'};
const ADMIN_ORIGIN='https://admin.morefunos.com';
const SMT_ORIGIN='https://appassets.androidplatform.net';
const CUSTOMER_ORIGIN='https://order.morefunos.com';
const OWNER_ORIGIN='https://owner.morefunos.com';
const CORS_ORIGINS=new Set([ADMIN_ORIGIN,SMT_ORIGIN,CUSTOMER_ORIGIN,OWNER_ORIGIN]);

function json(value,status=200,extra={}){
  return new Response(JSON.stringify(value),{status,headers:{...JSON_HEADERS,...extra}});
}
function cors(request){
  const origin=request.headers.get('origin')||'';
  return CORS_ORIGINS.has(origin)?{
    'access-control-allow-origin':origin,
    'access-control-allow-methods':'GET,POST,OPTIONS',
    'access-control-allow-headers':'content-type,x-mfk-admin-publish-key,x-mfk-smm-session,x-mfk-owner-session,x-mfk-admin-session',
    'access-control-allow-credentials':'true',
    'vary':'origin',
  }:{};
}

// A WebSocket upgrade response carries an out-of-band webSocket handle. Rebuilding
// that response drops the handle in Workers, so the events route must remain the
// exact response returned by the Durable Object.
export function adminSyncOuterResponse(pathname,response,request){
  if(pathname==='/api/admin-sync/events')return response;
  const headers=new Headers(response.headers);
  for(const [key,value] of Object.entries(cors(request)))headers.set(key,value);
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
async function sha256(value){
  const bytes=new TextEncoder().encode(value);
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('');
}
function ownerHexToBytes(value){
  if(!/^[0-9a-f]+$/i.test(String(value||''))||String(value).length%2!==0)throw new Error('OWNER_AUTH_HEX_INVALID');
  const text=String(value);const out=new Uint8Array(text.length/2);
  for(let i=0;i<out.length;i++)out[i]=Number.parseInt(text.slice(i*2,i*2+2),16);
  return out;
}
async function ownerHmacHex(keyHex,message){
  const key=await crypto.subtle.importKey('raw',ownerHexToBytes(keyHex),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const signature=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(message));
  return [...new Uint8Array(signature)].map(v=>v.toString(16).padStart(2,'0')).join('');
}
function ownerSameHex(left,right){
  const a=String(left||'').toLowerCase(),b=String(right||'').toLowerCase();
  if(a.length!==b.length||a.length<1)return false;
  let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);
  return diff===0;
}
function storeIdFrom(url){return (url.searchParams.get('storeId')||'MF01').trim().slice(0,64)||'MF01';}
function hktBusinessDate(iso,cutoff='05:00'){
  const at=Date.parse(String(iso||''));
  const parsed=/^([01]?\d|2[0-3]):([0-5]\d)$/.exec(String(cutoff||''));
  const cutoffMinutes=parsed?Number(parsed[1])*60+Number(parsed[2]):300;
  const shifted=new Date((Number.isFinite(at)?at:Date.now())+8*60*60*1000-cutoffMinutes*60*1000);
  return shifted.toISOString().slice(0,10);
}
function isCashMethod(method){
  const value=String(method||'').toUpperCase();
  return value.includes('CASH')||String(method||'').includes('現金');
}

async function resolveSmmStaffSession(request,storeId){
  const token=String(request.headers.get('x-mfk-smm-session')||'').trim();
  if(!token)return null;
  const url=new URL('https://smm.morefunos.com/api/smm/staff/session');
  url.searchParams.set('storeId',storeId);
  let response;
  try{
    response=await fetch(url.toString(),{
      method:'GET',
      headers:{'x-mfk-smm-session':token,'accept':'application/json'},
    });
  }catch{return null;}
  if(!response.ok)return null;
  const body=await response.json().catch(()=>null);
  if(!body||typeof body!=='object'||Array.isArray(body))return null;
  const staffId=String(body.staffId||'').trim();
  const displayName=String(body.displayName||'').trim();
  const role=String(body.role||'STAFF').trim();
  if(!staffId||!displayName)return null;
  return Object.freeze({staffId,displayName,role});
}

function row(value){
  return value&&typeof value==='object'&&!Array.isArray(value)?value:{};
}
function rows(value){return Array.isArray(value)?value:[];}
function minorFromMoney(value){
  const n=Number(value);
  return Number.isFinite(n)?Math.round(n*100):0;
}
function moneyLabel(minor){
  const value=Math.max(0,Number(minor)||0)/100;
  return 'HK'+String.fromCharCode(36)+(Number.isInteger(value)?String(value):value.toFixed(2));
}

export const MFK_OWNER_MONTHLY_PLAN_SCHEMA='MFK_OWNER_MONTHLY_PLAN_V1';
const OWNER_COST_CATEGORIES=new Set(['RENT','UTILITIES_WATER','UTILITIES_ELECTRICITY','UTILITIES_GAS','LABOR','OTHER','CUSTOM']);
const OWNER_DEFAULT_COST_LINES=[
  ['rent','RENT','屋租'],
  ['water','UTILITIES_WATER','水'],
  ['electricity','UTILITIES_ELECTRICITY','電'],
  ['gas','UTILITIES_GAS','煤氣'],
  ['labor','LABOR','人工'],
  ['other','OTHER','其他'],
];

function hktDate(now=new Date().toISOString()){
  const at=Date.parse(String(now||''));
  return new Date((Number.isFinite(at)?at:Date.now())+8*60*60*1000).toISOString().slice(0,10);
}
function hktMonthKey(now=new Date().toISOString()){return hktDate(now).slice(0,7);}
function validMonthKey(value){return /^\d{4}-(0[1-9]|1[0-2])$/.test(String(value||''));}
function ownerDefaultPlan(monthKey,observedAt=new Date().toISOString()){
  return Object.freeze({
    schema:MFK_OWNER_MONTHLY_PLAN_SCHEMA,
    storeId:'MF01',
    monthKey,
    monthlyRevenueTargetMinor:0,
    note:'',
    revision:0,
    updatedAt:observedAt,
    updatedBy:'UNSET',
    costLines:Object.freeze(OWNER_DEFAULT_COST_LINES.map(([id,category,label])=>Object.freeze({
      costLineId:'base-'+id,category,label,plannedMonthlyMinor:0,updatedAt:observedAt,updatedBy:'UNSET',
    }))),
  });
}
function normalizedOwnerCostLine(raw,index,updatedAt,updatedBy){
  const item=row(raw);
  const category=String(item.category||'OTHER').trim().toUpperCase();
  if(!OWNER_COST_CATEGORIES.has(category))throw new Error('OWNER_PLAN_COST_CATEGORY_INVALID');
  const costLineId=String(item.costLineId||'').trim()||'cost-'+String(index+1);
  if(costLineId.length>120)throw new Error('OWNER_PLAN_COST_LINE_ID_INVALID');
  const label=String(item.label||'').trim().slice(0,80);
  if(!label)throw new Error('OWNER_PLAN_COST_LABEL_REQUIRED');
  const plannedMonthlyMinor=Math.round(Number(item.plannedMonthlyMinor));
  if(!Number.isSafeInteger(plannedMonthlyMinor)||plannedMonthlyMinor<0)throw new Error('OWNER_PLAN_COST_PLANNED_INVALID');
  const actualProvided=item.actualToDateMinor!==undefined&&item.actualToDateMinor!==null&&item.actualToDateMinor!=='';
  const actualToDateMinor=actualProvided?Math.round(Number(item.actualToDateMinor)):undefined;
  if(actualProvided&&(!Number.isSafeInteger(actualToDateMinor)||actualToDateMinor<0))throw new Error('OWNER_PLAN_COST_ACTUAL_INVALID');
  const note=String(item.note||'').trim().slice(0,240);
  return Object.freeze({
    costLineId,category,label,plannedMonthlyMinor,
    ...(actualProvided?{actualToDateMinor}:{}),
    ...(note?{note}:{}),
    updatedAt,updatedBy,
  });
}
const OWNER_WEEKDAY_KEYS=Object.freeze(['SUN','MON','TUE','WED','THU','FRI','SAT']);
export function ownerRemainingOperatingDays(active,monthKey,observedAt=new Date().toISOString()){
  if(!validMonthKey(monthKey))return undefined;
  const weekly=row(row(row(active).snapshot).storeSettings).weeklyHours;
  const schedule=row(weekly);
  if(!Object.keys(schedule).length)return undefined;
  const [year,month]=monthKey.split('-').map(Number);
  const daysInMonth=new Date(Date.UTC(year,month,0)).getUTCDate();
  const today=hktDate(observedAt);
  const currentMonth=today.slice(0,7);
  const startDay=monthKey===currentMonth?Number(today.slice(8,10)):monthKey<currentMonth?daysInMonth+1:1;
  let count=0;
  for(let day=Math.max(1,startDay);day<=daysInMonth;day++){
    const key=OWNER_WEEKDAY_KEYS[new Date(Date.UTC(year,month-1,day)).getUTCDay()];
    const rule=row(schedule[key]);
    if(Object.keys(rule).length&&rule.closed!==true)count++;
  }
  return count;
}

export function calculateOwnerPlanningMetrics({monthKey,currentEffectiveSalesMinor,plan,observedAt=new Date().toISOString(),remainingOperatingDays}){
  if(!validMonthKey(monthKey))throw new Error('OWNER_PLAN_MONTH_INVALID');
  const [year,month]=monthKey.split('-').map(Number);
  const daysInMonth=new Date(Date.UTC(year,month,0)).getUTCDate();
  const today=hktDate(observedAt),currentMonth=today.slice(0,7),day=Number(today.slice(8,10));
  const elapsedDays=monthKey===currentMonth?Math.max(1,Math.min(day,daysInMonth)):monthKey<currentMonth?daysInMonth:0;
  const remainingCalendarDays=monthKey===currentMonth?Math.max(0,daysInMonth-day+1):monthKey<currentMonth?0:daysInMonth;
  const sales=Math.max(0,Math.round(Number(currentEffectiveSalesMinor)||0));
  const target=Math.max(0,Math.round(Number(plan?.monthlyRevenueTargetMinor)||0));
  const remaining=Math.max(0,target-sales);
  const achievementPercent=target>0?sales/target*100:0;
  const divisor=Number.isSafeInteger(remainingOperatingDays)&&remainingOperatingDays>=0?remainingOperatingDays:remainingCalendarDays;
  const requiredDailyAverageMinor=remaining<=0?0:divisor>0?Math.ceil(remaining/divisor):remaining;
  const actualDailyAverageMinor=elapsedDays>0?Math.round(sales/elapsedDays):0;
  const paceState=remaining<=0&&target>0?'TARGET_REACHED':actualDailyAverageMinor>=requiredDailyAverageMinor&&target>0?'ON_TRACK':'ATTENTION';
  const costLines=rows(plan?.costLines);
  const monthlyPlannedCostMinor=costLines.reduce((sum,item)=>sum+Math.max(0,Math.round(Number(row(item).plannedMonthlyMinor)||0)),0);
  const actualLines=costLines.filter(item=>row(item).actualToDateMinor!==undefined&&row(item).actualToDateMinor!==null);
  const actualToDateCostMinor=actualLines.reduce((sum,item)=>sum+Math.max(0,Math.round(Number(row(item).actualToDateMinor)||0)),0);
  const actualCostAvailable=actualLines.length>0;
  const costCoverage=actualLines.length===0||actualLines.length<costLines.length?'PARTIAL':'MANUAL_ESTIMATE';
  const targetOperatingSurplusMinor=target-monthlyPlannedCostMinor;
  const estimatedOperatingProfitToDateMinor=actualCostAvailable?sales-actualToDateCostMinor:undefined;
  let forecastTargetDate;
  if(monthKey===currentMonth&&remaining>0&&actualDailyAverageMinor>0){
    const daysNeeded=Math.ceil(remaining/actualDailyAverageMinor);
    const base=Date.parse(today+'T00:00:00Z');
    forecastTargetDate=new Date(base+daysNeeded*24*60*60*1000).toISOString().slice(0,10);
  }
  return Object.freeze({
    currentEffectiveSalesMinor:sales,
    monthlyRevenueTargetMinor:target,
    achievementPercent,
    remainingMinor:remaining,
    remainingCalendarDays,
    ...(Number.isSafeInteger(remainingOperatingDays)&&remainingOperatingDays>=0?{remainingOperatingDays}:{}),
    requiredDailyAverageMinor,
    actualDailyAverageMinor,
    paceState,
    monthlyPlannedCostMinor,
    targetOperatingSurplusMinor,
    actualToDateCostMinor,
    actualCostAvailable,
    ...(estimatedOperatingProfitToDateMinor!==undefined?{estimatedOperatingProfitToDateMinor}:{}),
    costCoverage,
    ...(forecastTargetDate?{forecastTargetDate,forecastLabel:'預計'}:{}),
    salesSource:'CURRENT_EFFECTIVE_SALES',
  });
}
function keetaObservedRecord(input){
  const root=row(input),first=row(root.readback);
  if(first.details)return first;
  const second=row(first.readback);
  if(second.details)return second;
  return {};
}
export function normalizeOwnerKeetaChannel(input,now=new Date().toISOString()){
  const root=row(input),observed=keetaObservedRecord(root),details=row(row(observed.details).data);
  const status=Number(details.status);
  const observedState=status===3?'OPEN':status===4?'PAUSED':'UNKNOWN';
  const operation=row(root.operation);
  const action=String(operation.action||'');
  const desiredState=action==='REST'?'PAUSED':action==='OPEN'?'OPEN':observedState;
  const observedAt=String(observed.observedAt||operation.completedAt||operation.observedAt||now);
  const age=Date.parse(now)-Date.parse(observedAt);
  const freshness=Number.isFinite(age)&&age>=0&&age<=2*60*1000?'CURRENT':observed.details?'STALE':'UNKNOWN';
  const commandState=String(operation.state||'');
  const lastCommand=action?{
    action:action==='REST'?'PAUSE':'RESUME',
    state:commandState==='COMPLETED'?'CONFIRMED':commandState==='IDEMPOTENT'?'IDEMPOTENT':commandState==='FAILED'?'FAILED':'UNKNOWN',
    ...(operation.completedAt?{completedAt:String(operation.completedAt)}:{}),
  }:undefined;
  return Object.freeze({
    channelId:'KEETA',name:'Keeta',
    recentOrderDiagnostics:rows(root.orderDiagnostics).slice(0,10).map(item=>({providerOrderId:String(item.providerOrderId||''),canonicalDisplay:item.canonicalDisplay?String(item.canonicalDisplay):null,state:String(item.state||'UNKNOWN'),mappingState:String(item.mappingState||'PENDING'),ackState:String(item.ackState||'PENDING'),commercialState:item.commercialState?String(item.commercialState):null,providerConfirmState:item.providerConfirmState?String(item.providerConfirmState):null,providerReadyState:item.providerReadyState?String(item.providerReadyState):null,receivedAt:String(item.receivedAt||now)})),
    acceptingOrders:status===3?true:status===4?false:null,
    desiredState,observedState,
    health:freshness==='CURRENT'&&(status===3||status===4)?'HEALTHY':'UNKNOWN',
    mode:status===3?'NORMAL':status===4?'PAUSED':'CLOSED',
    cause:action?'manual':'provider',
    observedAt,freshness,
    ...(lastCommand?{lastCommand}:{}),
    readback:status===3||status===4?'CONFIRMED':'UNKNOWN',
    controls:Object.freeze({pause:false,resume:false,snooze:false,busy:false}),
  });
}
export function normalizeOwnerOwnPlatformChannel(active,health,now=new Date().toISOString()){
  const snapshot=row(row(active).snapshot),policy=row(snapshot.customerChannelPolicy);
  const enabled=policy.enabled===true;
  const h=row(health),observedAt=String(h.observedAt||now);
  const reachable=h.reachable===true,hasHealth=typeof h.reachable==='boolean';
  return Object.freeze({
    channelId:'OWN_PLATFORM',name:'自家平台',
    acceptingOrders:enabled,
    desiredState:enabled?'OPEN':'PAUSED',
    observedState:enabled?'OPEN':'PAUSED',
    health:reachable?'HEALTHY':hasHealth?'DEGRADED':'UNKNOWN',
    mode:enabled?'NORMAL':'PAUSED',
    cause:enabled?(reachable?'policy':'integration'):'manual',
    observedAt,
    freshness:hasHealth?(reachable?'CURRENT':'STALE'):'UNKNOWN',
    readback:'CONFIRMED',
    controls:Object.freeze({pause:false,resume:false,snooze:false,busy:false}),
  });
}

const OWNER_CANONICAL_FULFILLMENT=new Set(['待處理','進行中','可取餐','已完成','已取消']);
export function mapOwnerOrderProjection(input){
  const order=row(input);
  const rawFulfillment=String(order.fulfillmentLabel||'');
  const fulfillmentLabel=OWNER_CANONICAL_FULFILLMENT.has(rawFulfillment)?rawFulfillment:undefined;
  const lifecycle=fulfillmentLabel==='已完成'?'COMPLETED':fulfillmentLabel==='已取消'?'CANCELLED':'ACTIVE';
  const observedAt=String(order.updatedAt||order.createdAt||new Date().toISOString());
  const items=rows(order.items);
  const totalMinor=Math.max(0,Math.round(Number(order.totalMinor)||0));
  const paymentLabel=String(order.paymentLabel||'').trim();
  const externalRef=String(order.externalRef||'').trim();
  return{
    orderId:String(order.orderId||''),displayCode:String(order.display||''),
    source:String(order.sourceLabel||'未有來源讀回'),lifecycle,
    ...(fulfillmentLabel?{workflowStatusLabel:fulfillmentLabel,fulfillmentLabel}:{}),
    ...(order.businessDate?{businessDate:String(order.businessDate)}:{}),
    amountLabel:moneyLabel(totalMinor),originalAmountLabel:moneyLabel(totalMinor),currentEffectiveAmountLabel:moneyLabel(totalMinor),
    ...(paymentLabel?{tenderLabel:paymentLabel,currentTenderLabel:paymentLabel}:{}),
    ...(externalRef?{externalRef}:{}),
    itemSummary:items.map(item=>String(row(item).name||'')).filter(Boolean).join('、'),
    referenceValueLabel:Number.isFinite(Number(order.referenceValueMinor))?moneyLabel(Number(order.referenceValueMinor)):undefined,
    effectiveTransactionLabel:Number.isFinite(Number(order.effectiveTransactionMinor))?moneyLabel(Number(order.effectiveTransactionMinor)):moneyLabel(totalMinor),
    pricingAuthority:order.pricingAuthority?String(order.pricingAuthority):undefined,
    printState:order.acceptancePrintedAt?'DONE':fulfillmentLabel==='待處理'?'PENDING':'UNKNOWN',
    itemLines:items.map(rawItem=>{const item=row(rawItem);const qty=Math.max(0,Math.floor(Number(item.qty)||0));const unitMinor=Math.max(0,Math.round(Number(item.unitMinor)||0));return{lineId:String(item.id||''),name:String(item.name||''),quantity:qty,amountLabel:moneyLabel(qty*unitMinor)};}),
    readback:'CONFIRMED',observedAt,prints:[],exceptions:[],timeline:[],
    ...(fulfillmentLabel?{fulfillmentHistory:[{label:fulfillmentLabel,atLabel:observedAt,state:fulfillmentLabel}]}:{}),
  };
}
function ownerSellabilityKey(grain,targetId){
  const id=String(targetId||'').trim();
  const canonicalGrain=grain==='MODIFIER'?'OPTION':String(grain||'').trim();
  return canonicalGrain==='PRODUCT'?id:canonicalGrain+':'+id;
}
function ownerSellabilityEffective(rawState,now=new Date().toISOString()){
  const state=row(rawState);
  const restoreAt=String(state.restoreAt||'').trim();
  const expired=restoreAt&&Number.isFinite(Date.parse(restoreAt))&&Date.parse(restoreAt)<=Date.parse(now);
  return expired?true:state.sellable!==false;
}
function ownerSellabilityTargets(snapshot,observedAt=new Date().toISOString()){
  const catalog=row(snapshot.catalog),optionCenter=row(snapshot.optionCenter),availability=row(snapshot.availability);
  const inventoryRows=rows(snapshot.inventory);
  const quantityById=new Map(inventoryRows.map(raw=>{const item=row(raw);const id=String(item.productId||item.targetId||item.id||'');const quantity=Number(item.quantity??item.onHand??item.count);return[id,Number.isFinite(quantity)?quantity:undefined];}).filter(([id])=>id));
  const targets=[];
  for(const raw of rows(catalog.products)){
    const item=row(raw),targetId=String(item.id||'');if(!targetId)continue;
    targets.push({targetId,name:String(item.name||targetId),grain:'PRODUCT'});
  }
  const seenOption=new Set();
  for(const rawSet of rows(optionCenter.sets)){
    const set=row(rawSet);
    for(const rawOption of rows(set.options)){
      const option=row(rawOption),targetId=String(option.id||option.code||'');if(!targetId||seenOption.has(targetId))continue;
      seenOption.add(targetId);
      targets.push({targetId,name:String(option.name||targetId),grain:'OPTION'});
    }
  }
  for(const rawPool of rows(catalog.comboPools)){
    const pool=row(rawPool);
    for(const rawGroup of rows(pool.groups)){
      const group=row(rawGroup);
      for(const rawChoice of rows(group.choices)){
        const choice=row(rawChoice),targetId=String(choice.id||'');if(!targetId)continue;
        targets.push({targetId,name:String(choice.label||choice.productId||targetId),grain:'COMBO_CHILD'});
      }
    }
  }
  return Object.freeze(targets.map(target=>{
    const key=ownerSellabilityKey(target.grain,target.targetId),state=row(availability[key]);
    const sellable=ownerSellabilityEffective(state,observedAt);
    const scope=state.scope==='ONLINE_ONLY'?'ONLINE_ONLY':'ALL';
    const quantity=target.grain==='PRODUCT'?quantityById.get(target.targetId):undefined;
    return Object.freeze({
      ...target,
      state:sellable?'SELLABLE':'SOLD_OUT',
      scope,
      ...(state.restoreAt?{restoreAt:String(state.restoreAt)}:{}),
      ...(Number.isFinite(quantity)?{quantity}:{}),
      observedAt,
      readback:'CONFIRMED',
    });
  }));
}
function ownerResolveSellabilityTarget(snapshot,grain,targetId){
  const id=String(targetId||'').trim();
  if(!id)return null;
  const catalog=row(snapshot.catalog),optionCenter=row(snapshot.optionCenter);
  if(grain==='PRODUCT'){
    const found=rows(catalog.products).map(row).find(item=>String(item.id||'')===id);
    return found?{targetId:id,grain,name:String(found.name||id)}:null;
  }
  if(grain==='OPTION'||grain==='MODIFIER'){
    for(const rawSet of rows(optionCenter.sets)){
      const found=rows(row(rawSet).options).map(row).find(item=>String(item.id||item.code||'')===id);
      if(found)return{targetId:id,grain,name:String(found.name||id)};
    }
    return null;
  }
  if(grain==='COMBO_CHILD'){
    for(const rawPool of rows(catalog.comboPools))for(const rawGroup of rows(row(rawPool).groups)){
      const found=rows(row(rawGroup).choices).map(row).find(item=>String(item.id||'')===id);
      if(found)return{targetId:id,grain,name:String(found.label||found.productId||id)};
    }
  }
  return null;
}
function ownerTemporaryRestoreAt(value,now=new Date().toISOString()){
  const raw=String(value||'').trim();
  if(!raw)return undefined;
  if(raw==='TODAY'){
    const date=hktDate(now);
    return new Date(date+'T23:59:59+08:00').toISOString();
  }
  const at=Date.parse(raw);
  return Number.isFinite(at)&&at>Date.parse(now)?new Date(at).toISOString():undefined;
}

const OWNER_STAFF_CAPABILITY_LABELS=Object.freeze({
  ORDER_REVIEW:'查看訂單',
  ORDER_CORRECTION:'更正訂單／付款',
  ADMIN_CONFIG:'修改後台設定',
  PUBLISH_CONFIG:'建立設定版本',
  REPORT_VIEW:'查看報表',
  REPORT_EXPORT:'匯出報表',
  STAFF_MANAGE:'管理員工',
});
function ownerHumanStaffLoginId(person){
  const staffId=String(person.staffId||'').trim();
  const name=String(person.name||'').trim();
  const loginId=String(person.loginId||'').trim();
  if(!loginId||loginId===staffId||loginId===name)return undefined;
  return loginId;
}
function ownerStaffCapabilitySummary(person){
  const labels=[...new Set(rows(person.permissions).map(value=>OWNER_STAFF_CAPABILITY_LABELS[String(value||'').trim()]).filter(Boolean))];
  return labels.length?labels.join('、'):undefined;
}

export function buildOwnerReadModelSnapshot({active,orders,reports,acks,observedAt}){
  const now=String(observedAt||new Date().toISOString());
  const activeEnvelope=row(active),snapshot=row(activeEnvelope.snapshot),settings=row(snapshot.storeSettings),catalog=row(snapshot.catalog),staffAuth=row(snapshot.staffAuth);
  const reportRows=rows(reports).filter(item=>row(item).date).sort((a,b)=>String(row(b).date).localeCompare(String(row(a).date)));
  const mappedOrders=rows(orders).map(mapOwnerOrderProjection).filter(order=>order.orderId&&order.displayCode);
  const latestReport=reportRows[0]?row(reportRows[0]):null;
  const activeOrders=mappedOrders.filter(order=>order.lifecycle!=='COMPLETED'&&order.lifecycle!=='CANCELLED');
  const sellability=ownerSellabilityTargets(snapshot,now);
  const staff=rows(staffAuth.staff).filter(rawStaff=>row(rawStaff).active!==false).map(rawStaff=>{
    const person=row(rawStaff),staffId=String(person.staffId||'').trim(),name=String(person.name||'').trim();
    const loginId=ownerHumanStaffLoginId(person),capabilitySummary=ownerStaffCapabilitySummary(person);
    return{staffId,name,role:String(person.role||'STAFF'),presence:'UNKNOWN',...(loginId?{loginId}:{}),...(capabilitySummary?{capabilitySummary}:{})};
  }).filter(person=>person.staffId&&person.name);
  const devices=Object.values(row(acks)).map(rawAck=>{const ack=row(rawAck);const deviceId=String(ack.deviceId||'');return{deviceId,name:deviceId||'未命名裝置',kind:'SMT',health:'UNKNOWN',...(ack.appliedAt?{lastSeen:String(ack.appliedAt)}:{}),binding:ack.revision!==undefined?'Admin revision '+String(ack.revision):'未有 revision 讀回',jobs:'未有打印工作讀回',affected:'未有影響範圍讀回'};}).filter(device=>device.deviceId);
  const reportCards=reportRows.slice(0,31).map(rawReport=>{const report=row(rawReport);const date=String(report.date||'');return{reportId:'daily:'+date,name:date+' 淨銷售',value:moneyLabel(Number(report.netMinor)||0),compare:String(Math.max(0,Number(report.orders)||0))+' 單',freshness:'CANONICAL_PROJECTION'};});
  const today=latestReport?{salesLabel:moneyLabel(Number(latestReport.netMinor)||0),orderCount:Math.max(0,Number(latestReport.orders)||0),averageOrderLabel:moneyLabel((Number(latestReport.orders)||0)>0?Math.round((Number(latestReport.netMinor)||0)/Number(latestReport.orders)):0),comparisonLabel:'未有比較資料讀回'}:undefined;
  const store=Object.keys(snapshot).length||latestReport?{storeId:String(activeEnvelope.storeId||'MF01'),storeName:String(settings.storeName||'磨飯'),businessDate:String(latestReport?.date||''),operatingStatus:'未有營業狀態讀回',observedAt:now,freshness:'PARTIAL'}:undefined;
  return{
    globalState:Object.keys(snapshot).length||mappedOrders.length||reportRows.length?'PARTIAL':'EMPTY',
    ...(store?{store}:{}),...(today?{today}:{}),
    liveOrders:{activeCount:activeOrders.length,readyCount:activeOrders.filter(order=>order.fulfillmentLabel==='可取餐').length,recentOrders:activeOrders.slice(0,10).map(order=>({orderId:order.orderId,displayCode:order.displayCode,source:order.source,amountLabel:order.currentEffectiveAmountLabel,fulfillmentLabel:order.fulfillmentLabel||'未有交收狀態讀回'})),observedAt:now},
    readiness:[],actions:[],orders:mappedOrders,channels:[],sellability,staff,devices,reports:reportCards,campaigns:[],settlements:[],inventory:[],notifications:[],activity:[],adminLinkLabel:'Admin',observedAt:now,
  };
}

const CUSTOMER_STAGE_BY_FULFILLMENT=Object.freeze({
  '待處理':'RECEIVED',
  '等待店舖確認':'RECEIVED',
  '已接單':'ACCEPTED',
  '進行中':'PREPARING',
  '製作中':'PREPARING',
  '稍有延誤':'DELAYED',
  '可取餐':'READY',
  '已到店':'ARRIVED',
  '已核對':'VERIFIED',
  '核對中':'VERIFIED',
  '已交收':'HANDED_OVER',
  '未能接單':'REJECTED',
  '已拒絕':'REJECTED',
  '已取消':'CANCELED',
  '已完成':'COMPLETED',
});
function customerStageForFulfillment(label){
  return CUSTOMER_STAGE_BY_FULFILLMENT[String(label||'').trim()]||'UNKNOWN';
}
function customerHandoverState(value){
  const state=String(value||'').trim().toUpperCase();
  return ['NOT_ARRIVED','ARRIVED','VERIFIED','HANDED_OVER','COMPLETED','UNKNOWN'].includes(state)?state:'';
}
function customerPickupException(input){
  const source=row(input);
  const raw=String(source.kind||source.type||'').trim().toUpperCase();
  const kind=raw==='CODE_MISMATCH'?'CODE_MISMATCH'
    :raw==='MISSING_BAG'||raw==='BAG_SHORTAGE'?'MISSING_BAG'
      :raw==='SAME_NAME'?'SAME_NAME'
        :raw==='NO_SHOW'?'NO_SHOW'
          :raw?'OTHER':'';
  if(!kind)return null;
  const detail=String(source.detail||source.message||'').trim();
  const observedAt=String(source.observedAt||source.at||'').trim();
  return{
    kind,
    resolved:source.resolved===true,
    ...(detail?{detail}:{}),
    ...(observedAt?{observedAt}:{}),
  };
}
function customerReorderIntentProjection(input){
  return rows(input).flatMap(rawLine=>{
    const line=row(rawLine);
    const productId=String(line.productId||'').trim();
    const productName=String(line.productName||'').trim();
    const quantity=Math.max(1,Math.min(99,Math.floor(Number(line.quantity)||1)));
    if(!productId||!productName)return[];
    const selections=rows(line.selections).flatMap(rawSelection=>{
      const selection=row(rawSelection);
      const optionGroupId=String(selection.optionGroupId||'').trim();
      const optionId=String(selection.optionId||'').trim();
      const optionName=String(selection.optionName||'').trim();
      return optionGroupId&&optionId?[{optionGroupId,optionId,optionName:optionName||optionId}]:[];
    });
    const comboSource=row(line.combo);
    const comboId=String(comboSource.comboId||'').trim();
    const comboName=String(comboSource.comboName||'').trim();
    const comboSelections=rows(comboSource.selections).flatMap(rawSelection=>{
      const selection=row(rawSelection);
      const poolId=String(selection.poolId||'').trim(),groupId=String(selection.groupId||'').trim(),subPoolId=String(selection.subPoolId||'').trim(),choiceId=String(selection.choiceId||'').trim();
      const choiceType=['PRODUCT','LABEL','NONE'].includes(String(selection.choiceType||''))?String(selection.choiceType):'LABEL';
      if(!poolId||!groupId||!subPoolId||!choiceId)return[];
      const product=String(selection.productId||'').trim();
      return[{poolId,groupId,subPoolId,choiceId,choiceType,choiceLabel:String(selection.choiceLabel||choiceId),...(product?{productId:product}:{})}];
    });
    const selectedVariationId=String(line.selectedVariationId||'').trim();
    const selectedVariationName=String(line.selectedVariationName||'').trim();
    const note=String(line.note||'').trim();
    return[{
      productId,productName,quantity,
      ...(selectedVariationId?{selectedVariationId}:{}),
      ...(selectedVariationName?{selectedVariationName}:{}),
      selections,
      ...(comboId&&comboName?{combo:{comboId,comboName,selections:comboSelections}}:{}),
      ...(note?{note}:{}),
    }];
  });
}
function customerPaymentStatusLabel(order){
  const state=String(order.paymentVerificationState||'').trim().toUpperCase();
  if(state==='PENDING')return '付款憑證待店舖核對';
  if(state==='VERIFIED')return '付款憑證已核對';
  if(state==='REJECTED')return '付款憑證未通過';
  const payment=String(order.paymentLabel||'').trim();
  return payment||'';
}
export function mapCustomerOrderProjection(input){
  const order=row(input);
  const baseStage=customerStageForFulfillment(order.fulfillmentLabel);
  const canonicalHandover=customerHandoverState(order.handoverState||order.pickupState);
  const pickupException=customerPickupException(order.pickupException);
  let stage=canonicalHandover==='ARRIVED'?'ARRIVED'
    :canonicalHandover==='VERIFIED'?'VERIFIED'
      :canonicalHandover==='HANDED_OVER'?'HANDED_OVER'
        :canonicalHandover==='COMPLETED'?'COMPLETED'
          :baseStage;
  if(pickupException&&pickupException.resolved!==true)stage='PICKUP_EXCEPTION';
  const observedAt=String(order.updatedAt||order.createdAt||'').trim();
  const itemRows=rows(order.items);
  const historicalLines=itemRows.map(rawItem=>{
    const item=row(rawItem);
    const quantity=Math.max(0,Math.floor(Number(item.qty)||0));
    const unitMinor=Math.max(0,Math.round(Number(item.unitMinor)||0));
    return{
      name:String(item.name||''),
      quantity,
      historicalUnitLabel:moneyLabel(unitMinor),
      historicalLineTotalLabel:moneyLabel(unitMinor*quantity),
      ...(item.detail?{detail:String(item.detail)}:{}),
    };
  }).filter(item=>item.name&&item.quantity>0);
  const reorderIntent=customerReorderIntentProjection(order.customerReorderIntent);
  const reorderPriceFacts=rows(order.customerReorderHistoryPriceFacts).flatMap(rawFact=>{
    const fact=row(rawFact);
    const intentIndex=Number(fact.intentIndex);
    const historicalPublishedUnitMinor=Number(fact.historicalPublishedUnitMinor);
    if(!Number.isSafeInteger(intentIndex)||intentIndex<0)return[];
    return[{intentIndex,...(Number.isSafeInteger(historicalPublishedUnitMinor)&&historicalPublishedUnitMinor>=0?{historicalPublishedUnitMinor}:{})}];
  });
  const display=String(order.display||'');
  const totalMinor=Math.max(0,Number(order.totalMinor)||0);
  const projectedPickup=String(order.pickupCode||'').replace(/\D/g,'').slice(-4);
  const phoneDigits=String(order.customerPhone||'').replace(/\D/g,'');
  const pickupCode=projectedPickup||(phoneDigits.length>=4?phoneDigits.slice(-4):'');
  const etaLabel=String(order.etaLabel||order.promisedReadyLabel||'').trim();
  const reason=stage==='CANCELED'
    ?String(order.cancellationReason||'').trim()
    :stage==='REJECTED'
      ?String(order.rejectionReason||'').trim()
      :'';
  const paymentStatusLabel=customerPaymentStatusLabel(order);
  const canonicalTimeline=rows(order.fulfillmentHistory).flatMap(raw=>{
    const entry=row(raw);
    const rawLabel=String(entry.label||entry.state||'').trim();
    if(!rawLabel)return[];
    const at=String(entry.at||entry.atLabel||entry.observedAt||'').trim();
    if(!at)return[];
    return[{at,stage:customerStageForFulfillment(rawLabel),label:rawLabel,...(entry.detail?{detail:String(entry.detail)}:{})}];
  });
  const timelineCompletedAt=[...canonicalTimeline].reverse().find(item=>item.stage==='COMPLETED')?.at||'';
  const completedAt=String(order.completedAt||timelineCompletedAt||'').trim();
  const customerDisplayName=String(order.customerName||order.customerDisplayName||'').trim();
  const pickupBagCount=Number(order.pickupBagCount);
  const pickupMealCount=Number(order.pickupMealCount);
  return{
    orderId:String(order.orderId||''),
    displayCode:display,
    stage,
    itemSummary:itemRows.map(item=>String(row(item).name||'')).filter(Boolean).join('、'),
    amountLabel:moneyLabel(totalMinor),
    historicalLines,
    ...(reorderIntent.length?{reorderIntent}:{}),
    ...(reorderPriceFacts.length?{reorderPriceFacts}:{}),
    ...(paymentStatusLabel?{paymentStatusLabel}:{}),
    ...(pickupCode?{pickupCode,phoneMasked:'•••• '+pickupCode}:{}),
    ...(etaLabel?{etaLabel}:{}),
    ...(reason?{rejectionReason:reason}:{}),
    ...(customerDisplayName?{customerDisplayName}:{}),
    ...(canonicalHandover?{handoverState:canonicalHandover}:{}),
    ...(Number.isSafeInteger(pickupBagCount)&&pickupBagCount>=0?{pickupBagCount}:{}),
    ...(Number.isSafeInteger(pickupMealCount)&&pickupMealCount>=0?{pickupMealCount}:{}),
    ...(completedAt?{completedAt}:{}),
    ...(pickupException?{pickupException}:{}),
    observedAt,
    readback:observedAt?'CONFIRMED':'UNKNOWN',
    timeline:canonicalTimeline.length?canonicalTimeline:(observedAt?[{at:observedAt,stage,label:String(order.fulfillmentLabel||stage)}]:[]),
  };
}

function customerPublicSnapshot(active,customerOrders=[],runtimeSellability=[]){
  const snapshot=row(active?.snapshot);
  const catalog=row(snapshot.catalog);
  const optionCenter=row(snapshot.optionCenter);
  const availability=row(snapshot.availability);
  const runtimeAvailability=new Map(rows(runtimeSellability).map(raw=>{const item=row(raw);return[String(item.nodeId||''),String(item.status||'available')]}).filter(([id])=>id));
  const runtimeAvailable=nodeId=>!['soldout','paused'].includes(runtimeAvailability.get(nodeId)||'available');
  const productMedia=row(snapshot.productMedia);
  const categories=rows(catalog.categories)
    .map((raw,index)=>{const item=row(raw);return{id:String(item.id||''),name:String(item.name||''),position:Number(item.position??index*10),active:item.active!==false};})
    .filter(item=>item.id&&item.name&&item.active)
    .sort((a,b)=>a.position-b.position||a.id.localeCompare(b.id));
  const categoryIds=new Set(categories.map(item=>item.id));
  const sets=new Map(rows(optionCenter.sets).map(raw=>{const item=row(raw);return[String(item.id||''),item]}).filter(([id])=>id));
  const linksByProduct=new Map();
  for(const raw of rows(optionCenter.productLinks)){
    const link=row(raw),productId=String(link.productId||''),setId=String(link.setId||'');
    if(!productId||!setId)continue;
    const current=linksByProduct.get(productId)||[];
    current.push({setId});
    linksByProduct.set(productId,current);
  }
  const catalogProducts=rows(catalog.products);
  const rawProductById=new Map(catalogProducts.map(raw=>{const item=row(raw);return[String(item.id||''),item]}).filter(([id])=>id));
  const productAvailableForCombo=productId=>{
    const item=rawProductById.get(productId);
    if(!item)return false;
    const priceText=String(item.basePrice??'').trim();
    const priceReady=priceText!==''&&Number.isFinite(Number(priceText));
    const sellability=row(availability[productId]);
    return item.active!==false&&runtimeAvailable(productId)&&priceReady;
  };
  const comboPools=rows(catalog.comboPools)
    .map(poolRaw=>{
      const pool=row(poolRaw);
      const kind=pool.kind==='ADDON'?'ADDON':'MAIN_COURSE';
      const groups=rows(pool.groups)
        .map(groupRaw=>{
          const group=row(groupRaw);
          const choices=rows(group.choices)
            .map(choiceRaw=>{
              const choice=row(choiceRaw);
              return{
                choiceId:String(choice.id||''),
                choiceType:choice.choiceType==='LABEL'?'LABEL':choice.choiceType==='NONE'?'NONE':'PRODUCT',
                productId:String(choice.productId||'')||undefined,
                label:String(choice.label||''),
                bandId:String(choice.bandId||''),
                publishedAdjustmentMinor:minorFromMoney(choice.priceAdjustment),
                active:choice.active!==false,
                position:Number(choice.position||0),
              };
            })
            .filter(choice=>choice.choiceId&&choice.active);
          const subPools=rows(group.bands)
            .map(bandRaw=>{
              const band=row(bandRaw);
              const subPoolId=String(band.id||'');
              return{
                subPoolId,
                name:String(band.name||subPoolId),
                publishedAdjustmentMinor:minorFromMoney(band.priceAdjustment),
                active:band.active!==false,
                position:Number(band.position||0),
                choices:choices
                  .filter(choice=>choice.bandId===subPoolId)
                  .sort((a,b)=>a.position-b.position||a.choiceId.localeCompare(b.choiceId))
                  .map(({bandId,position,active,...choice})=>({
                    ...choice,
                    label:choice.choiceType==='PRODUCT'
                      ?String(rawProductById.get(choice.productId)?.name||choice.label||choice.productId||'')
                      :choice.label,
                    available:runtimeAvailable('COMBO_CHILD:'+choice.choiceId)&&(choice.choiceType!=='PRODUCT'||productAvailableForCombo(choice.productId)),
                  })),
              };
            })
            .filter(subPool=>subPool.subPoolId&&subPool.active)
            .sort((a,b)=>a.position-b.position||a.subPoolId.localeCompare(b.subPoolId))
            .map(({active,position,...subPool})=>subPool);
          return{
            groupId:String(group.id||''),
            name:String(group.name||group.id||''),
            required:group.required!==false,
            minSelections:Math.max(0,Number(group.min)||0),
            maxSelections:Math.max(1,Number(group.max)||1),
            position:Number(group.position||0),
            subPools,
          };
        })
        .filter(group=>group.groupId)
        .sort((a,b)=>a.position-b.position||a.groupId.localeCompare(b.groupId))
        .map(({position,...group})=>group);
      return{
        poolId:String(pool.id||''),
        name:String(pool.name||pool.id||''),
        kind,
        ...(kind==='ADDON'?{addonKind:pool.addonKind==='DRINK'?'DRINK':'SNACK'}:{}),
        groups,
      };
    })
    .filter(pool=>pool.poolId);
  const comboPoolById=new Map(comboPools.map(pool=>[pool.poolId,pool]));
  const combos=rows(catalog.combos)
    .map(comboRaw=>{
      const combo=row(comboRaw);
      return{
        comboId:String(combo.id||''),
        name:String(combo.name||combo.id||''),
        publishedBasePriceMinor:minorFromMoney(combo.basePrice),
        mainPoolId:String(combo.mainPoolId||'')||undefined,
        addonPoolIds:rows(combo.addonPoolIds).map(value=>String(value||'')).filter(Boolean),
        active:combo.active!==false,
      };
    })
    .filter(combo=>combo.comboId&&combo.active)
    .map(({active,...combo})=>combo);
  const uniqueComboIdForProduct=productId=>{
    const matches=combos.filter(combo=>{
      if(!combo.mainPoolId)return false;
      const pool=comboPoolById.get(combo.mainPoolId);
      return Boolean(pool&&pool.kind==='MAIN_COURSE'&&pool.groups.some(group=>
        group.subPools.some(subPool=>subPool.choices.some(choice=>
          choice.choiceType==='PRODUCT'&&choice.productId===productId
        ))
      ));
    });
    return matches.length===1?matches[0].comboId:undefined;
  };
  const products=catalogProducts
    .map(raw=>{
      const item=row(raw);
      const productId=String(item.id||'');
      const categoryId=String(item.categoryId||'');
      const sellability=row(availability[productId]);
      const media=row(productMedia[productId]);
      const optionGroups=(linksByProduct.get(productId)||[]).flatMap(link=>{
        const set=sets.get(link.setId);
        if(!set||set.active===false)return[];
        const options=rows(set.options)
          .map(optionRaw=>{const option=row(optionRaw);return{
            optionId:String(option.id||option.code||''),
            name:String(option.name||option.id||option.code||''),
            available:option.active!==false&&runtimeAvailable('OPTION:'+String(option.id||option.code||'')),
            publishedAdjustmentMinor:minorFromMoney(option.priceAdjustment),
            position:Number(option.position||0),
          }})
          .filter(option=>option.optionId&&option.name)
          .sort((a,b)=>a.position-b.position||a.optionId.localeCompare(b.optionId))
          .map(({position,...option})=>option);
        return[{
          optionGroupId:String(set.id),
          name:String(set.name||set.id||'選項'),
          required:set.required===true,
          minSelections:Math.max(0,Number(set.min)||0),
          maxSelections:Math.max(1,Number(set.max)||1),
          options,
        }];
      });
      const priceText=String(item.basePrice??'').trim();
      const priceReady=priceText!==''&&Number.isFinite(Number(priceText));
      const baseMinor=minorFromMoney(priceText);
      const takeawayMinor=minorFromMoney(item.takeawayAdjustment)+(item.takeawaySurchargeEnabled===true?100:0);
      const imageUrl=String(media.publicUrl||media.canonicalImageRef||item.imageRef||'').trim();
      return{
        productId,
        categoryId,
        name:String(item.name||productId),
        description:String(item.description||''),
        available:item.active!==false&&runtimeAvailable(productId)&&priceReady,
        ...(priceReady?{displayPriceLabel:moneyLabel(baseMinor+takeawayMinor),publishedUnitPriceMinor:baseMinor+takeawayMinor}:{}),
        ...(imageUrl?{imageUrl,imageAlt:String(item.name||productId)}:{}),
        optionGroups,
        ...(uniqueComboIdForProduct(productId)?{comboId:uniqueComboIdForProduct(productId)}:{}),
        position:Number(item.legacySourcePosition??item.position??0),
      };
    })
    .filter(item=>item.productId&&categoryIds.has(item.categoryId))
    .sort((a,b)=>a.position-b.position||a.productId.localeCompare(b.productId))
    .map(({position,...item})=>item);
  const settings=row(snapshot.storeSettings);
  const defaultPaymentChannels=[
    {id:'ALIPAY',name:'AlipayHK',enabled:true,qrImageUrl:'',sortOrder:1},
    {id:'WECHAT',name:'WeChat Pay HK',enabled:true,qrImageUrl:'',sortOrder:2},
    {id:'FPS',name:'轉數快',enabled:true,qrImageUrl:'',sortOrder:3},
    {id:'PAYME',name:'PayMe',enabled:true,qrImageUrl:'',sortOrder:4},
  ];
  const configuredPaymentChannels=Array.isArray(settings.customerPaymentChannels)?settings.customerPaymentChannels:defaultPaymentChannels;
  const paymentChannels=configuredPaymentChannels
    .map((raw,index)=>{const item=row(raw);const channelId=String(item.id||'').trim().toUpperCase();const label=String(item.name||'').trim();const url=String(item.qrImageUrl||'').trim();return{
      channelId,
      label,
      enabled:item.enabled!==false,
      sortOrder:Number(item.sortOrder??index+1),
      qrImageUrl:url.startsWith('https://')?url:'',
    };})
    .filter(item=>/^[A-Z0-9][A-Z0-9_-]{1,39}$/.test(item.channelId)&&item.label&&item.enabled)
    .sort((a,b)=>a.sortOrder-b.sortOrder||a.channelId.localeCompare(b.channelId))
    .map(({enabled,sortOrder,qrImageUrl,...item})=>({...item,...(qrImageUrl?{qrImageUrl}:{})}));
  const rawWhatsappDigits=String(settings.customerWhatsAppNumber||'').replace(/\D/g,'').slice(0,15);
  const whatsappDigits=rawWhatsappDigits.length===8?'852'+rawWhatsappDigits:rawWhatsappDigits;
  const fallbackTemplate=String(settings.customerWhatsAppTemplate||'你好，我想經 WhatsApp 落單。\n姓名：{name}\n電話：{phone}\n餐點：\n{items}\n總額：{total}\n網上自動接單暫時未能連接，請人工確認。').trim().slice(0,2000);
  const customerFallback={
    enabled:settings.customerWhatsAppEnabled!==false&&whatsappDigits.length>=8&&Boolean(fallbackTemplate),
    phone:whatsappDigits,
    template:fallbackTemplate,
    retryAttempts:3,
  };
  const customerPresentation=row(row(snapshot.presentation).customer);
  const customerChannel=row(snapshot.customerChannelPolicy);
  const channelAvailable=customerChannel.enabled===true;
  const projectedOrders=customerOrders.map(mapCustomerOrderProjection).filter(order=>order.orderId&&order.displayCode);
  return{
    store:{
      storeId:String(active?.storeId||'MF01'),
      storeName:String(settings.storeName||'磨飯'),
      channelAvailable,
      notice:typeof customerPresentation.body==='string'&&customerPresentation.body.trim()?customerPresentation.body.trim():undefined,
      observedAt:new Date().toISOString(),
    },
    menu:{
      revision:String(active?.revision??'0'),
      observedAt:new Date().toISOString(),
      categories:categories.map(item=>({categoryId:item.id,name:item.name,sortOrder:item.position})),
      products,
      combos,
      comboPools,
    },
    paymentChannels,
    fallback:customerFallback,
    activeOrders:projectedOrders.filter(order=>order.stage!=='COMPLETED').map(order=>{
      const {historicalLines:_historicalLines,reorderIntent:_reorderIntent,reorderPriceFacts:_reorderPriceFacts,...activeOrder}=order;
      return activeOrder;
    }),
    history:projectedOrders.filter(order=>order.stage==='COMPLETED').map(order=>({
      orderId:order.orderId,
      displayCode:order.displayCode,
      completedAt:order.completedAt||'',
      itemSummary:order.itemSummary,
      amountLabel:order.amountLabel,
      historicalLines:order.historicalLines,
      ...(order.pickupCode?{pickupCode:order.pickupCode}:{}),
      ...(order.customerDisplayName?{customerDisplayName:order.customerDisplayName}:{}),
      ...(order.reorderIntent?.length?{reorderIntent:order.reorderIntent}:{}),
      ...(order.reorderPriceFacts?.length?{reorderPriceFacts:order.reorderPriceFacts}:{}),
      reorderEligible:Boolean(order.reorderIntent?.length),
    })),
    observedAt:new Date().toISOString(),
  };
}

export class AdminSyncStore{
  constructor(state,env){this.state=state;this.env=env;}

  async authorizePublish(request){
    const origin=request.headers.get('origin');
    const site=request.headers.get('sec-fetch-site');
    if(origin!==ADMIN_ORIGIN)return false;
    if(site&&site!=='same-origin')return false;
    const key=(request.headers.get('x-mfk-admin-publish-key')||'').trim();
    if(key.length<32||key.length>256)return false;
    const incoming=await sha256(key);
    const enrolled=await this.state.storage.get('publisherKeyHash');
    if(!enrolled){
      await this.state.storage.put('publisherKeyHash',incoming);
      await this.state.storage.put('publisherEnrolledAt',new Date().toISOString());
      return true;
    }
    return enrolled===incoming;
  }

  async authorizeAdminRead(request){
    const origin=request.headers.get('origin');
    const site=request.headers.get('sec-fetch-site');
    if(origin!==ADMIN_ORIGIN)return false;
    if(site&&site!=='same-origin')return false;
    const sessionToken=(request.headers.get('x-mfk-admin-session')||'').trim();
    if(sessionToken){
      const session=await this.readAdminBrowserSession(request);
      if(session)return true;
    }
    const key=(request.headers.get('x-mfk-admin-publish-key')||'').trim();
    if(key.length<32||key.length>256)return false;
    const enrolled=await this.state.storage.get('publisherKeyHash');
    if(!enrolled)return false;
    return enrolled===await sha256(key);
  }

  async authorizeProjectionWrite(request,events){
    if(request.headers.get('origin')!==SMT_ORIGIN)return false;
    const acks=await this.state.storage.get('acks')||{};
    return events.every(event=>Boolean(acks[event.deviceId]));
  }
  async authorizeSmtDevice(request){
    if(request.headers.get('origin')!==SMT_ORIGIN)return false;
    const url=new URL(request.url);
    const deviceId=(url.searchParams.get('deviceId')||'').trim();
    if(!deviceId)return false;
    const acks=await this.state.storage.get('acks')||{};
    return Boolean(acks[deviceId]);
  }


  async staffIdentity(loginId,purpose='OWNER'){
    const active=await this.state.storage.get('active');if(!active)return null;
    const auth=row(row(active.snapshot).staffAuth);
    const candidates=rows(auth.staff).map(row).filter(item=>item.active!==false);
    const requested=String(loginId||'').trim();
    if(!requested)return null;
    let matches=candidates.filter(item=>String(item.loginId||'').trim()===requested);
    if(!matches.length){
      matches=candidates.filter(item=>!String(item.loginId||'').trim()&&(String(item.staffId||'')===requested||String(item.name||'')===requested));
    }
    if(matches.length!==1)return null;
    const staff=matches[0];
    if(purpose==='OWNER'&&String(staff.role)!=='OWNER')return null;
    if(purpose==='ADMIN'&&String(staff.role)!=='OWNER'&&!Boolean(staff.adminLogin))return null;
    const verifier=row(staff.pinVerifier);
    if(verifier.algorithm!=='PBKDF2-SHA256'||!Number.isSafeInteger(Number(verifier.iterations))||Number(verifier.iterations)<100000)return null;
    if(!/^[0-9a-f]+$/i.test(String(verifier.saltHex||''))||!/^[0-9a-f]{64}$/i.test(String(verifier.hashHex||'')))return null;
    return{active,staff,verifier,loginId:String(staff.loginId||requested)};
  }
  async staffIdentityById(staffId,purpose='OWNER'){
    const active=await this.state.storage.get('active');if(!active)return null;
    const auth=row(row(active.snapshot).staffAuth);
    const staff=rows(auth.staff).map(row).find(item=>String(item.staffId||'')===String(staffId||'')&&item.active!==false);
    if(!staff)return null;
    if(purpose==='OWNER'&&String(staff.role)!=='OWNER')return null;
    if(purpose==='ADMIN'&&String(staff.role)!=='OWNER'&&!Boolean(staff.adminLogin))return null;
    const verifier=row(staff.pinVerifier);
    if(verifier.algorithm!=='PBKDF2-SHA256'||!Number.isSafeInteger(Number(verifier.iterations))||Number(verifier.iterations)<100000)return null;
    if(!/^[0-9a-f]+$/i.test(String(verifier.saltHex||''))||!/^[0-9a-f]{64}$/i.test(String(verifier.hashHex||'')))return null;
    return{active,staff,verifier,loginId:String(staff.loginId||staff.name||staff.staffId||'')};
  }
  async ownerIdentity(loginId){return this.staffIdentity(loginId,'OWNER');}
  async readOwnerSession(request){
    const token=String(request.headers.get('x-mfk-owner-session')||'').trim();if(token.length<32||token.length>256)return null;
    const key='owner:session:'+await sha256(token);const session=await this.state.storage.get(key);if(!session)return null;
    const expiresAt=Date.parse(String(session.expiresAt||''));if(!Number.isFinite(expiresAt)||expiresAt<=Date.now()){await this.state.storage.delete(key);return null;}
    const current=await this.staffIdentityById(String(session.staffId||''),'OWNER');if(!current){await this.state.storage.delete(key);return null;}
    const value={staffId:String(current.staff.staffId||''),loginId:String(current.loginId||''),displayName:String(current.staff.name||current.staff.staffId||''),role:'OWNER',scope:String(current.staff.scope||'STORE'),permissions:rows(current.staff.permissions).map(String),sessionToken:token,createdAt:String(session.createdAt||''),expiresAt:String(session.expiresAt||''),lastSeenAt:new Date().toISOString()};
    await this.state.storage.put(key,{...session,staffId:value.staffId,lastSeenAt:value.lastSeenAt});return value;
  }
  async readAdminBrowserSession(request){
    const token=String(request.headers.get('x-mfk-admin-session')||'').trim();if(token.length<32||token.length>256)return null;
    const key='admin-browser:session:'+await sha256(token);const session=await this.state.storage.get(key);if(!session)return null;
    const expiresAt=Date.parse(String(session.expiresAt||''));if(!Number.isFinite(expiresAt)||expiresAt<=Date.now()){await this.state.storage.delete(key);return null;}
    const current=await this.staffIdentityById(String(session.staffId||''),'ADMIN');if(!current){await this.state.storage.delete(key);return null;}
    const value={staffId:String(current.staff.staffId||''),loginId:String(current.loginId||''),displayName:String(current.staff.name||current.staff.staffId||''),role:String(current.staff.role||''),scope:String(current.staff.scope||'STORE'),permissions:rows(current.staff.permissions).map(String),sessionToken:token,createdAt:String(session.createdAt||''),expiresAt:String(session.expiresAt||''),lastSeenAt:new Date().toISOString()};
    await this.state.storage.put(key,{...session,staffId:value.staffId,lastSeenAt:value.lastSeenAt});return value;
  }
  async publishEnvelope(envelope){
    const current=await this.state.storage.get('active');
    if(current&&envelope.adminFingerprint===current.adminFingerprint&&JSON.stringify(envelope.snapshot)===JSON.stringify(current.snapshot)){
      return{status:200,body:{state:'IDEMPOTENT',active:current,sourceFingerprint:envelope.fingerprint}};
    }
    const currentMeta=await this.state.storage.get('activeMeta')||{};
    const currentPublishedAt=Date.parse(String(current?.publishedAt||''));
    const currentAcceptedAt=Date.parse(String(currentMeta.acceptedAt||''));
    const floor=Math.max(
      Number.isFinite(currentPublishedAt)?currentPublishedAt+1:0,
      Number.isFinite(currentAcceptedAt)?currentAcceptedAt+1:0,
      Date.now(),
    );
    const publishedAt=new Date(floor).toISOString();
    const canonicalRevision=Math.max(0,Math.floor(Number(current?.revision)||0))+1;
    const canonical=createMfkAdminConfigEnvelope({
      storeId:envelope.storeId,
      revision:canonicalRevision,
      publishedAt,
      adminFingerprint:envelope.adminFingerprint,
      snapshot:envelope.snapshot,
    });
    await this.state.storage.put('active',canonical);
    await this.state.storage.put('activeMeta',{
      revision:canonical.revision,
      fingerprint:canonical.fingerprint,
      publishedAt:canonical.publishedAt,
      acceptedAt:canonical.publishedAt,
      sourceRevision:envelope.revision,
      sourceFingerprint:envelope.fingerprint,
    });
    const doorbell=JSON.stringify({
      type:'ADMIN_CONFIG_AVAILABLE',
      storeId:canonical.storeId,
      revision:canonical.revision,
      fingerprint:canonical.fingerprint,
      publishedAt:canonical.publishedAt,
      acceptedAt:canonical.publishedAt,
    });
    for(const socket of this.state.getWebSockets()){try{socket.send(doorbell);}catch{}}
    return{status:200,body:{state:'PUBLISHED',active:canonical,sourceFingerprint:envelope.fingerprint}};
  }
  async ownerChannels(active,observedAt=new Date().toISOString(),freshReadback=false){
    let keetaStatus=null,customerHealth=null;
    try{
      const id=this.env.KEETA_RUNTIME.idFromName('MF01'),stub=this.env.KEETA_RUNTIME.get(id);
      if(freshReadback)await stub.fetch(new Request('https://internal/admin/store/readback',{method:'POST'}));
      const response=await stub.fetch(new Request('https://internal/admin/store/status',{method:'GET'}));
      if(response.ok){
        keetaStatus=await response.json();
        const intakeResponse=await stub.fetch(new Request('https://internal/admin/orders/intake',{method:'GET'}));
        if(intakeResponse.ok)keetaStatus={...keetaStatus,orderDiagnostics:(await intakeResponse.json()).items??[]};
      }
    }catch{}
    try{
      const id=this.env.CUSTOMER_RUNTIME.idFromName('MF01'),stub=this.env.CUSTOMER_RUNTIME.get(id);
      const response=await stub.fetch(new Request('https://internal/public/channel-health',{method:'GET'}));
      if(response.ok)customerHealth=await response.json();
    }catch{}
    return Object.freeze([
      normalizeOwnerKeetaChannel(keetaStatus,observedAt),
      normalizeOwnerOwnPlatformChannel(active,customerHealth,observedAt),
    ]);
  }
  async ownerReadModel(){
    const observedAt=new Date().toISOString();
    const [active,orders,reports,acks,activity]=await Promise.all([this.state.storage.get('active'),this.projectionOrders(),this.projectionReports(),this.state.storage.get('acks'),this.ownerActivityRows()]);
    const base=buildOwnerReadModelSnapshot({active,orders,reports,acks:acks||{},observedAt});
    const [channels,planning]=await Promise.all([
      this.ownerChannels(active,observedAt),
      this.ownerPlanningSnapshot(hktMonthKey(observedAt),observedAt),
    ]);
    return Object.freeze({...base,channels,planning,activity:Object.freeze(activity)});
  }

  async ownerSellabilityReadModel(observedAt=new Date().toISOString()){
    const active=await this.state.storage.get('active');
    if(!active)return Object.freeze([]);
    return ownerSellabilityTargets(row(active.snapshot),observedAt);
  }
  async ownerSellabilityCommand(session,input){
    const operationId=String(input?.operationId||'').trim().slice(0,160);
    if(!operationId)return{state:'UNKNOWN',message:'缺少 operation identity',targets:[]};
    const operationKey='owner:sellability:operation:'+operationId;
    const prior=await this.state.storage.get(operationKey);
    if(prior)return prior.result;
    const action=String(input?.action||'').toUpperCase();
    if(!['SOLD_OUT','PAUSE','RESTORE'].includes(action))return{state:'UNKNOWN',message:'售罄操作格式無效',targets:[]};
    const requested=rows(input?.targets).slice(0,50);
    if(!requested.length)return{state:'UNKNOWN',message:'未有操作目標',targets:[]};
    const active=await this.state.storage.get('active');
    if(!active)return{state:'UNKNOWN',message:'Admin base catalog 未有 active revision',targets:[]};
    const snapshot=row(active.snapshot),resolved=[],rejected=[];
    for(const rawTarget of requested){
      const target=row(rawTarget),grain=String(target.grain||'').toUpperCase(),targetId=String(target.targetId||'').trim();
      const found=ownerResolveSellabilityTarget(snapshot,grain,targetId);
      if(!found){rejected.push({targetId,grain,state:'REJECTED',message:'目標不存在'});continue;}
      resolved.push(found);
    }
    if(!resolved.length){
      const result={state:'UNKNOWN',message:'冇有效目標可以套用',targets:Object.freeze(rejected)};
      await this.state.storage.put(operationKey,{result,createdAt:new Date().toISOString()});
      return result;
    }
    const createdAt=new Date().toISOString();
    const command=Object.freeze({
      operationId,action,
      targets:Object.freeze(resolved.map(target=>Object.freeze({targetId:target.targetId,grain:target.grain,name:target.name}))),
      reason:String(input?.reason||'').trim().slice(0,160),
      requestedBy:String(session.staffId||session.loginId||'OWNER'),
      createdAt,
      state:'PENDING_SMT',
    });
    await this.state.storage.put('owner:sellability:command:'+operationId,command);
    const result={state:'UNKNOWN',message:'已送往店舖執行；等待 SMT Runtime readback',targets:Object.freeze([...rejected,...resolved.map(target=>({...target,state:'UNKNOWN'}))])};
    await this.state.storage.put(operationKey,{result,createdAt});
    const doorbell=JSON.stringify({type:'OWNER_SELLABILITY_COMMAND_AVAILABLE',storeId:String(active.storeId||'MF01'),operationId,receivedAt:createdAt});
    for(const socket of this.state.getWebSockets()){try{socket.send(doorbell);}catch{}}
    await this.appendOwnerActivity(session,{operationId,title:'售罄／恢復',target:resolved.map(item=>item.name).join('、'),result:'PENDING_SMT',readback:'等待 SMT Runtime'});
    return result;
  }

  async pendingOwnerSellabilityCommands(){
    const rows=await this.state.storage.list({prefix:'owner:sellability:command:'});
    return [...rows.values()].filter(value=>value?.state==='PENDING_SMT').slice(0,100);
  }

  async projectionOrders(){
    const rows=await this.state.storage.list({prefix:'projection:order:'});
    return [...rows.values()]
      .map(row=>row?.payload)
      .filter(Boolean)
      .sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||'')));
  }

  async adminRefunds(){
    const rows=await this.state.storage.list({prefix:'admin:refund:'});
    return [...rows.values()]
      .map(row=>row?.refund??row)
      .filter(Boolean)
      .map(row=>{try{return validateAdminRefundEvent(row);}catch{return null;}})
      .filter(Boolean)
      .sort((a,b)=>String(b.executionAt||'').localeCompare(String(a.executionAt||'')));
  }

  async adminRefundAddenda(){
    const rows=await this.state.storage.list({prefix:'admin:day-close-addendum:'});
    return [...rows.values()]
      .filter(Boolean)
      .sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
  }

  async ownerActivityRows(){
    const values=await this.state.storage.list({prefix:'owner:activity:'});
    return [...values.values()].filter(Boolean).sort((a,b)=>String(b.observedAt||'').localeCompare(String(a.observedAt||''))).slice(0,200);
  }
  async appendOwnerActivity(session,input){
    const observedAt=new Date().toISOString();
    const operationId=String(input?.operationId||crypto.randomUUID()).slice(0,160);
    const activity=Object.freeze({
      activityId:'OA-'+operationId,
      title:String(input?.title||'Owner operation').slice(0,160),
      actor:String(session?.displayName||'OWNER'),
      actorStaffId:String(session?.staffId||'').trim()||undefined,
      target:String(input?.target||'').slice(0,240),
      detail:String(input?.detail||'').slice(0,500),
      requester:String(session?.displayName||'OWNER'),
      requesterStaffId:String(session?.staffId||'').trim()||undefined,
      approver:'OWNER',
      approverStaffId:String(session?.staffId||'').trim()||undefined,
      result:String(input?.result||'UNKNOWN').slice(0,40),
      readback:String(input?.readback||'UNKNOWN').slice(0,240),
      observedAt,
    });
    await this.state.storage.put('owner:activity:'+observedAt+':'+operationId,activity);
    return activity;
  }
  async readOwnerMonthlyPlan(monthKey,storeId='MF01'){
    const stored=await this.state.storage.get('owner:planning:'+storeId+':'+monthKey);
    return stored||ownerDefaultPlan(monthKey);
  }
  async ownerPlanningSnapshot(monthKey,observedAt=new Date().toISOString()){
    const [plan,reports,active]=await Promise.all([this.readOwnerMonthlyPlan(monthKey,'MF01'),this.projectionReports(),this.state.storage.get('active')]);
    const currentEffectiveSalesMinor=reports.filter(item=>String(item.date||'').startsWith(monthKey+'-')).reduce((sum,item)=>sum+Math.round(Number(item.netMinor)||0),0);
    const remainingOperatingDays=ownerRemainingOperatingDays(active,monthKey,observedAt);
    return Object.freeze({
      plan,
      metrics:calculateOwnerPlanningMetrics({monthKey,currentEffectiveSalesMinor,plan,observedAt,remainingOperatingDays}),
      observedAt,
      freshness:'CURRENT',
      readback:'CONFIRMED',
    });
  }
  async saveOwnerMonthlyPlan(session,input){
    const monthKey=String(input?.monthKey||'').trim();
    if(!validMonthKey(monthKey))return{state:'REJECTED',message:'月份格式無效'};
    const operationId=String(input?.operationId||'').trim().slice(0,160);
    if(!operationId)return{state:'REJECTED',message:'缺少 operation identity'};
    const operationKey='owner:planning:operation:'+operationId;
    const prior=await this.state.storage.get(operationKey);
    if(prior){
      if(String(prior.monthKey)!==monthKey)return{state:'REJECTED',message:'operation identity 已用於另一個月份'};
      return prior.result;
    }
    const current=await this.readOwnerMonthlyPlan(monthKey,'MF01');
    const expectedRevision=Math.floor(Number(input?.expectedRevision));
    if(expectedRevision!==Number(current.revision||0))return{state:'REJECTED',message:'規劃已被更新，請重新讀取',currentRevision:Number(current.revision||0)};
    const target=Math.round(Number(input?.monthlyRevenueTargetMinor));
    if(!Number.isSafeInteger(target)||target<0)return{state:'REJECTED',message:'營業額目標無效'};
    const rawLines=rows(input?.costLines);
    if(rawLines.length<1||rawLines.length>40)return{state:'REJECTED',message:'成本項目數量無效'};
    const updatedAt=new Date().toISOString(),updatedBy=String(session.staffId||session.loginId||'OWNER');
    let costLines;
    try{costLines=Object.freeze(rawLines.map((line,index)=>normalizedOwnerCostLine(line,index,updatedAt,updatedBy)));}
    catch(error){return{state:'REJECTED',message:error instanceof Error?error.message:'成本資料無效'};}
    const plan=Object.freeze({
      schema:MFK_OWNER_MONTHLY_PLAN_SCHEMA,storeId:'MF01',monthKey,
      monthlyRevenueTargetMinor:target,
      note:String(input?.note||'').trim().slice(0,240),
      revision:Number(current.revision||0)+1,
      updatedAt,updatedBy,costLines,
    });
    await this.state.storage.put('owner:planning:MF01:'+monthKey,plan);
    const readback=await this.state.storage.get('owner:planning:MF01:'+monthKey);
    if(!readback||Number(readback.revision)!==plan.revision){
      const result={state:'UNKNOWN',message:'保存結果未明；請重新讀取'};
      await this.state.storage.put(operationKey,{monthKey,result,createdAt:updatedAt});
      await this.appendOwnerActivity(session,{operationId,title:'營業目標與成本',target:monthKey,result:'UNKNOWN',readback:'CANONICAL_READBACK_MISMATCH'});
      return result;
    }
    const result={state:'CONFIRMED',message:'規劃已保存並完成 canonical readback',snapshot:await this.ownerPlanningSnapshot(monthKey)};
    await this.state.storage.put(operationKey,{monthKey,result,createdAt:updatedAt});
    await this.appendOwnerActivity(session,{operationId,title:'營業目標與成本',target:monthKey,result:'CONFIRMED',readback:'revision '+String(plan.revision)});
    return result;
  }

  async businessCutoff(){
    const active=await this.state.storage.get('active');
    const raw=active?.snapshot?.businessDay?.cutoff;
    return /^([01]?\d|2[0-3]):([0-5]\d)$/.test(String(raw||''))?String(raw):'05:00';
  }

  async createAdminRefund(input){
    const orderId=String(input?.orderId||'').trim();
    const lineId=String(input?.lineId||'').trim();
    const quantity=Math.max(0,Math.floor(Number(input?.quantity)||0));
    const amountMinor=Math.max(0,Math.round(Number(input?.amountMinor)||0));
    const method=String(input?.method||'').trim();
    const note=String(input?.note||'').trim().slice(0,500);
    if(!orderId)return {error:'ADMIN_REFUND_ORDER_REQUIRED',status:400};
    if(!lineId)return {error:'ADMIN_REFUND_LINE_REQUIRED',status:400};
    if(quantity<1)return {error:'ADMIN_REFUND_QUANTITY_INVALID',status:400};
    if(amountMinor<1)return {error:'ADMIN_REFUND_AMOUNT_INVALID',status:400};
    if(!['CASH','FPS','PAYME','ALIPAY','WECHAT'].includes(method))return {error:'ADMIN_REFUND_METHOD_INVALID',status:400};

    const orders=await this.projectionOrders();
    const order=orders.find(row=>String(row.orderId||'')===orderId);
    if(!order)return {error:'ADMIN_REFUND_ORDER_NOT_FOUND',status:404};
    if(/^Keeta\b|^Foodpanda\b|^第三方/.test(String(order.sourceLabel||'')))return {error:'PROVIDER_REFUND_USE_AFTERSALE',status:409};
    const line=(Array.isArray(order.items)?order.items:[]).find(row=>String(row?.id||'')===lineId);
    if(!line)return {error:'ADMIN_REFUND_LINE_NOT_FOUND',status:404};
    if(quantity>Math.max(0,Math.floor(Number(line.qty)||0)))return {error:'ADMIN_REFUND_QUANTITY_INVALID',status:400};

    const closes=await this.projectionCashRows('projection:day-close:');
    const originalBusinessDate=String(order.businessDate||'');
    const close=closes.filter(row=>String(row.businessDate||'')===originalBusinessDate)
      .sort((a,b)=>(Number(b.version)||0)-(Number(a.version)||0))[0];
    if(!close)return {error:'ADMIN_REFUND_ORIGINAL_DAY_CLOSE_REQUIRED',status:409};

    const refunds=await this.adminRefunds();
    const embedded=(Array.isArray(order.refunds)?order.refunds:[]).filter(Boolean);
    const allRefunds=[...refunds,...embedded].filter((row,index,rows)=>
      String(row?.orderId||orderId)===orderId&&rows.findIndex(other=>String(other?.refundId||other?.id||'')===String(row?.refundId||row?.id||''))===index
    );
    const lineOriginalMinor=Math.max(0,Math.floor(Number(line.qty)||0)*Math.max(0,Math.round(Number(line.unitMinor)||0)));
    const priorLineRefund=allRefunds.flatMap(row=>Array.isArray(row?.lines)?row.lines:[])
      .filter(row=>String(row?.lineId||'')===lineId)
      .reduce((sum,row)=>sum+Math.max(0,Math.round(Number(row?.amountMinor)||0)),0);
    const lineRemaining=Math.max(0,lineOriginalMinor-priorLineRefund);
    const selectedMax=Math.max(0,quantity*Math.max(0,Math.round(Number(line.unitMinor)||0)));
    if(amountMinor>lineRemaining||amountMinor>selectedMax)return {error:'ADMIN_REFUND_EXCEEDS_LINE_REMAINING',status:409};
    const priorOrderRefund=allRefunds.reduce((sum,row)=>sum+Math.max(0,Math.round(Number(row?.amountMinor)||0)),0);
    if(priorOrderRefund+amountMinor>Math.max(0,Math.round(Number(order.totalMinor)||0))){
      return {error:'ADMIN_REFUND_EXCEEDS_ORDER_REMAINING',status:409};
    }

    const executionAt=new Date().toISOString();
    const cutoff=await this.businessCutoff();
    const executionBusinessDate=hktBusinessDate(executionAt,cutoff);
    const existingAddenda=(await this.adminRefundAddenda()).filter(row=>String(row.businessDate||'')===originalBusinessDate);
    const addendumSequence=existingAddenda.length+1;
    const originalDayCloseVersion=Math.max(1,Math.floor(Number(close.version)||1));
    const refundId='AR-'+crypto.randomUUID();
    const event=validateAdminRefundEvent({
      schema:MFK_ADMIN_REFUND_SCHEMA,
      refundId,
      storeId:'MF01',
      orderId,
      display:String(order.display||orderId),
      originalBusinessDate,
      originalCreatedAt:String(order.createdAt||executionAt),
      executionAt,
      executionBusinessDate,
      method,
      amountMinor,
      lines:[{
        lineId,
        itemName:String(line.name||lineId),
        quantity,
        amountMinor,
      }],
      note,
      source:'ADMIN',
      originalDayCloseVersion,
      addendumSequence,
      addendumVersionLabel:String(originalDayCloseVersion)+'.'+String(addendumSequence),
    });
    const addendum={
      schema:'MFK_DAY_CLOSE_REFUND_ADDENDUM_V1',
      id:'DCA-'+originalBusinessDate+'-'+String(addendumSequence).padStart(3,'0'),
      storeId:'MF01',
      businessDate:originalBusinessDate,
      baseVersion:originalDayCloseVersion,
      addendumSequence,
      versionLabel:event.addendumVersionLabel,
      createdAt:executionAt,
      refundId,
      orderId,
      display:event.display,
      originalCreatedAt:event.originalCreatedAt,
      executionAt,
      executionBusinessDate,
      method,
      amountMinor,
      lines:event.lines,
      note,
      postingMode:'NON_POSTING_REFERENCE',
    };
    await this.state.storage.put('admin:refund:'+refundId,{refund:event});
    await this.state.storage.put(
      'admin:day-close-addendum:'+originalBusinessDate+':'+String(addendumSequence).padStart(6,'0')+':'+refundId,
      addendum,
    );
    const doorbell=JSON.stringify({
      type:'ADMIN_REFUND_AVAILABLE',
      storeId:'MF01',
      refundId,
      orderId,
      executionAt,
      executionBusinessDate,
    });
    for(const socket of this.state.getWebSockets()){
      try{socket.send(doorbell);}catch{}
    }
    return {event,addendum};
  }

  async projectionCashRows(prefix){
    const rows=await this.state.storage.list({prefix});
    return [...rows.values()]
      .map(row=>row?.payload)
      .filter(Boolean)
      .sort((a,b)=>String(b.businessDate||'').localeCompare(String(a.businessDate||'')));
  }

  async projectionReports(){
    const [orders,openings,closes,adminRefunds]=await Promise.all([
      this.projectionOrders(),
      this.projectionCashRows('projection:cash-opening:'),
      this.projectionCashRows('projection:day-close:'),
      this.adminRefunds(),
    ]);
    const cutoff=await this.businessCutoff();
    const byDate=new Map();
    for(const order of orders){
      const date=String(order.businessDate||'');
      if(!date)continue;
      const row=byDate.get(date)||{date,grossMinor:0,adjustmentMinor:0,netMinor:0,orders:0,cashSalesMinor:0};
      const cancelled=String(order.fulfillmentLabel||'')==='已取消';
      if(!cancelled){
        const total=Number.isFinite(Number(order.recognizedSalesMinor))
          ?Math.max(0,Number(order.recognizedSalesMinor)||0)
          :Math.max(0,Number(order.totalMinor)||0);
        row.grossMinor+=total;
        row.netMinor+=total;
        row.orders+=1;
        const label=String(order.paymentLabel||'');
        if(label.toUpperCase().startsWith('COMBO')){
          const match=label.match(/\bCASH\s+\$?([0-9]+(?:\.[0-9]{1,2})?)/i);
          if(match)row.cashSalesMinor+=Math.round(Number(match[1])*100);
        }else if(label.toUpperCase().includes('CASH')||label.includes('現金')){
          row.cashSalesMinor+=total;
        }
      }
      byDate.set(date,row);
    }
    const refundById=new Map();
    for(const order of orders){
      for(const refund of Array.isArray(order.refunds)?order.refunds:[]){
        const id=String(refund?.refundId||refund?.id||'').trim();
        if(!id)continue;
        refundById.set(id,{
          ...refund,
          refundId:id,
          orderId:String(order.orderId||''),
          originalBusinessDate:String(order.businessDate||''),
          executionBusinessDate:hktBusinessDate(String(refund.createdAt||''),cutoff),
          executionAt:String(refund.createdAt||''),
        });
      }
    }
    for(const refund of adminRefunds)refundById.set(refund.refundId,refund);
    for(const refund of refundById.values()){
      const date=String(refund.executionBusinessDate||hktBusinessDate(refund.executionAt,cutoff));
      if(!date)continue;
      const row=byDate.get(date)||{date,grossMinor:0,adjustmentMinor:0,netMinor:0,orders:0,cashSalesMinor:0,refundMinor:0,cashRefundMinor:0};
      const amount=Math.max(0,Math.round(Number(refund.amountMinor)||0));
      row.refundMinor=(Number(row.refundMinor)||0)+amount;
      row.cashRefundMinor=(Number(row.cashRefundMinor)||0)+(isCashMethod(refund.method)?amount:0);
      row.adjustmentMinor=-(Number(row.refundMinor)||0);
      row.netMinor=(Number(row.grossMinor)||0)-(Number(row.refundMinor)||0);
      byDate.set(date,row);
    }
    const openingByDate=new Map(openings.map(row=>[String(row.businessDate||''),row]));
    const closeByDate=new Map(closes.map(row=>[String(row.businessDate||''),row]));
    const dates=new Set([...byDate.keys(),...openingByDate.keys(),...closeByDate.keys()]);
    return [...dates].sort((a,b)=>b.localeCompare(a)).map(date=>({
      ...(()=>{const row=byDate.get(date)||{date,grossMinor:0,adjustmentMinor:0,netMinor:0,orders:0,cashSalesMinor:0,refundMinor:0,cashRefundMinor:0};const refundMinor=Number(row.refundMinor)||0;return {...row,refundMinor,cashRefundMinor:Number(row.cashRefundMinor)||0,adjustmentMinor:-refundMinor,netMinor:(Number(row.grossMinor)||0)-refundMinor};})(),
      openingCash:openingByDate.get(date)||null,
      dayClose:closeByDate.get(date)||null,
    }));
  }

  async fetch(request){
    const url=new URL(request.url);
    if(url.pathname==='/authorize-admin'){
      if(!await this.authorizeAdminRead(request))return json({code:'ADMIN_READ_UNAUTHORIZED'},401);
      return json({ok:true});
    }
    if(url.pathname==='/authorize-publish'){
      if(!await this.authorizePublish(request))return json({code:'ADMIN_PUBLISH_UNAUTHORIZED'},401);
      return json({ok:true});
    }
    if(url.pathname==='/authorize-smt-device'){
      if(!await this.authorizeSmtDevice(request))return json({code:'SMT_DEVICE_UNAUTHORIZED'},401);
      return json({ok:true});
    }

    if(url.pathname==='/owner/auth/challenge'&&request.method==='POST'){
      let body;try{body=await request.json();}catch{return json({code:'OWNER_AUTH_INPUT_INVALID'},400);}
      const loginId=String(body?.loginId||body?.staffId||'').trim(),current=await this.ownerIdentity(loginId);
      if(!current)return json({code:'OWNER_AUTH_UNAVAILABLE',message:'Owner 身份或 PIN 尚未可用'},401);
      const challengeId=crypto.randomUUID(),nonce=crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-',''),expiresAt=new Date(Date.now()+2*60*1000).toISOString();
      await this.state.storage.put('owner:challenge:'+challengeId,{loginId,staffId:String(current.staff.staffId||''),nonce,expiresAt,revision:Number(current.active.revision)||0,fingerprint:String(current.active.fingerprint||'')});
      return json({challengeId,loginId,nonce,saltHex:String(current.verifier.saltHex),iterations:Number(current.verifier.iterations),expiresAt},201);
    }
    if(url.pathname==='/owner/auth/verify'&&request.method==='POST'){
      let body;try{body=await request.json();}catch{return json({code:'OWNER_AUTH_INPUT_INVALID'},400);}
      const loginId=String(body?.loginId||body?.staffId||'').trim(),challengeId=String(body?.challengeId||'').trim(),proofHex=String(body?.proofHex||'').trim().toLowerCase();
      if(!loginId||!challengeId||!(/^[0-9a-f]{64}$/i.test(proofHex)))return json({code:'OWNER_AUTH_PROOF_INVALID'},400);
      const challengeKey='owner:challenge:'+challengeId,challenge=await this.state.storage.get(challengeKey);if(!challenge)return json({code:'OWNER_AUTH_CHALLENGE_NOT_FOUND'},401);
      await this.state.storage.delete(challengeKey);
      if(String(challenge.loginId)!==loginId)return json({code:'OWNER_AUTH_CHALLENGE_MISMATCH'},401);
      if(!Number.isFinite(Date.parse(String(challenge.expiresAt||'')))||Date.parse(String(challenge.expiresAt))<=Date.now())return json({code:'OWNER_AUTH_CHALLENGE_EXPIRED'},401);
      const current=await this.ownerIdentity(loginId);if(!current)return json({code:'OWNER_AUTH_UNAVAILABLE'},401);
      if(String(challenge.staffId)!==String(current.staff.staffId||''))return json({code:'OWNER_AUTH_IDENTITY_CHANGED'},409);
      if(Number(challenge.revision)!==Number(current.active.revision)||String(challenge.fingerprint)!==String(current.active.fingerprint||''))return json({code:'OWNER_AUTH_CONFIG_CHANGED'},409);
      const message='MFK_OWNER_LOGIN_V1\n'+challengeId+'\n'+loginId+'\n'+String(challenge.nonce||''),expected=await ownerHmacHex(String(current.verifier.hashHex),message);
      if(!ownerSameHex(expected,proofHex))return json({code:'OWNER_AUTH_UNAUTHORIZED',message:'PIN 不正確'},401);
      const token=crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-',''),createdAt=new Date().toISOString(),expiresAt=new Date(Date.now()+10*365*24*60*60*1000).toISOString();
      const staffId=String(current.staff.staffId||'');
      await this.state.storage.put('owner:session:'+await sha256(token),{staffId,createdAt,lastSeenAt:createdAt,expiresAt});
      return json({ok:true,staffId,loginId:String(current.loginId||loginId),displayName:String(current.staff.name||loginId),role:'OWNER',scope:String(current.staff.scope||'STORE'),permissions:rows(current.staff.permissions).map(String),sessionToken:token,expiresAt},201);
    }
    if(url.pathname==='/owner/auth/session'){
      if(request.method==='GET'){const session=await this.readOwnerSession(request);return session?json({ok:true,...session}):json({code:'OWNER_SESSION_UNAUTHORIZED'},401);}
      if(request.method==='POST'){const token=String(request.headers.get('x-mfk-owner-session')||'').trim();if(token)await this.state.storage.delete('owner:session:'+await sha256(token));return json({state:'LOGGED_OUT'});}
      return json({code:'METHOD_NOT_ALLOWED'},405);
    }
    if(url.pathname==='/owner/snapshot'&&request.method==='GET'){
      const session=await this.readOwnerSession(request);if(!session)return json({code:'OWNER_SESSION_UNAUTHORIZED'},401);
      return json(await this.ownerReadModel());
    }

    if(url.pathname==='/owner/channels'&&request.method==='GET'){
      const session=await this.readOwnerSession(request);if(!session)return json({code:'OWNER_SESSION_UNAUTHORIZED'},401);
      const observedAt=new Date().toISOString(),active=await this.state.storage.get('active');
      return json({channels:await this.ownerChannels(active,observedAt,true),observedAt});
    }
    if(url.pathname==='/owner/sellability'){
      const session=await this.readOwnerSession(request);if(!session)return json({code:'OWNER_SESSION_UNAUTHORIZED'},401);
      if(request.method==='GET')return json({items:await this.ownerSellabilityReadModel(),observedAt:new Date().toISOString()});
      if(request.method==='POST'){
        let input;try{input=await request.json();}catch{return json({state:'UNKNOWN',message:'售罄操作格式無效',targets:[]},400);}
        return json(await this.ownerSellabilityCommand(session,input));
      }
      return json({code:'METHOD_NOT_ALLOWED'},405);
    }
    if(url.pathname==='/owner/planning'){
      const session=await this.readOwnerSession(request);if(!session)return json({code:'OWNER_SESSION_UNAUTHORIZED'},401);
      if(request.method==='GET'){
        const monthKey=String(url.searchParams.get('monthKey')||hktMonthKey()).trim();
        if(!validMonthKey(monthKey))return json({code:'OWNER_PLAN_MONTH_INVALID'},400);
        return json(await this.ownerPlanningSnapshot(monthKey));
      }
      if(request.method==='POST'){
        let input;try{input=await request.json();}catch{return json({code:'OWNER_PLAN_INPUT_INVALID'},400);}
        return json(await this.saveOwnerMonthlyPlan(session,input));
      }
      return json({code:'METHOD_NOT_ALLOWED'},405);
    }

    if(url.pathname==='/admin-browser/auth/challenge'&&request.method==='POST'){
      let body;try{body=await request.json();}catch{return json({code:'ADMIN_BROWSER_AUTH_INPUT_INVALID'},400);}
      const loginId=String(body?.loginId||'').trim(),current=await this.staffIdentity(loginId,'ADMIN');
      if(!current)return json({code:'ADMIN_BROWSER_AUTH_UNAVAILABLE',message:'Admin 身份或 PIN 尚未可用'},401);
      const challengeId=crypto.randomUUID(),nonce=crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-',''),expiresAt=new Date(Date.now()+2*60*1000).toISOString();
      await this.state.storage.put('admin-browser:challenge:'+challengeId,{loginId,staffId:String(current.staff.staffId||''),nonce,expiresAt,revision:Number(current.active.revision)||0,fingerprint:String(current.active.fingerprint||'')});
      return json({challengeId,loginId,nonce,saltHex:String(current.verifier.saltHex),iterations:Number(current.verifier.iterations),expiresAt},201);
    }
    if(url.pathname==='/admin-browser/auth/verify'&&request.method==='POST'){
      let body;try{body=await request.json();}catch{return json({code:'ADMIN_BROWSER_AUTH_INPUT_INVALID'},400);}
      const loginId=String(body?.loginId||'').trim(),challengeId=String(body?.challengeId||'').trim(),proofHex=String(body?.proofHex||'').trim().toLowerCase();
      if(!loginId||!challengeId||!(/^[0-9a-f]{64}$/i.test(proofHex)))return json({code:'ADMIN_BROWSER_AUTH_PROOF_INVALID'},400);
      const challengeKey='admin-browser:challenge:'+challengeId,challenge=await this.state.storage.get(challengeKey);if(!challenge)return json({code:'ADMIN_BROWSER_AUTH_CHALLENGE_NOT_FOUND'},401);
      await this.state.storage.delete(challengeKey);
      if(String(challenge.loginId)!==loginId)return json({code:'ADMIN_BROWSER_AUTH_CHALLENGE_MISMATCH'},401);
      if(!Number.isFinite(Date.parse(String(challenge.expiresAt||'')))||Date.parse(String(challenge.expiresAt))<=Date.now())return json({code:'ADMIN_BROWSER_AUTH_CHALLENGE_EXPIRED'},401);
      const current=await this.staffIdentity(loginId,'ADMIN');if(!current)return json({code:'ADMIN_BROWSER_AUTH_UNAVAILABLE'},401);
      if(String(challenge.staffId)!==String(current.staff.staffId||''))return json({code:'ADMIN_BROWSER_AUTH_IDENTITY_CHANGED'},409);
      const message='MFK_ADMIN_BROWSER_LOGIN_V1\n'+challengeId+'\n'+loginId+'\n'+String(challenge.nonce||''),expected=await ownerHmacHex(String(current.verifier.hashHex),message);
      if(!ownerSameHex(expected,proofHex))return json({code:'ADMIN_BROWSER_AUTH_UNAUTHORIZED',message:'PIN 不正確'},401);
      const token=crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-',''),createdAt=new Date().toISOString(),expiresAt=new Date(Date.now()+10*365*24*60*60*1000).toISOString(),staffId=String(current.staff.staffId||'');
      await this.state.storage.put('admin-browser:session:'+await sha256(token),{staffId,createdAt,lastSeenAt:createdAt,expiresAt});
      return json({ok:true,staffId,loginId:String(current.loginId||loginId),displayName:String(current.staff.name||loginId),role:String(current.staff.role||''),scope:String(current.staff.scope||'STORE'),permissions:rows(current.staff.permissions).map(String),sessionToken:token,expiresAt},201);
    }
    if(url.pathname==='/admin-browser/auth/session'){
      if(request.method==='GET'){const session=await this.readAdminBrowserSession(request);return session?json({ok:true,...session}):json({code:'ADMIN_BROWSER_SESSION_UNAUTHORIZED'},401);}
      if(request.method==='POST'){const token=String(request.headers.get('x-mfk-admin-session')||'').trim();if(token)await this.state.storage.delete('admin-browser:session:'+await sha256(token));return json({state:'LOGGED_OUT'});}
      return json({code:'METHOD_NOT_ALLOWED'},405);
    }
    if(url.pathname==='/admin-browser/active'&&request.method==='GET'){
      const session=await this.readAdminBrowserSession(request);if(!session)return json({code:'ADMIN_BROWSER_SESSION_UNAUTHORIZED'},401);
      const active=await this.state.storage.get('active');return active?json(active):json({code:'ADMIN_CONFIG_NOT_PUBLISHED'},404);
    }
    if(url.pathname==='/admin-browser/publisher-active'&&request.method==='GET'){
      if(!await this.authorizeAdminRead(request))return json({code:'ADMIN_BROWSER_PUBLISHER_UNAUTHORIZED'},401);
      const active=await this.state.storage.get('active');return active?json(active):json({code:'ADMIN_CONFIG_NOT_PUBLISHED'},404);
    }
    if(url.pathname==='/admin-browser/publish'&&request.method==='POST'){
      const session=await this.readAdminBrowserSession(request);if(!session)return json({code:'ADMIN_BROWSER_SESSION_UNAUTHORIZED'},401);
      if(String(session.role)!=='OWNER'&&!rows(session.permissions).map(String).includes('PUBLISH_CONFIG'))return json({code:'ADMIN_BROWSER_PUBLISH_FORBIDDEN'},403);
      let envelope;try{envelope=validateMfkAdminConfigEnvelope(await request.json());}catch(error){return json({code:error instanceof Error?error.message:'ADMIN_CONFIG_INVALID'},400);}
      const result=await this.publishEnvelope(envelope);return json(result.body,result.status);
    }

    if(url.pathname==='/customer-orders'&&request.method==='GET'){
      const wanted=new Set(url.searchParams.getAll('submissionId').map(value=>String(value).trim()).filter(Boolean).slice(0,24));
      if(!wanted.size)return json({orders:[]});
      const orders=(await this.projectionOrders()).filter(order=>{
        const ref=String(order.externalRef||'');
        return ref.startsWith('CUSTOMER:')&&wanted.has(ref.slice('CUSTOMER:'.length));
      });
      return json({orders});
    }
    if(url.pathname==='/customer-doorbell'&&request.method==='POST'){
      let body;
      try{body=await request.json();}catch{return json({code:'CUSTOMER_DOORBELL_INVALID'},400);}
      if(!['CUSTOMER_QUOTE_AVAILABLE','CUSTOMER_ORDER_AVAILABLE'].includes(String(body?.type||''))){
        return json({code:'CUSTOMER_DOORBELL_TYPE_INVALID'},400);
      }
      const message=JSON.stringify({
        type:String(body.type),
        storeId:'MF01',
        requestId:body.requestId?String(body.requestId):undefined,
        submissionId:body.submissionId?String(body.submissionId):undefined,
        receivedAt:new Date().toISOString(),
      });
      for(const socket of this.state.getWebSockets()){
        try{socket.send(message);}catch{}
      }
      return json({state:'DOORBELL_SENT'});
    }
    if(url.pathname==='/provider-doorbell'&&request.method==='POST'){
      let body;
      try{body=await request.json();}catch{return json({code:'PROVIDER_DOORBELL_INVALID'},400);}
      if(body?.type!=='KEETA_ORDER_AVAILABLE')return json({code:'PROVIDER_DOORBELL_TYPE_INVALID'},400);
      const message=JSON.stringify({
        type:'KEETA_ORDER_AVAILABLE',
        storeId:'MF01',
        provider:'KEETA',
        providerOrderId:String(body.providerOrderId||''),
        providerMessageId:String(body.providerMessageId||''),
        receivedAt:new Date().toISOString(),
      });
      for(const socket of this.state.getWebSockets()){
        try{socket.send(message);}catch{}
      }
      return json({state:'DOORBELL_SENT'});
    }
    if(url.pathname==='/active'){
      const active=await this.state.storage.get('active');
      return active?json(active):json({code:'ADMIN_CONFIG_NOT_PUBLISHED'},404);
    }
    if(url.pathname==='/publish'){
      if(request.method!=='POST')return json({code:'METHOD_NOT_ALLOWED'},405);
      if(!await this.authorizePublish(request))return json({code:'ADMIN_CONFIG_PUBLISH_UNAUTHORIZED'},401);
      let envelope;
      try{envelope=validateMfkAdminConfigEnvelope(await request.json());}
      catch(error){return json({code:error instanceof Error?error.message:'ADMIN_CONFIG_INVALID'},400);}
      const result=await this.publishEnvelope(envelope);
      return json(result.body,result.status);
    }
    if(url.pathname==='/ack'){
      if(request.method!=='POST')return json({code:'METHOD_NOT_ALLOWED'},405);
      let ack;
      try{ack=validateMfkAdminConfigAck(await request.json());}
      catch(error){return json({code:error instanceof Error?error.message:'ADMIN_CONFIG_ACK_INVALID'},400);}
      const active=await this.state.storage.get('active');
      if(!active)return json({code:'ADMIN_CONFIG_NOT_PUBLISHED'},409);
      if(ack.revision!==active.revision||ack.fingerprint!==active.fingerprint){
        return json({code:'ADMIN_CONFIG_ACK_MISMATCH',expectedRevision:active.revision,expectedFingerprint:active.fingerprint},409);
      }
      const acks=await this.state.storage.get('acks')||{};
      acks[ack.deviceId]=ack;
      await this.state.storage.put('acks',acks);
      return json({state:'ACKED',ack});
    }
    if(url.pathname==='/acks'){
      const acks=await this.state.storage.get('acks')||{};
      return json({acks:Object.values(acks).sort((a,b)=>String(b.appliedAt).localeCompare(String(a.appliedAt)))});
    }
    if(url.pathname==='/dining-occupancy'){
      if(request.method==='POST'){
        const body=row(await request.json().catch(()=>({})));
        const tableId=String(body.tableId||'').trim();
        const observedAt=String(body.observedAt||'').trim();
        const activeSessionCount=Number(body.activeSessionCount);
        const runtimeRevision=Number(body.runtimeRevision);
        if(String(body.storeId||'')!=='MF01'||!tableId||!Number.isSafeInteger(activeSessionCount)||activeSessionCount<0||!Number.isFinite(Date.parse(observedAt))||!Number.isSafeInteger(runtimeRevision)||runtimeRevision<0)return json({code:'DINING_OCCUPANCY_INVALID'},400);
        const value=Object.freeze({storeId:'MF01',tableId,hasActiveSession:activeSessionCount>0,activeSessionCount,observedAt,runtimeRevision,receivedAt:new Date().toISOString()});
        await this.state.storage.put('dining:occupancy:'+tableId,value);
        return json({state:'OBSERVED',readback:value});
      }
      if(request.method==='GET'){
        if(!await this.authorizeAdminRead(request))return json({code:'DINING_OCCUPANCY_READ_UNAUTHORIZED'},401);
        const tableId=String(url.searchParams.get('tableId')||'').trim();
        if(!tableId)return json({code:'DINING_OCCUPANCY_TABLE_REQUIRED'},400);
        const value=await this.state.storage.get('dining:occupancy:'+tableId);
        return value?json({readback:value}):json({code:'DINING_OCCUPANCY_UNKNOWN'},404);
      }
      return json({code:'METHOD_NOT_ALLOWED'},405);
    }
    if(url.pathname==='/events'){
      if(request.headers.get('upgrade')!=='websocket')return json({code:'WEBSOCKET_REQUIRED'},426);
      const pair=new WebSocketPair();
      const client=pair[0],server=pair[1];
      this.state.acceptWebSocket(server);
      const active=await this.state.storage.get('active');
      if(active){
        server.send(JSON.stringify({type:'ADMIN_CONFIG_AVAILABLE',storeId:active.storeId,revision:active.revision,fingerprint:active.fingerprint,publishedAt:active.publishedAt}));
      }
      return new Response(null,{status:101,webSocket:client});
    }

    if(url.pathname==='/refunds'){
      if(request.method==='GET'){
        if(!await this.authorizeAdminRead(request))return json({code:'ADMIN_REFUND_READ_UNAUTHORIZED'},401);
        return json({refunds:await this.adminRefunds(),addenda:await this.adminRefundAddenda()});
      }
      if(request.method==='POST'){
        if(!await this.authorizePublish(request))return json({code:'ADMIN_REFUND_WRITE_UNAUTHORIZED'},401);
        let input;
        try{input=await request.json();}catch{return json({code:'ADMIN_REFUND_INPUT_INVALID'},400);}
        const created=await this.createAdminRefund(input);
        if(created.error)return json({code:created.error},created.status||400);
        return json({state:'REFUNDED',refund:created.event,addendum:created.addendum},201);
      }
      return json({code:'METHOD_NOT_ALLOWED'},405);
    }

    if(url.pathname==='/smt-owner-sellability'){
      if(!await this.authorizeSmtDevice(request))return json({code:'SMT_OWNER_SELLABILITY_UNAUTHORIZED'},401);
      if(request.method==='GET')return json({commands:await this.pendingOwnerSellabilityCommands()});
      if(request.method==='POST'){
        const body=row(await request.json().catch(()=>({})));
        const operationId=String(body.operationId||'').trim();
        if(!operationId)return json({code:'OWNER_SELLABILITY_OPERATION_REQUIRED'},400);
        const key='owner:sellability:command:'+operationId;
        const command=await this.state.storage.get(key);
        if(!command)return json({code:'OWNER_SELLABILITY_COMMAND_NOT_FOUND'},404);
        const state=String(body.state||'').toUpperCase();
        if(state!=='CONFIRMED'&&state!=='REJECTED')return json({code:'OWNER_SELLABILITY_READBACK_STATE_INVALID'},400);
        if(command.state!=='PENDING_SMT')return json({state:'ACKED',readback:command});
        const readback=Object.freeze({...command,state,readbackAt:new Date().toISOString(),results:rows(body.results)});
        await this.state.storage.put(key,readback);
        await this.state.storage.put('owner:sellability:operation:'+operationId,{result:{state,message:state==='CONFIRMED'?'SMT Runtime 已確認':'SMT Runtime 拒絕操作',targets:readback.results},createdAt:command.createdAt});
        return json({state:'ACKED',readback});
      }
      return json({code:'METHOD_NOT_ALLOWED'},405);
    }

    if(url.pathname==='/smt-refunds'){
      if(request.method!=='GET')return json({code:'METHOD_NOT_ALLOWED'},405);
      if(!await this.authorizeSmtDevice(request))return json({code:'SMT_REFUND_READ_UNAUTHORIZED'},401);
      return json({refunds:(await this.adminRefunds()).slice(0,500)});
    }

    if(url.pathname==='/projection/events'){
      if(request.method!=='POST')return json({code:'METHOD_NOT_ALLOWED'},405);
      let batch;
      try{batch=validateSmtProjectionBatch(await request.json());}
      catch(error){return json({code:error instanceof Error?error.message:'PROJECTION_BATCH_INVALID'},400);}
      if(!await this.authorizeProjectionWrite(request,batch.events))return json({code:'PROJECTION_WRITE_UNAUTHORIZED'},401);
      const accepted=[];
      const eventTypes=new Set();
      for(const event of batch.events){
        const eventKey='projection:event:'+event.eventId;
        const existing=await this.state.storage.get(eventKey);
        if(existing){accepted.push(event.eventId);continue;}
        if(event.type==='ORDER_UPSERT'){
          const key='projection:order:'+event.entityId;
          const current=await this.state.storage.get(key);
          const incomingAt=Date.parse(event.occurredAt);
          const currentAt=current?Date.parse(String(current.occurredAt||'')):Number.NEGATIVE_INFINITY;
          if(!current||!Number.isFinite(currentAt)||incomingAt>=currentAt){
            await this.state.storage.put(key,{eventId:event.eventId,occurredAt:event.occurredAt,payload:event.payload});
          }
        }else if(event.type==='CASH_OPENING_CONFIRMED'){
          await this.state.storage.put('projection:cash-opening:'+event.entityId,{eventId:event.eventId,occurredAt:event.occurredAt,payload:event.payload});
        }else if(event.type==='DAY_CLOSE_RECORDED'){
          const key='projection:day-close:'+event.entityId;
          const current=await this.state.storage.get(key);
          const incomingVersion=Number(event.payload?.version)||0;
          const currentVersion=Number(current?.payload?.version)||0;
          const incomingAt=Date.parse(event.occurredAt);
          const currentAt=current?Date.parse(String(current.occurredAt||'')):Number.NEGATIVE_INFINITY;
          if(!current||incomingVersion>currentVersion||incomingVersion===currentVersion&&incomingAt>=currentAt){
            await this.state.storage.put(key,{eventId:event.eventId,occurredAt:event.occurredAt,payload:event.payload});
          }
        }else if(event.type==='RUNTIME_SELLABILITY_UPSERT'){
          const key='projection:runtime-sellability:'+event.entityId;
          const current=await this.state.storage.get(key);
          const incomingAt=Date.parse(event.occurredAt);
          const currentAt=current?Date.parse(String(current.occurredAt||'')):Number.NEGATIVE_INFINITY;
          if(!current||!Number.isFinite(currentAt)||incomingAt>=currentAt){
            const projectionAcceptedAt=new Date().toISOString();
            await this.state.storage.put(key,{eventId:event.eventId,occurredAt:event.occurredAt,projectionAcceptedAt,payload:event.payload});
            try{
              const active=await this.state.storage.get('active');
              if(active){
                const sellabilityRows=await this.state.storage.list({prefix:'projection:runtime-sellability:'});
                const runtimeSellability=[...sellabilityRows.values()].map(value=>value?.payload??value);
                const id=this.env.KEETA_RUNTIME.idFromName(event.storeId||'MF01');
                const stub=this.env.KEETA_RUNTIME.get(id);
                const providerTriggeredAt=new Date().toISOString();
                await this.state.storage.put('projection:runtime-sellability-provider:'+event.entityId,{
                  eventId:event.eventId,state:'PENDING',occurredAt:event.occurredAt,projectionAcceptedAt,providerTriggeredAt,
                });
                void stub.fetch(new Request('https://internal/admin/sellability/sync',{
                  method:'POST',headers:{'content-type':'application/json'},
                  body:JSON.stringify({revision:active.revision,adminFingerprint:active.fingerprint,snapshot:active.snapshot,runtimeSellability,propagation:{eventId:event.eventId,occurredAt:event.occurredAt,projectionAcceptedAt,providerTriggeredAt}}),
                })).then(async response=>{
                  await this.state.storage.put('projection:runtime-sellability-provider:'+event.entityId,{
                    eventId:event.eventId,state:response.ok?'COMPLETED':'FAILED',status:response.status,
                    occurredAt:event.occurredAt,projectionAcceptedAt,providerTriggeredAt,providerReadbackAt:new Date().toISOString(),
                  });
                }).catch(async error=>{
                  await this.state.storage.put('projection:runtime-sellability-provider:'+event.entityId,{
                    eventId:event.eventId,state:'FAILED',status:0,error:error instanceof Error?error.message:'KEETA_SELLABILITY_SYNC_FAILED',
                    occurredAt:event.occurredAt,projectionAcceptedAt,providerTriggeredAt,providerReadbackAt:new Date().toISOString(),
                  });
                });
              }
            }catch{}
          }
        }
        await this.state.storage.put(eventKey,{type:event.type,entityId:event.entityId,occurredAt:event.occurredAt});
        accepted.push(event.eventId);
        eventTypes.add(event.type);
      }
      if(eventTypes.size){
        const doorbell=JSON.stringify({
          type:'SMT_PROJECTION_AVAILABLE',
          storeId:batch.events[0]?.storeId||'MF01',
          eventTypes:[...eventTypes],
          receivedAt:new Date().toISOString(),
        });
        for(const socket of this.state.getWebSockets()){
          try{socket.send(doorbell);}catch{}
        }
      }
      return json({state:'ACKED',accepted});
    }

    if(url.pathname==='/runtime-sellability-readback'){
      if(request.method!=='GET')return json({code:'METHOD_NOT_ALLOWED'},405);
      const rows=await this.state.storage.list({prefix:'projection:runtime-sellability:'});
      return json({sellability:[...rows.values()].map(value=>value?.payload??value)});
    }

    if(url.pathname==='/projection/orders'){
      if(request.method!=='GET')return json({code:'METHOD_NOT_ALLOWED'},405);
      if(!await this.authorizeAdminRead(request))return json({code:'PROJECTION_READ_UNAUTHORIZED'},401);
      return json({orders:await this.projectionOrders()});
    }

    if(url.pathname==='/projection/reports'){
      if(request.method!=='GET')return json({code:'METHOD_NOT_ALLOWED'},405);
      if(!await this.authorizeAdminRead(request))return json({code:'PROJECTION_READ_UNAUTHORIZED'},401);
      return json({days:await this.projectionReports()});
    }

    return json({code:'NOT_FOUND'},404);
  }
}

export default {
  async fetch(request,env){
    const url=new URL(request.url);

    if(url.pathname==='/api/admin/payment-qr'){
      if(request.method!=='POST')return json({code:'METHOD_NOT_ALLOWED'},405);
      const storeId=storeIdFrom(url);
      const channelId=String(url.searchParams.get('channelId')||'').trim().toUpperCase();
      if(!/^[A-Z0-9][A-Z0-9_-]{1,39}$/.test(channelId))return json({code:'PAYMENT_CHANNEL_ID_INVALID'},400);
      const adminId=env.ADMIN_SYNC.idFromName(storeId);
      const admin=env.ADMIN_SYNC.get(adminId);
      const authUrl=new URL(request.url);authUrl.pathname='/authorize-publish';authUrl.search='';
      const authResponse=await admin.fetch(new Request(authUrl.toString(),{method:'GET',headers:new Headers(request.headers)}));
      if(!authResponse.ok)return json({code:'ADMIN_PAYMENT_QR_UNAUTHORIZED'},401);
      const contentType=String(request.headers.get('content-type')||'').toLowerCase();
      if(!['image/jpeg','image/png','image/webp'].includes(contentType))return json({code:'PAYMENT_QR_TYPE_INVALID'},415);
      const declared=Number(request.headers.get('content-length')||0);
      if(declared>5*1024*1024)return json({code:'PAYMENT_QR_TOO_LARGE'},413);
      const bytes=await request.arrayBuffer();
      if(bytes.byteLength<1||bytes.byteLength>5*1024*1024)return json({code:'PAYMENT_QR_SIZE_INVALID'},413);
      const digest=await crypto.subtle.digest('SHA-256',bytes);
      const sha=[...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,'0')).join('');
      const ext=contentType==='image/png'?'png':contentType==='image/webp'?'webp':'jpg';
      const objectKey='customer-payment-qr/'+storeId+'/'+channelId+'/'+sha+'.'+ext;
      await env.CUSTOMER_PAYMENT_EVIDENCE.put(objectKey,bytes,{httpMetadata:{contentType},customMetadata:{storeId,channelId,sha256:sha,kind:'PAYMENT_QR'}});
      const qrImageUrl=ADMIN_ORIGIN+'/api/customer/payment-qr?storeId='+encodeURIComponent(storeId)+'&ref='+encodeURIComponent(objectKey);
      return json({state:'UPLOADED',objectKey,qrImageUrl,sha256:sha,uploadedAt:new Date().toISOString()},201);
    }


    if(url.pathname==='/api/admin-sync/dining-occupancy'){
      const storeId=storeIdFrom(url),id=env.ADMIN_SYNC.idFromName(storeId),stub=env.ADMIN_SYNC.get(id),target=new URL(request.url);
      target.pathname='/dining-occupancy';
      return stub.fetch(new Request(target.toString(),request));
    }

    if(url.pathname.startsWith('/api/owner/')){
      if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors(request)});
      const origin=request.headers.get('origin')||'';if(origin!==OWNER_ORIGIN&&origin!==ADMIN_ORIGIN)return json({code:'OWNER_ORIGIN_FORBIDDEN'},403,cors(request));
      const storeId=storeIdFrom(url),id=env.ADMIN_SYNC.idFromName(storeId),stub=env.ADMIN_SYNC.get(id),target=new URL(request.url);
      target.pathname='/owner/'+url.pathname.slice('/api/owner/'.length);
      const response=await stub.fetch(new Request(target.toString(),request)),headers=new Headers(response.headers);
      for(const [key,value] of Object.entries(cors(request)))headers.set(key,value);
      return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
    }

    if(url.pathname.startsWith('/api/customer/')){
      if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors(request)});
      const storeId=storeIdFrom(url);
      const customerId=env.CUSTOMER_RUNTIME.idFromName(storeId);
      const customer=env.CUSTOMER_RUNTIME.get(customerId);
      const adminId=env.ADMIN_SYNC.idFromName(storeId);
      const admin=env.ADMIN_SYNC.get(adminId);

      if(url.pathname==='/api/customer/channel-health'){
        if(request.method!=='GET')return json({code:'METHOD_NOT_ALLOWED'},405,cors(request));
        const response=await customer.fetch(new Request('https://internal/public/channel-health',{method:'GET'}));
        const headers=new Headers(response.headers);
        for(const [key,value] of Object.entries(cors(request)))headers.set(key,value);
        return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
      }

      if(url.pathname==='/api/customer/snapshot'){
        if(request.method!=='GET')return json({code:'METHOD_NOT_ALLOWED'},405,cors(request));
        const activeResponse=await admin.fetch(new Request('https://internal/active',{method:'GET'}));
        if(!activeResponse.ok)return json({code:'CUSTOMER_CONFIG_NOT_PUBLISHED'},503,cors(request));
        const active=await activeResponse.json();
        const ids=url.searchParams.getAll('submissionId').map(value=>String(value).trim()).filter(Boolean).slice(0,24);
        const ordersUrl=new URL('https://internal/customer-orders');
        for(const id of ids)ordersUrl.searchParams.append('submissionId',id);
        const orderResponse=await admin.fetch(new Request(ordersUrl.toString(),{method:'GET'}));
        const orderBody=orderResponse.ok?await orderResponse.json():{orders:[]};
        const sellabilityResponse=await admin.fetch(new Request('https://internal/runtime-sellability-readback',{method:'GET'}));
        const sellabilityBody=sellabilityResponse.ok?await sellabilityResponse.json():{sellability:[]};
        return json(customerPublicSnapshot(active,Array.isArray(orderBody.orders)?orderBody.orders:[],Array.isArray(sellabilityBody.sellability)?sellabilityBody.sellability:[]),200,cors(request));
      }

      if(url.pathname==='/api/customer/payment-qr'){
        if(request.method!=='GET')return json({code:'METHOD_NOT_ALLOWED'},405,cors(request));
        const objectKey=String(url.searchParams.get('ref')||'').trim();
        if(!objectKey.startsWith('customer-payment-qr/'+storeId+'/'))return json({code:'PAYMENT_QR_REF_INVALID'},400,cors(request));
        const object=await env.CUSTOMER_PAYMENT_EVIDENCE.get(objectKey);
        if(!object||object.customMetadata?.kind!=='PAYMENT_QR')return json({code:'PAYMENT_QR_NOT_FOUND'},404,cors(request));
        const headers=new Headers(cors(request));
        headers.set('content-type',object.httpMetadata?.contentType||'image/png');
        headers.set('cache-control','public, max-age=300, must-revalidate');
        if(url.searchParams.get('download')==='1')headers.set('content-disposition','attachment; filename="payment-qr.'+(object.httpMetadata?.contentType==='image/jpeg'?'jpg':object.httpMetadata?.contentType==='image/webp'?'webp':'png')+'"');
        return new Response(object.body,{status:200,headers});
      }

      if(url.pathname==='/api/customer/payment-evidence'&&request.method==='POST'){
        const contentType=String(request.headers.get('content-type')||'').toLowerCase();
        if(!['image/jpeg','image/png','image/webp'].includes(contentType))return json({code:'PAYMENT_EVIDENCE_TYPE_INVALID'},415,cors(request));
        const declared=Number(request.headers.get('content-length')||0);
        if(declared>8*1024*1024)return json({code:'PAYMENT_EVIDENCE_TOO_LARGE'},413,cors(request));
        const bytes=await request.arrayBuffer();
        if(bytes.byteLength<1||bytes.byteLength>8*1024*1024)return json({code:'PAYMENT_EVIDENCE_SIZE_INVALID'},413,cors(request));
        const evidenceId=crypto.randomUUID();
        const digest=await crypto.subtle.digest('SHA-256',bytes);
        const sha256=[...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,'0')).join('');
        const ext=contentType==='image/png'?'png':contentType==='image/webp'?'webp':'jpg';
        const evidenceRef='customer-payment/'+storeId+'/'+evidenceId+'/'+sha256+'.'+ext;
        await env.CUSTOMER_PAYMENT_EVIDENCE.put(evidenceRef,bytes,{httpMetadata:{contentType},customMetadata:{storeId,evidenceId,sha256,kind:'PAYMENT_SCREENSHOT',verificationState:'PENDING'}});
        return json({state:'UPLOADED',evidenceRef,sha256,uploadedAt:new Date().toISOString()},201,cors(request));
      }

      if(url.pathname==='/api/customer/staff-orders/submit'){
        if(request.method!=='POST')return json({code:'METHOD_NOT_ALLOWED'},405,cors(request));
        const staff=await resolveSmmStaffSession(request,storeId);
        if(!staff)return json({code:'SMM_STAFF_UNAUTHORIZED',message:'SMM 員工工作階段無效'},401,cors(request));
        const orderBody=await request.json().catch(()=>null);
        if(!orderBody)return json({code:'SMM_STAFF_ORDER_INVALID'},400,cors(request));
        const response=await customer.fetch(new Request('https://internal/public/staff-orders/submit',{
          method:'POST',
          headers:{'content-type':'application/json'},
          body:JSON.stringify({request:orderBody,staff}),
        }));
        if(response.status===202){
          try{
            const result=await response.clone().json();
            await admin.fetch(new Request('https://internal/customer-doorbell',{
              method:'POST',
              headers:{'content-type':'application/json'},
              body:JSON.stringify({
                type:'CUSTOMER_ORDER_AVAILABLE',
                source:'SMM',
                submissionId:result.submissionId,
              }),
            }));
          }catch{}
        }
        const headers=new Headers(response.headers);
        for(const [key,value] of Object.entries(cors(request)))headers.set(key,value);
        return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
      }

      if(url.pathname==='/api/customer/staff-orders/readback'){
        if(request.method!=='GET')return json({code:'METHOD_NOT_ALLOWED'},405,cors(request));
        const staff=await resolveSmmStaffSession(request,storeId);
        if(!staff)return json({code:'SMM_STAFF_UNAUTHORIZED',message:'SMM 員工工作階段無效'},401,cors(request));
        const submissionId=String(url.searchParams.get('submissionId')||'').trim();
        const target=new URL('https://internal/public/staff-orders/readback');
        target.searchParams.set('submissionId',submissionId);
        const response=await customer.fetch(new Request(target.toString(),{method:'GET'}));
        const headers=new Headers(response.headers);
        for(const [key,value] of Object.entries(cors(request)))headers.set(key,value);
        return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
      }

      if(url.pathname==='/api/customer/smt/diagnostics'&&request.method==='GET'){
        const authorizeUrl=new URL(request.url);
        authorizeUrl.pathname='/authorize-smt-device';
        const authResponse=await admin.fetch(new Request(authorizeUrl.toString(),{method:'GET',headers:new Headers(request.headers)}));
        if(!authResponse.ok)return json({ok:false,stage:'SMT_DEVICE_AUTH',status:authResponse.status,code:'CUSTOMER_SMT_UNAUTHORIZED'},401,cors(request));
        const orderResponse=await customer.fetch(new Request('https://internal/smt/orders/pending',{method:'GET'}));
        const orderBody=orderResponse.ok?await orderResponse.json():{};
        const traceResponse=await customer.fetch(new Request('https://internal/smt/diagnostics',{method:'GET'}));
        const traceBody=traceResponse.ok?await traceResponse.json():{};
        return json({
          ok:orderResponse.ok&&traceResponse.ok,
          stage:orderResponse.ok&&traceResponse.ok?'CUSTOMER_BRIDGE_PULL_READY':'CUSTOMER_RUNTIME_PULL_FAILED',
          deviceAuthorized:true,
          pendingOrders:Array.isArray(orderBody.orders)?orderBody.orders.length:null,
          orderPullStatus:orderResponse.status,
          observedAt:new Date().toISOString(),
        },orderResponse.ok&&traceResponse.ok?200:502,cors(request));
      }

      if(url.pathname==='/api/customer/smt/payment-evidence'&&request.method==='GET'){
        const authorizeUrl=new URL(request.url);
        authorizeUrl.pathname='/authorize-smt-device';
        const authResponse=await admin.fetch(new Request(authorizeUrl.toString(),{method:'GET',headers:new Headers(request.headers)}));
        if(!authResponse.ok)return json({code:'CUSTOMER_SMT_UNAUTHORIZED'},401,cors(request));
        const evidenceRef=String(url.searchParams.get('ref')||'').trim();
        if(!evidenceRef.startsWith('customer-payment/'+storeId+'/'))return json({code:'PAYMENT_EVIDENCE_REF_INVALID'},400,cors(request));
        const object=await env.CUSTOMER_PAYMENT_EVIDENCE.get(evidenceRef);
        if(!object)return json({code:'PAYMENT_EVIDENCE_NOT_FOUND'},404,cors(request));
        const headers=new Headers(cors(request));
        headers.set('content-type',object.httpMetadata?.contentType||'application/octet-stream');
        headers.set('cache-control','private, no-store');
        return new Response(object.body,{status:200,headers});
      }

      if(url.pathname.startsWith('/api/customer/smt/')){
        const authorizeUrl=new URL(request.url);
        authorizeUrl.pathname='/authorize-smt-device';
        const authResponse=await admin.fetch(new Request(authorizeUrl.toString(),{method:'GET',headers:new Headers(request.headers)}));
        if(!authResponse.ok)return json({code:'CUSTOMER_SMT_UNAUTHORIZED'},401,cors(request));
        const target=new URL(request.url);
        target.pathname='/smt/'+url.pathname.slice('/api/customer/smt/'.length);
        const init={method:request.method,headers:new Headers(request.headers)};
        if(request.method!=='GET'&&request.method!=='HEAD'){
          if(url.pathname==='/api/customer/orders/submit'&&normalizedCustomerOrderBody){
            init.headers.set('content-type','application/json');
            init.body=JSON.stringify(normalizedCustomerOrderBody);
          }else{
            const body=await request.arrayBuffer();
            if(body.byteLength)init.body=body;
          }
        }
        const response=await customer.fetch(new Request(target.toString(),init));
        const headers=new Headers(response.headers);
        for(const [key,value] of Object.entries(cors(request)))headers.set(key,value);
        return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
      }

      const publicMap={
        '/api/customer/orders/submit':'/public/orders/submit',
        '/api/customer/orders/readback':'/public/orders/readback',
      };
      const targetPath=publicMap[url.pathname];
      let normalizedCustomerOrderBody=null;
      if(targetPath&&url.pathname==='/api/customer/orders/submit'){
        const activeResponse=await admin.fetch(new Request('https://internal/active',{method:'GET'}));
        if(!activeResponse.ok)return json({code:'CUSTOMER_CONFIG_NOT_PUBLISHED'},503,cors(request));
        const active=await activeResponse.json();
        const activeSnapshot=row(active?.snapshot);
        const policy=row(activeSnapshot.customerChannelPolicy);
        if(policy.enabled!==true)return json({code:'CUSTOMER_CHANNEL_DISABLED'},503,cors(request));
        if(url.pathname==='/api/customer/orders/submit'){
          const intent=await request.clone().json().catch(()=>null);
          const checkout=row(row(intent).checkout);
          if(checkout.paymentMethod==='ELECTRONIC'){
            const channelId=String(checkout.paymentChannelId||'').trim().toUpperCase();
            const channelLabel=String(checkout.paymentChannelLabel||'').trim();
            const settings=row(activeSnapshot.storeSettings);
            const configured=Array.isArray(settings.customerPaymentChannels)?settings.customerPaymentChannels:[
              {id:'ALIPAY',name:'AlipayHK',enabled:true,qrImageUrl:'',sortOrder:1},
              {id:'WECHAT',name:'WeChat Pay HK',enabled:true,qrImageUrl:'',sortOrder:2},
              {id:'FPS',name:'轉數快',enabled:true,qrImageUrl:'',sortOrder:3},
              {id:'PAYME',name:'PayMe',enabled:true,qrImageUrl:'',sortOrder:4},
            ];
            const channel=configured.map(raw=>row(raw)).find(item=>String(item.id||'').trim().toUpperCase()===channelId&&item.enabled!==false);
            const qr=channel?String(channel.qrImageUrl||'').trim():'';
            const currentLabel=channel?String(channel.name||'').trim():'';
            if(!channel||!currentLabel||!qr)return json({code:'CUSTOMER_PAYMENT_CHANNEL_UNAVAILABLE'},409,cors(request));
            if(channelLabel&&channelLabel!==currentLabel)return json({code:'CUSTOMER_PAYMENT_CHANNEL_CHANGED'},409,cors(request));
            normalizedCustomerOrderBody={
              ...row(intent),
              checkout:{...checkout,paymentChannelId:channelId,paymentChannelLabel:currentLabel},
            };
          }
        }
      }
      if(targetPath){
        const target=new URL(request.url);
        target.pathname=targetPath;
        const init={method:request.method,headers:new Headers(request.headers)};
        if(request.method!=='GET'&&request.method!=='HEAD'){
          const body=await request.arrayBuffer();
          if(body.byteLength)init.body=body;
        }
        const response=await customer.fetch(new Request(target.toString(),init));
        if(response.status===202&&url.pathname==='/api/customer/orders/submit'){
          try{
            const body=await response.clone().json();
            await admin.fetch(new Request('https://internal/customer-doorbell',{
              method:'POST',
              headers:{'content-type':'application/json'},
              body:JSON.stringify({
                type:'CUSTOMER_ORDER_AVAILABLE',
                requestId:body.requestId,
                submissionId:body.submissionId,
              }),
            }));
          }catch{}
        }
        const headers=new Headers(response.headers);
        for(const [key,value] of Object.entries(cors(request)))headers.set(key,value);
        return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
      }
      return json({code:'NOT_FOUND'},404,cors(request));
    }

    if(url.pathname.startsWith('/api/keeta/')){
      if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors(request)});
      const storeId=storeIdFrom(url);
      const keetaId=env.KEETA_RUNTIME.idFromName(storeId);
      const keeta=env.KEETA_RUNTIME.get(keetaId);

      if(url.pathname.startsWith('/api/keeta/smt/')){
        const adminId=env.ADMIN_SYNC.idFromName(storeId);
        const admin=env.ADMIN_SYNC.get(adminId);
        const authorizeUrl=new URL(request.url);
        authorizeUrl.pathname='/authorize-smt-device';
        const authResponse=await admin.fetch(new Request(authorizeUrl.toString(),{
          method:'GET',
          headers:new Headers(request.headers),
        }));
        if(!authResponse.ok)return json({code:'KEETA_SMT_UNAUTHORIZED'},401,cors(request));
        const target=new URL(request.url);
        target.pathname='/smt/'+url.pathname.slice('/api/keeta/smt/'.length);
        const init={method:request.method,headers:new Headers(request.headers)};
        if(request.method!=='GET'&&request.method!=='HEAD'){
          const body=await request.arrayBuffer();
          if(body.byteLength)init.body=body;
        }
        const response=await keeta.fetch(new Request(target.toString(),init));
        const headers=new Headers(response.headers);
        for(const [key,value] of Object.entries(cors(request)))headers.set(key,value);
        return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
      }

      if(url.pathname.startsWith('/api/keeta/admin/')){
        const adminId=env.ADMIN_SYNC.idFromName(storeId);
        const admin=env.ADMIN_SYNC.get(adminId);
        const authorizeUrl=new URL(request.url);
        authorizeUrl.pathname='/authorize-admin';
        authorizeUrl.search='';
        let authResponse;
        try{
          authResponse=await admin.fetch(new Request(authorizeUrl.toString(),{
            method:'GET',
            headers:new Headers(request.headers),
          }));
        }catch{
          return json({code:'KEETA_ADMIN_AUTH_RUNTIME_FAILED'},500,cors(request));
        }
        if(!authResponse.ok)return json({code:'KEETA_ADMIN_UNAUTHORIZED'},401,cors(request));
        const adminSubpath=url.pathname.slice('/api/keeta/admin/'.length);
        const target=new URL(request.url);
        target.pathname='/admin/'+adminSubpath;
        target.search=url.search;
        const init={method:request.method,headers:new Headers(request.headers)};
        const activeConfigSubpaths=new Set([
          'menu/preview','menu/sync',
          'sellability/preview','sellability/sync',
          'store/preview','store/hours/sync',
        ]);
        if(activeConfigSubpaths.has(adminSubpath)&&request.method==='POST'){
          const activeResponse=await admin.fetch(new Request('https://internal/active',{method:'GET'}));
          if(!activeResponse.ok)return json({code:'KEETA_ADMIN_CONFIG_NOT_PUBLISHED'},409,cors(request));
          const active=await activeResponse.json();
          init.headers.set('content-type','application/json');
          let runtimeSellability=[];
          if(adminSubpath==='sellability/preview'||adminSubpath==='sellability/sync'){
            const runtimeResponse=await admin.fetch(new Request('https://internal/runtime-sellability-readback',{method:'GET'}));
            const runtimeBody=runtimeResponse.ok?await runtimeResponse.json():{sellability:[]};
            runtimeSellability=Array.isArray(runtimeBody.sellability)?runtimeBody.sellability:[];
          }
          init.body=JSON.stringify({
            revision:active.revision,
            adminFingerprint:active.fingerprint,
            snapshot:active.snapshot,
            ...(runtimeSellability.length?{runtimeSellability}:{}),
          });
        }else if(request.method!=='GET'&&request.method!=='HEAD'){
          const body=await request.arrayBuffer();
          if(body.byteLength)init.body=body;
        }
        let response;
        try{
          response=await keeta.fetch(new Request(target.toString(),init));
        }catch{
          return json({code:'KEETA_RUNTIME_DO_FETCH_FAILED'},500,cors(request));
        }
        const headers=new Headers(response.headers);
        for(const [key,value] of Object.entries(cors(request)))headers.set(key,value);
        return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
      }

      const providerEnvelope=url.pathname==='/api/keeta/webhook'&&request.method==='POST'
        ?await request.clone().json().catch(()=>null)
        :null;
      const target=new URL(request.url);
      target.pathname=url.pathname==='/api/keeta/webhook'
        ?'/webhook'
        :url.pathname==='/api/keeta/oauth/callback'
          ?'/oauth/callback'
          :'/not-found';
      const forwardedHeaders=new Headers(request.headers);
      if(url.pathname==='/api/keeta/webhook'||url.pathname==='/api/keeta/oauth/callback'){
        forwardedHeaders.set('x-mfk-keeta-external-url',request.url);
      }else{
        forwardedHeaders.delete('x-mfk-keeta-external-url');
      }
      const init={method:request.method,headers:forwardedHeaders};
      if(request.method!=='GET'&&request.method!=='HEAD'){
        const body=await request.arrayBuffer();
        if(body.byteLength)init.body=body;
      }
      const response=await keeta.fetch(new Request(target.toString(),init));
      if(response.ok&&providerEnvelope){
        try{
          const eventId=Number(providerEnvelope.eventId);
          const message=typeof providerEnvelope.message==='string'?JSON.parse(providerEnvelope.message):null;
          const orderInfo=message?.orderInfo??message;
          const baseOrder=orderInfo?.baseOrder;
          const providerOrderId=String(
            eventId===1001
              ?baseOrder?.orderViewIdStr??baseOrder?.orderViewId??''
              :message?.orderViewIdStr??message?.orderViewId??''
          ).trim();
          if(providerOrderId){
            const adminId=env.ADMIN_SYNC.idFromName(storeId);
            const admin=env.ADMIN_SYNC.get(adminId);
            const type=eventId===1001
              ?'KEETA_ORDER_AVAILABLE'
              :[1002,1003,1004,1006,1008].includes(eventId)
                ?'KEETA_ORDER_EVENT_AVAILABLE'
                :[1005,1007].includes(eventId)
                  ?'KEETA_AFTER_SALE_AVAILABLE'
                  :null;
            if(type)await admin.fetch(new Request('https://internal/provider-doorbell',{
              method:'POST',
              headers:{'content-type':'application/json'},
              body:JSON.stringify({
                type,
                eventId,
                providerOrderId,
                providerMessageId:String(providerEnvelope.messageId||''),
              }),
            }));
          }
        }catch{}
      }
      const headers=new Headers(response.headers);
      for(const [key,value] of Object.entries(cors(request)))headers.set(key,value);
      return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
    }
    if(url.pathname.startsWith('/api/admin-browser/')){
      if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors(request)});
      const storeId=storeIdFrom(url);
      const id=env.ADMIN_SYNC.idFromName(storeId);
      const stub=env.ADMIN_SYNC.get(id);
      const target=new URL(request.url);
      target.pathname='/admin-browser/'+url.pathname.slice('/api/admin-browser/'.length);
      target.search='';
      const response=await stub.fetch(new Request(target.toString(),request));
      const headers=new Headers(response.headers);
      for(const [key,value] of Object.entries(cors(request)))headers.set(key,value);
      return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
    }
    if(url.pathname==='/api/admin-sync/provider-doorbell'||url.pathname==='/api/admin-sync/customer-doorbell'||url.pathname==='/api/admin-sync/customer-orders'||url.pathname==='/api/admin-sync/authorize-smt-device'){
      return json({code:'NOT_FOUND'},404,cors(request));
    }
    if(url.pathname.startsWith('/api/admin-sync/')||url.pathname.startsWith('/api/projection/')){
      if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors(request)});
      const storeId=storeIdFrom(url);
      const id=env.ADMIN_SYNC.idFromName(storeId);
      const stub=env.ADMIN_SYNC.get(id);
      const targetPath=url.pathname.startsWith('/api/projection/')
        ?'/projection/'+url.pathname.slice('/api/projection/'.length)
        :url.pathname.replace('/api/admin-sync','')||'/active';
      const target=new URL(request.url);
      target.pathname=targetPath;
      target.search='';
      const forwarded=new Request(target.toString(),request);
      const response=await stub.fetch(forwarded);
      return adminSyncOuterResponse(url.pathname,response,request);
    }
    if(url.pathname==='/api/health')return json({ok:true,service:'mfk-admin',sourceSha:String(env.MFK_SOURCE_SHA||'UNKNOWN')});
    return env.ASSETS.fetch(request);
  },
};
