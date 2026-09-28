import type {OwnerCanonicalFulfillmentState,OwnerOrderProjection} from './product-types';

export type OwnerOrderScope='DEFAULT'|'ACTIVE'|'DINE_IN_OPEN';
export type OwnerOrderSegment='ACTIVE'|'COMPLETED';
export type OwnerFulfillmentDisplayState='未完成'|'可取餐'|'已取餐'|'已取消';

export interface OwnerOrderFilters {
  readonly query:string;
  readonly businessDate:string;
  readonly source:string;
  readonly segment:OwnerOrderSegment;
  readonly paymentState:string;
  readonly fulfillmentState:'ALL'|OwnerFulfillmentDisplayState;
}

export interface OwnerOrderListViewModel {
  readonly rows:readonly OwnerOrderProjection[];
  readonly businessDates:readonly string[];
  readonly sources:readonly string[];
  readonly paymentStates:readonly string[];
  readonly fulfillmentStates:readonly ('ALL'|OwnerFulfillmentDisplayState)[];
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
  readonly fulfillment:{
    readonly state:string;
    readonly mode:string;
  };
}

export const DEFAULT_OWNER_ORDER_FILTERS:OwnerOrderFilters={
  query:'',
  businessDate:'ALL',
  source:'ALL',
  segment:'ACTIVE',
  paymentState:'ALL',
  fulfillmentState:'ALL',
};

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

export function mapCanonicalFulfillmentState(
  value:OwnerCanonicalFulfillmentState|undefined,
):OwnerFulfillmentDisplayState|null{
  if(value==='待處理'||value==='進行中')return '未完成';
  if(value==='可取餐')return '可取餐';
  if(value==='已完成')return '已取餐';
  if(value==='已取消')return '已取消';
  return null;
}

export function getOwnerOrderFulfillmentStateLabel(order:OwnerOrderProjection):string{
  return mapCanonicalFulfillmentState(order.fulfillmentLabel)??'未有交收狀態資料';
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
    const canonicalState=mapCanonicalFulfillmentState(order.fulfillmentLabel);
    const fulfillmentOk=filters.fulfillmentState==='ALL'||canonicalState===filters.fulfillmentState;
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
    fulfillmentStates:['ALL','未完成','可取餐','已取餐','已取消'],
  };
}

export function buildOwnerOrderDetailViewModel(order:OwnerOrderProjection):OwnerOrderDetailViewModel{
  return {
    identity:{
      displayCode:order.displayCode,
      source:order.source,
      businessDate:order.businessDate??'未有資料',
      customerName:order.customerName??'未有客戶名稱',
      customerPhone:order.customerPhone??'未有電話',
    },
    money:{
      original:order.originalAmountLabel??'未有資料',
      adjustments:order.adjustmentAmountLabel??'未有調整摘要',
      effective:order.currentEffectiveAmountLabel??order.amountLabel??'未有資料',
      tender:order.currentTenderLabel??order.tenderLabel??'未有資料',
    },
    timing:{
      elapsed:order.elapsedLabel??'未有資料',
      promised:order.promisedTimeLabel??'未有資料',
    },
    fulfillment:{
      state:getOwnerOrderFulfillmentStateLabel(order),
      mode:formatFulfillmentMode(order.fulfillmentMode),
    },
  };
}

function formatFulfillmentMode(value:OwnerOrderProjection['fulfillmentMode']):string{
  if(value==='DINE_IN')return '堂食';
  if(value==='TAKEAWAY')return '外賣';
  if(value==='PICKUP')return '自取';
  if(value==='DELIVERY')return '配送';
  return value??'未有交收方式資料';
}
