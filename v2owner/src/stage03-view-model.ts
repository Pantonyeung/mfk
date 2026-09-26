import type {OwnerOrderProjection} from './product-types';

export type OwnerOrderScope='DEFAULT'|'ACTIVE'|'DINE_IN_OPEN';
export type OwnerOrderSegment='ACTIVE'|'COMPLETED';

export interface OwnerOrderFilters {
  readonly query:string;
  readonly businessDate:string;
  readonly source:string;
  readonly segment:OwnerOrderSegment;
  readonly paymentState:string;
  readonly fulfillmentMode:string;
}

export interface OwnerOrderListViewModel {
  readonly rows:readonly OwnerOrderProjection[];
  readonly businessDates:readonly string[];
  readonly sources:readonly string[];
  readonly paymentStates:readonly string[];
  readonly fulfillmentModes:readonly string[];
}

export interface OwnerOrderDetailViewModel {
  readonly identity:{
    readonly displayCode:string;
    readonly source:string;
    readonly businessDate:string;
    readonly customerName:string;
    readonly customerPhone:string;
  };
  readonly money:{
    readonly original:string;
    readonly adjustments:string;
    readonly effective:string;
    readonly tender:string;
  };
  readonly timing:{
    readonly elapsed:string;
    readonly promised:string;
  };
}

function isCompleted(order:OwnerOrderProjection){
  return order.lifecycle==='COMPLETED'||order.lifecycle==='CANCELLED';
}

function matchesScope(order:OwnerOrderProjection,scope:OwnerOrderScope){
  if(scope==='DEFAULT')return true;
  if(scope==='ACTIVE')return !isCompleted(order);
  if(scope==='DINE_IN_OPEN'){
    return !isCompleted(order)
      &&order.fulfillmentMode==='DINE_IN'
      &&(order.paymentState==='OPEN'||order.paymentState==='PARTIAL');
  }
  return false;
}

export function buildOwnerOrderListViewModel(
  orders:readonly OwnerOrderProjection[],
  filters:OwnerOrderFilters,
  scope:OwnerOrderScope,
):OwnerOrderListViewModel{
  const q=filters.query.trim().toLowerCase();
  const rows=orders.filter(order=>{
    const segmentOk=filters.segment==='COMPLETED'?isCompleted(order):!isCompleted(order);
    const dateOk=filters.businessDate==='ALL'||order.businessDate===filters.businessDate;
    const sourceOk=filters.source==='ALL'||order.source===filters.source;
    const paymentOk=filters.paymentState==='ALL'||order.paymentState===filters.paymentState;
    const fulfillmentOk=filters.fulfillmentMode==='ALL'||order.fulfillmentMode===filters.fulfillmentMode;
    const queryOk=!q||[
      order.displayCode,
      order.customerName??'',
      order.customerPhone??'',
      order.externalRef??'',
    ].join(' ').toLowerCase().includes(q);

    return matchesScope(order,scope)
      &&segmentOk
      &&dateOk
      &&sourceOk
      &&paymentOk
      &&fulfillmentOk
      &&queryOk;
  }).sort((a,b)=>b.observedAt.localeCompare(a.observedAt));

  return {
    rows,
    businessDates:['ALL',...Array.from(new Set(orders.map(order=>order.businessDate).filter((value):value is string=>Boolean(value))))],
    sources:['ALL',...Array.from(new Set(orders.map(order=>order.source)))],
    paymentStates:['ALL',...Array.from(new Set(orders.map(order=>order.paymentState).filter((value):value is string=>Boolean(value))))],
    fulfillmentModes:['ALL',...Array.from(new Set(orders.map(order=>order.fulfillmentMode).filter((value):value is string=>Boolean(value))))],
  };
}

export function buildOwnerOrderDetailViewModel(order:OwnerOrderProjection):OwnerOrderDetailViewModel{
  return {
    identity:{
      displayCode:order.displayCode,
      source:order.source,
      businessDate:order.businessDate??'未有讀回',
      customerName:order.customerName??'未有客戶名稱',
      customerPhone:order.customerPhone??'未有電話',
    },
    money:{
      original:order.originalAmountLabel??'未有讀回',
      adjustments:order.adjustmentAmountLabel??'未有調整摘要',
      effective:order.currentEffectiveAmountLabel??order.amountLabel??'未有讀回',
      tender:order.currentTenderLabel??order.tenderLabel??'未有讀回',
    },
    timing:{
      elapsed:order.elapsedLabel??'未有讀回',
      promised:order.promisedTimeLabel??'未有讀回',
    },
  };
}
