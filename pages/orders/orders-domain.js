const activeStatuses=new Set(['running','active','open','']);
export function channelGroup(source){
  if(source==='現場'||source==='現場外賣'||source==='堂食')return 'onsite';
  if(source==='磨飯 App'||source==='電話／WhatsApp')return 'owned';
  return 'platform';
}
const event=(type,terminalId,at,detail={})=>({type,terminalId,at,...detail});
export function isHistory(order){return !activeStatuses.has(order.status||'');}
export function applyOrderFilters(orders,{source='all',exception='',view='active'}={}){
  return orders.filter(order=>{
    if(view==='active'&&isHistory(order))return false;
    if(view==='history'&&!isHistory(order))return false;
    if(source!=='all'&&order.source!==source)return false;
    if(exception==='payment'&&!String(order.paymentStatus||'').includes('待'))return false;
    if(exception==='print'&&order.printStatus!=='異常')return false;
    return true;
  });
}
export function archiveExpiredOrders(orders,now=Date.now()){
  return (Array.isArray(orders)?orders:[]).map(order=>{
    if(isHistory(order))return order;
    const acceptedAt=Number(order.acceptedAt||order.createdAt||0);
    const deadline=Number(order.autoCompleteAt)||(acceptedAt?acceptedAt+30*60_000:0);
    if(!deadline||Number(now)<deadline)return order;
    return {
      ...order,status:'completed',autoCompleteAt:deadline,completedAt:deadline,
      audit:[...(order.audit||[]),event('order_auto_completed','SYSTEM',deadline,{deadline})]
    };
  });
}
export function changeOrderPayment(order,{source,paymentMethod,channelData={},reason=''},terminalId,at=Date.now()){
  const policy=getChannelPolicy(source);
  const deferred=false;
  const pending=policy.initialPaymentStatus==='付款待核實'||deferred;
  const nextMethod=policy.requiresPaymentMethod&&!deferred?paymentMethod:policy.group==='platform'?'平台已付':'待核實';
  const previous={source:order.source,paymentMethod:order.paymentMethod,paymentStatus:order.paymentStatus};
  const next={source,group:policy.group,paymentMethod:nextMethod,paymentStatus:pending?'付款待核實':policy.initialPaymentStatus,reconciliationStatus:pending?'pending':policy.group==='platform'?'platform_paid':'not_required',channelData:{...channelData}};
  return {...order,...next,audit:[...(order.audit||[]),event('order_payment_changed',terminalId,at,{previous,next:{source:next.source,paymentMethod:next.paymentMethod,paymentStatus:next.paymentStatus},reason})]};
}
export function reconcilePayment(order,{paymentMethod,paidAmount},terminalId,at=Date.now()){
  const previous={paymentMethod:order.paymentMethod,paymentStatus:order.paymentStatus,reconciliationStatus:order.reconciliationStatus};
  return {...order,paymentMethod,paymentStatus:'已付款',reconciliationStatus:'verified',paidAmount:Number(paidAmount)||0,reconciledAt:at,audit:[...(order.audit||[]),event('payment_reconciled',terminalId,at,{previous,paymentMethod,paidAmount:Number(paidAmount)||0})]};
}
export function flagPaymentIssue(order,{reason,notifyCustomer=false},terminalId,at=Date.now()){
  const customerNotification=notifyCustomer?{status:'queued',reason,queuedAt:at}:order.customerNotification;
  return {...order,paymentStatus:'付款待核實',reconciliationStatus:'issue',reconciliationIssue:reason,customerNotification,audit:[...(order.audit||[]),event('payment_issue_flagged',terminalId,at,{reason,notifyCustomer})]};
}
export function partiallyCancelItem(order,itemIndex,quantity,terminalId,at=Date.now()){
  const items=(order.items||[]).map(x=>({...x}));
  const item=items[itemIndex],cancelQty=Math.min(Number(quantity)||0,Number(item?.qty)||0);
  if(!item||cancelQty<1)return order;
  const perUnit=Number(item.total||0)/Math.max(1,Number(item.qty)||1);
  item.qty-=cancelQty; item.cancelledQty=Number(item.cancelledQty||0)+cancelQty; item.total=Math.max(0,Number(item.total||0)-perUnit*cancelQty);
  return {...order,items,itemCount:items.reduce((n,x)=>n+Number(x.qty||0),0),amount:Math.max(0,Number(order.amount||0)-perUnit*cancelQty),version:Number(order.version||1)+1,audit:[...(order.audit||[]),event('order_item_partially_cancelled',terminalId,at,{itemIndex,quantity:cancelQty,amount:perUnit*cancelQty})]};
}
export function cancelOrder(order,terminalId,at=Date.now()){
  return {...order,status:'cancelled',cancelledAt:at,version:Number(order.version||1)+1,audit:[...(order.audit||[]),event('order_cancelled',terminalId,at)]};
}
export function queueReprint(order,documents,terminalId,at=Date.now()){
  const job={id:'PRINT-'+order.id+'-'+at,documents,status:'queued',terminalId,createdAt:at};
  return {...order,printStatus:'已排隊',printJobs:[...(order.printJobs||[]),job],audit:[...(order.audit||[]),event('order_reprint_queued',terminalId,at,{documents})]};
}
import {getChannelPolicy} from '../checkout/checkout-domain.js';
