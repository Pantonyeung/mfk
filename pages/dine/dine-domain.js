import {createOrderIdentity} from '../../shared/order-identity.js';

const TABLE_IDS=['1','2','3','4','5','6','7','8','戶外'];

const clone=value=>JSON.parse(JSON.stringify(value));
const terminal=value=>String(value||'SMT').trim().toUpperCase().replace(/[^A-Z0-9]/g,'')||'SMT';

export function createInitialDineState(now=Date.now()){
  return {
    tables:TABLE_IDS.map(id=>({id,status:'free',openedAt:null,session:null})),
    waiting:[],
    selectedTableId:null,
    panel:null,
    createdAt:now
  };
}

export function tableView(table,now=Date.now()){
  const occupied=table.status==='occupied';
  const minutes=occupied&&table.openedAt?Math.max(0,Math.floor((now-table.openedAt)/60_000)):0;
  const session=table.session||table;
  const items=session.items||[];
  const total=items.reduce((sum,item)=>sum+Number(item.unitPrice||0)*Number(item.qty||0),0);
  const paid=items.reduce((sum,item)=>sum+Number(item.unitPrice||0)*Number(item.paidQty||0),0);
  const itemKinds=items.length,itemQty=items.reduce((sum,item)=>sum+Number(item.qty||0),0);
  const timeStatus=!occupied?'free':minutes>=35?'late':minutes>=30?'near':'normal';
  return {...table,status:occupied?'occupied':'free',minutes,timeStatus,isLate:timeStatus==='late',isNearLimit:timeStatus==='near',total,paid,unpaid:Math.max(0,total-paid),itemKinds,itemQty,itemPreview:items.slice(0,3),remainingKinds:Math.max(0,itemKinds-3),pendingCount:(session.pendingSubmissions||[]).length};
}

export function openTable(table,now=Date.now()){
  if(table.status==='occupied')return clone(table);
  return {...clone(table),status:'occupied',openedAt:now,session:{id:`DINE-${table.id}-${now}`,items:[],orderBatches:[],pendingSubmissions:[],payments:[]}};
}

export function createDineOrderContext(state,tableId){
  const table=state?.tables?.find(entry=>entry.id===String(tableId));
  if(!table)throw new Error('找不到指定堂食枱');
  return {
    mode:'dine',
    tableId:table.id,
    sessionId:table.status==='occupied'?table.session?.id||null:null,
    startedFromFree:table.status!=='occupied',
    createdAt:Date.now()
  };
}

export function cleanupEmptyDineSessions(state){
  const next=clone(state);
  next.tables=next.tables.map(table=>{
    if(table.status!=='occupied'||!table.session)return table;
    const session=table.session;
    const hasOperationalData=(session.items||[]).length||(session.orderBatches||[]).length||(session.pendingSubmissions||[]).length||(session.payments||[]).length||(session.printJobs||[]).length;
    return hasOperationalData?table:{id:table.id,status:'free',openedAt:null,session:null};
  });
  if(next.selectedTableId&&next.tables.find(table=>table.id===next.selectedTableId)?.status==='free')next.selectedTableId=null;
  return next;
}

export function commitTableOrder(state,context,cart,{terminalId='SMT',now=Date.now(),history=[]}={}){
  if(!context?.tableId)throw new Error('未有指定堂食枱號');
  if(!Array.isArray(cart)||!cart.length)throw new Error('購物車未有餐品');
  const next=clone(state),index=next.tables.findIndex(table=>table.id===String(context.tableId));
  if(index<0)throw new Error('找不到指定堂食枱');
  let table=next.tables[index];
  if(table.status!=='occupied')table=openTable(table,now);
  table.session.printJobs=Array.isArray(table.session.printJobs)?table.session.printJobs:[];
  if(context.sessionId&&table.session?.id!==context.sessionId)throw new Error('堂食會話已失效，請重新開啟枱位');
  if(!table.session.orderIdentity){
    const activeIdentities=next.tables.map(entry=>entry.session?.orderIdentity).filter(Boolean);
    table.session.orderIdentity={...createOrderIdentity([...(Array.isArray(history)?history:[]),...activeIdentities],{terminalId,tableId:table.id,now}),acceptedAt:Number(now)};
  }
  const identity=table.session.orderIdentity;
  const batchId=`STAFF-${table.id}-${now}-${table.session.orderBatches.length+1}`;
  const items=clone(cart).map((item,itemIndex)=>({
    ...item,
    lineId:item.lineId||`${batchId}-${itemIndex+1}`,
    qty:Math.max(1,Number(item.qty)||1),
    unitPrice:Number(item.unitPrice??(Number(item.total||0)/Math.max(1,Number(item.qty)||1)))||0,
    paidQty:Number(item.paidQty||0),
    batchId
  }));
  table.session.items.push(...items);
  table.session.orderBatches.push({id:batchId,orderId:identity.id,displayOrderNo:identity.displayOrderNo,source:'STAFF',terminalId:terminal(terminalId),createdAt:now,items:clone(items)});
  table.session.printJobs.push({id:`PRINT-${batchId}`,orderId:identity.id,displayOrderNo:identity.displayOrderNo,batchId,type:'production',document:'製作單',status:'queued',createdAt:now,items:clone(items)});
  const labelItems=items.filter(item=>String(item.category||'').includes('飯團')||/^F\d+/i.test(String(item.code||'')));
  if(labelItems.length)table.session.printJobs.push({id:`LABEL-${batchId}`,orderId:identity.id,displayOrderNo:identity.displayOrderNo,batchId,type:'label',document:'標籤',status:'queued',createdAt:now,items:clone(labelItems)});
  next.tables[index]=table;
  next.selectedTableId=table.id;
  return next;
}

export function applyItemPayment(session,selections,method,now=Date.now()){
  if(!method)throw new Error('必須選擇付款方式');
  const next=clone(session);
  let amount=0;
  for(const selected of selections){
    const item=next.items.find(entry=>entry.lineId===selected.lineId);
    const qty=Number(selected.qty);
    if(!item||!Number.isInteger(qty)||qty<=0)throw new Error('付款餐品資料無效');
    const unpaid=Number(item.qty)-Number(item.paidQty||0);
    if(qty>unpaid)throw new Error('超出未付數量');
    item.paidQty=Number(item.paidQty||0)+qty;
    amount+=qty*Number(item.unitPrice||0);
  }
  if(!amount)throw new Error('未有選擇付款餐品');
  next.payments.push({id:`PAY-${now}-${next.payments.length+1}`,method,amount,selections:clone(selections),createdAt:now});
  return next;
}

export function applyFullPayment(session,method,now=Date.now()){
  const selections=(session.items||[]).map(item=>({lineId:item.lineId,qty:Number(item.qty)-Number(item.paidQty||0)})).filter(item=>item.qty>0);
  return applyItemPayment(session,selections,method,now);
}

function completedDineOrder(table,history=[],{terminalId='SMT',now=Date.now()}={}){
  const session=table.session||{},view=tableView(table,now),payments=session.payments||[];
  const methods=[...new Set(payments.map(payment=>payment.method).filter(Boolean))];
  const identity=session.orderIdentity||{...createOrderIdentity(history,{terminalId,tableId:table.id,now}),acceptedAt:Number(now)};
  return {
    ...identity,dineSessionId:session.id,dineTableId:table.id,
    group:'onsite',source:'現場',serviceMode:'堂食',status:'completed',
    acceptedAt:Number(identity.acceptedAt||table.openedAt||session.openedAt||now),completedAt:Number(now),
    itemCount:view.itemQty,amount:view.total,paidAmount:view.paid,
    paymentMethod:methods.length>1?'組合付款':methods[0]||'已付款',paymentStatus:'已付款',
    printStatus:(session.printJobs||[]).some(job=>job.status==='failed')?'異常':'正常',
    checkoutTerminalId:terminal(terminalId),checkedOutByTerminalId:terminal(terminalId),
    items:(session.items||[]).map(item=>({...clone(item),total:Number(item.unitPrice||0)*Number(item.qty||0)})),
    payments:clone(payments),orderBatches:clone(session.orderBatches||[]),printJobs:clone(session.printJobs||[]),
    audit:[{type:'dine.completed',terminalId:terminal(terminalId),at:Number(now),tableId:table.id,sessionId:session.id}]
  };
}

export function reconcileSettledTables(state,history=[],options={}){
  const next=clone(state),orders=clone(Array.isArray(history)?history:[]);
  for(let index=0;index<next.tables.length;index++){
    const table=next.tables[index],view=tableView(table,options.now);
    if(table.status!=='occupied'||!table.session?.items?.length||view.unpaid>0)continue;
    const existing=orders.some(order=>order.dineSessionId===table.session.id);
    if(!existing){
      const activeIdentities=next.tables.map(entry=>entry.session?.orderIdentity).filter(Boolean);
      orders.unshift(completedDineOrder(table,[...orders,...activeIdentities],options));
    }
    next.tables[index]={id:table.id,status:'free',openedAt:null,session:null};
    if(next.selectedTableId===table.id)next.selectedTableId=null;
  }
  return {state:next,history:orders};
}

export function settleTablePayment(state,history,{tableId,selections,method,terminalId='SMT',now=Date.now()}={}){
  const next=clone(state),index=next.tables.findIndex(table=>table.id===String(tableId));
  if(index<0||next.tables[index].status!=='occupied')throw new Error('找不到使用中的堂食枱');
  next.tables[index].session=applyItemPayment(next.tables[index].session,selections,method,now);
  return reconcileSettledTables(next,history,{terminalId,now});
}

export function acceptQrSubmission(session,submissionId,now=Date.now()){
  const next=clone(session);
  const index=next.pendingSubmissions.findIndex(entry=>entry.id===submissionId);
  if(index<0)throw new Error('找不到待確認落單');
  const [submission]=next.pendingSubmissions.splice(index,1);
  const items=(submission.items||[]).map((item,itemIndex)=>({...item,lineId:item.lineId||`${submission.id}-${itemIndex+1}`,paidQty:Number(item.paidQty||0)}));
  next.items.push(...items);
  next.orderBatches.push({id:submission.id,source:'QR',createdAt:submission.createdAt||now,acceptedAt:now,items:clone(items)});
  return next;
}
