import type {MfpNormalizedOrderingIntent} from './ordering-domain.ts';
import type {MfpSecurityPort} from './security-port.ts';
import type {MfpStoreKernelCommandEnvelope,MfpStoreKernelResult} from './store-kernel-port.ts';

export type MfpOrderSource='WALK_IN'|'PHONE'|'WHATSAPP'|'MORE_FUN_APP'|'KEETA'|'FOODPANDA'|(string&{});
export type MfpOrderLane='DIRECT'|'OWN_PLATFORM'|'THIRD_PARTY';
export type MfpFulfillmentState='IN_PROGRESS'|'READY'|'PICKED_UP'|'CANCELLED';
export type MfpOrderLifecycleState='ACTIVE'|'COMPLETED'|'CANCELLED';

export interface MfpCanonicalOrderItem{
  readonly lineId:string;
  readonly productId?:string;
  readonly name:string;
  readonly quantity:number;
  readonly settledQuantity?:number;
  readonly unitMinor:number;
  readonly options?:readonly string[];
  readonly combo?:string;
  readonly note?:string;
}

export interface MfpOrderAdjustmentReference{
  readonly adjustmentId:string;
  readonly type:'PAYMENT_CORRECTION'|'REFUND'|'MODIFICATION';
  readonly status:'PENDING'|'COMMITTED'|'REJECTED';
  readonly amountMinor?:number;
  readonly tenderId?:string;
  readonly originalReportId?:string;
  readonly cashMovementRef?:string;
  readonly occurredAt:string;
}

export interface MfpCanonicalOrder{
  readonly orderId:string;
  readonly displayNumber:string;
  readonly source:MfpOrderSource;
  readonly externalOrderNumber?:string;
  readonly customerDisplayName?:string;
  readonly pickupCode?:string;
  readonly createdAt:string;
  readonly revision:string|number;
  readonly lifecycleState?:MfpOrderLifecycleState;
  readonly fulfillmentState:MfpFulfillmentState;
  readonly effectiveTenderId:string;
  readonly tenderAudit?:readonly string[];
  readonly recognizedAmountMinor:number;
  readonly outstandingAmountMinor:number;
  readonly refundableAmountMinor?:number;
  readonly serviceMode:'TAKEAWAY'|'DINE_IN';
  readonly items:readonly MfpCanonicalOrderItem[];
  readonly adjustments:readonly MfpOrderAdjustmentReference[];
  readonly dining?:Readonly<{waitingId?:string;tableId?:string;partySize:number;seatedAt?:string}>;
  readonly eta?:Readonly<{policyRevision:string|number;minutes:number;readyAt:string}>;
  readonly modificationState?:'NONE'|'CUSTOMER_CONFIRMATION_REQUIRED'|'CONFIRMED'|'REJECTED';
  readonly productionDispatched?:boolean;
  readonly cancelNoticeIntent?:'NOT_REQUIRED'|'CANCEL_NOTICE_REQUIRED';
  readonly humanCommunicationRequired?:boolean;
  readonly correctionPrintIntent?:false;
}

export const MFP_DINING_TABLE_IDS=Object.freeze([
  'T01','T02','T03','T04','T05','T06','T07','T08','OUTDOOR',
] as const);

export interface MfpDiningTableReadModel{
  readonly tableId:typeof MFP_DINING_TABLE_IDS[number];
  readonly label:string;
  readonly location:'INDOOR'|'OUTDOOR';
  readonly revision:string|number;
  readonly state:'AVAILABLE'|'OCCUPIED';
  readonly orderId?:string;
  readonly displayNumber?:string;
  readonly partySize?:number;
  readonly seatedAt?:string;
}

export interface MfpDiningWaitingReadModel{
  readonly waitingId:string;
  readonly displayNumber:string;
  readonly partySize:number;
  readonly createdAt:string;
  readonly customerDisplayName?:string;
  readonly orderId?:string;
}

export interface MfpAvailabilityItemReadModel{
  readonly productId:string;
  readonly name:string;
  readonly categoryId:string;
  readonly status:'AVAILABLE'|'SOLD_OUT'|'PAUSED';
  readonly riceGroupId?:string;
}

export interface MfpCapacityPoolReadModel{
  readonly poolId:string;
  readonly name:string;
  readonly businessDayId:string;
  readonly businessDate:string;
  readonly resetAt:string;
  readonly revision:string|number;
  readonly initialQuantity:number;
  readonly usedQuantity:number;
  readonly remainingQuantity:number;
  readonly boundProductIds:readonly string[];
  readonly consumptionByProduct:readonly Readonly<{productId:string;quantity:number}>[];
  readonly thirdPartyThreshold:number;
  readonly ownPlatformThreshold:number;
  readonly thirdPartyAccepting:boolean;
  readonly ownPlatformAccepting:boolean;
  readonly stoppedChannels:readonly string[];
  readonly overrideRemaining:number;
  readonly audit:readonly Readonly<{
    auditId:string;
    type:'MANUAL_CORRECTION'|'OVERRIDE';
    actorId:string;
    occurredAt:string;
    quantity:number;
    scope:string;
  }>[];
}

export interface MfpEtaPolicyReadModel{
  readonly revision:string|number;
  readonly workloadBands:readonly Readonly<{minimumActive:number;etaMinutes:number}>[];
  readonly diningWarningMinutes:number;
}

export interface MfpOrderOperationsReadModel{
  readonly schema:'mfp.order-operations.read.v1';
  readonly storeId:string;
  readonly revision:string|number;
  readonly readAt:string;
  readonly orders:readonly MfpCanonicalOrder[];
  readonly dining:Readonly<{revision:string|number;waiting:readonly MfpDiningWaitingReadModel[];tables:readonly MfpDiningTableReadModel[]}>;
  readonly availability:Readonly<{revision:string|number;items:readonly MfpAvailabilityItemReadModel[]}>;
  readonly capacity:Readonly<{revision:string|number;pools:readonly MfpCapacityPoolReadModel[]}>;
  readonly etaPolicy:MfpEtaPolicyReadModel;
  readonly todaySummary?:Readonly<{orderCount:number;recognizedAmountMinor:number;source:'A5_CANONICAL_MONEY_READBACK'}>;
}

function requiredText(value:unknown,code:string,max=240){
  if(typeof value!=='string'||!value.trim()||value!==value.trim()||value.length>max)throw new Error(code);
  return value;
}

function validRevision(value:unknown,code='MFP_ORDER_OPERATION_REVISION_INVALID'){
  if(typeof value==='string')return requiredText(value,code);
  if(!Number.isSafeInteger(value)||Number(value)<0)throw new Error(code);
  return Number(value);
}

function minor(value:unknown,code='MFP_ORDER_MONEY_INVALID'){
  if(!Number.isSafeInteger(value)||Number(value)<0)throw new Error(code);
  return Number(value);
}

function positive(value:unknown,code:string){
  if(!Number.isSafeInteger(value)||Number(value)<1)throw new Error(code);
  return Number(value);
}

function instant(value:unknown,code:string){
  const text=requiredText(value,code,64);
  if(!Number.isFinite(Date.parse(text)))throw new Error(code);
  return text;
}

function deepFreeze<T>(value:T):T{
  if(value&&typeof value==='object'&&!Object.isFrozen(value)){
    Object.freeze(value);
    for(const child of Object.values(value as Record<string,unknown>))deepFreeze(child);
  }
  return value;
}

export function validateMfpCanonicalOrder(value:MfpCanonicalOrder):MfpCanonicalOrder{
  requiredText(value.orderId,'MFP_ORDER_READBACK_INVALID');requiredText(value.displayNumber,'MFP_ORDER_READBACK_INVALID');
  requiredText(value.source,'MFP_ORDER_READBACK_INVALID');instant(value.createdAt,'MFP_ORDER_READBACK_INVALID');
  validRevision(value.revision,'MFP_ORDER_READBACK_INVALID');
  if(!['IN_PROGRESS','READY','PICKED_UP','CANCELLED'].includes(value.fulfillmentState))throw new Error('MFP_ORDER_READBACK_INVALID');
  requiredText(value.effectiveTenderId,'MFP_ORDER_READBACK_INVALID');minor(value.recognizedAmountMinor,'MFP_ORDER_READBACK_INVALID');
  minor(value.outstandingAmountMinor,'MFP_ORDER_READBACK_INVALID');
  if(value.refundableAmountMinor!==undefined)minor(value.refundableAmountMinor,'MFP_ORDER_READBACK_INVALID');
  if(value.serviceMode!=='TAKEAWAY'&&value.serviceMode!=='DINE_IN')throw new Error('MFP_ORDER_READBACK_INVALID');
  if(!Array.isArray(value.items)||!value.items.length||!Array.isArray(value.adjustments))throw new Error('MFP_ORDER_READBACK_INVALID');
  const lines=new Set<string>();
  for(const item of value.items){
    requiredText(item.lineId,'MFP_ORDER_READBACK_INVALID');requiredText(item.name,'MFP_ORDER_READBACK_INVALID');
    if(lines.has(item.lineId))throw new Error('MFP_ORDER_READBACK_INVALID');
    lines.add(item.lineId);positive(item.quantity,'MFP_ORDER_READBACK_INVALID');minor(item.unitMinor,'MFP_ORDER_READBACK_INVALID');
    if(item.settledQuantity!==undefined&&(!Number.isSafeInteger(item.settledQuantity)||item.settledQuantity<0||item.settledQuantity>item.quantity))throw new Error('MFP_ORDER_READBACK_INVALID');
  }
  if(value.dining?.seatedAt!==undefined)instant(value.dining.seatedAt,'MFP_ORDER_READBACK_INVALID');
  return deepFreeze(value);
}

export function validateMfpOrderOperationsReadModel(value:MfpOrderOperationsReadModel):MfpOrderOperationsReadModel{
  if(value.schema!=='mfp.order-operations.read.v1')throw new Error('MFP_ORDER_OPERATIONS_READBACK_INVALID');
  requiredText(value.storeId,'MFP_ORDER_OPERATIONS_READBACK_INVALID');validRevision(value.revision,'MFP_ORDER_OPERATIONS_READBACK_INVALID');
  instant(value.readAt,'MFP_ORDER_OPERATIONS_READBACK_INVALID');
  if(!Array.isArray(value.orders)||!Array.isArray(value.dining?.waiting)||!Array.isArray(value.dining?.tables)
    ||!Array.isArray(value.availability?.items)||!Array.isArray(value.capacity?.pools)||!Array.isArray(value.etaPolicy?.workloadBands))throw new Error('MFP_ORDER_OPERATIONS_READBACK_INVALID');
  const orderIds=new Set<string>();
  for(const order of value.orders){
    validateMfpCanonicalOrder(order);
    if(orderIds.has(order.orderId))throw new Error('MFP_ORDER_OPERATIONS_READBACK_INVALID');
    orderIds.add(order.orderId);
  }
  const tableIds=value.dining.tables.map(table=>table.tableId);
  if(tableIds.length!==MFP_DINING_TABLE_IDS.length||MFP_DINING_TABLE_IDS.some(id=>!tableIds.includes(id)))throw new Error('MFP_DINING_TABLE_REGISTRY_INVALID');
  for(const table of value.dining.tables){
    validRevision(table.revision,'MFP_ORDER_OPERATIONS_READBACK_INVALID');
    if(table.state==='OCCUPIED'&&(!table.orderId||!table.seatedAt))throw new Error('MFP_ORDER_OPERATIONS_READBACK_INVALID');
    if(table.seatedAt)instant(table.seatedAt,'MFP_ORDER_OPERATIONS_READBACK_INVALID');
  }
  for(const waiting of value.dining.waiting){
    requiredText(waiting.waitingId,'MFP_ORDER_OPERATIONS_READBACK_INVALID');positive(waiting.partySize,'MFP_ORDER_OPERATIONS_READBACK_INVALID');
    instant(waiting.createdAt,'MFP_ORDER_OPERATIONS_READBACK_INVALID');
  }
  for(const pool of value.capacity.pools){
    requiredText(pool.poolId,'MFP_ORDER_OPERATIONS_READBACK_INVALID');requiredText(pool.businessDayId,'MFP_ORDER_OPERATIONS_READBACK_INVALID');
    instant(pool.resetAt,'MFP_ORDER_OPERATIONS_READBACK_INVALID');
    for(const amount of [pool.initialQuantity,pool.usedQuantity,pool.remainingQuantity,pool.thirdPartyThreshold,pool.ownPlatformThreshold,pool.overrideRemaining])minor(amount,'MFP_ORDER_OPERATIONS_READBACK_INVALID');
  }
  for(const band of value.etaPolicy.workloadBands){minor(band.minimumActive,'MFP_ETA_POLICY_INVALID');positive(band.etaMinutes,'MFP_ETA_POLICY_INVALID');}
  positive(value.etaPolicy.diningWarningMinutes,'MFP_ETA_POLICY_INVALID');
  return deepFreeze(value);
}

export function mfpOrderLane(source:MfpOrderSource):MfpOrderLane{
  if(['WALK_IN','PHONE','WHATSAPP'].includes(source))return 'DIRECT';
  return source==='MORE_FUN_APP'?'OWN_PLATFORM':'THIRD_PARTY';
}

export function filterMfpOrders(orders:readonly MfpCanonicalOrder[],filter:Readonly<{lane?:MfpOrderLane;source?:MfpOrderSource;tenderId?:string}>){
  return Object.freeze(orders.filter(order=>(!filter.lane||mfpOrderLane(order.source)===filter.lane)
    &&(!filter.source||order.source===filter.source)&&(!filter.tenderId||order.effectiveTenderId===filter.tenderId)));
}

export function countMfpEtaWorkload(orders:readonly MfpCanonicalOrder[]){
  return orders.filter(order=>order.fulfillmentState==='IN_PROGRESS'&&order.lifecycleState!=='CANCELLED').length;
}

export function selectMfpEtaMinutes(policy:MfpEtaPolicyReadModel,activeWorkload:number){
  if(!Number.isSafeInteger(activeWorkload)||activeWorkload<0)throw new Error('MFP_ETA_WORKLOAD_INVALID');
  const bands=[...policy.workloadBands].sort((a,b)=>a.minimumActive-b.minimumActive);
  return [...bands].reverse().find(band=>activeWorkload>=band.minimumActive)?.etaMinutes??null;
}

export function isMfpDiningWarning(table:MfpDiningTableReadModel,policy:MfpEtaPolicyReadModel,now=Date.now()){
  if(table.state!=='OCCUPIED'||!table.seatedAt)return false;
  return now-Date.parse(table.seatedAt)>=policy.diningWarningMinutes*60_000;
}

export interface MfpSplitCheckoutUnit{readonly unitId:string;readonly lineId:string;readonly unitIndex:number;readonly name:string}
export interface MfpSplitCheckoutPlan{readonly orderId:string;readonly expectedRevision:string|number;readonly units:readonly MfpSplitCheckoutUnit[];readonly maxParts:number}
export interface MfpFormalOrderCheckoutPart{
  readonly schema:'mfp.checkout.formal-order-part.v1';readonly orderId:string;readonly expectedRevision:string|number;readonly partId:string;readonly unitIds:readonly string[];
}
export interface MfpA5CheckoutEntry{openFormalOrderPart(part:MfpFormalOrderCheckoutPart):unknown}

export function createMfpSplitCheckoutPlan(order:MfpCanonicalOrder):MfpSplitCheckoutPlan{
  validateMfpCanonicalOrder(order);
  const units=order.items.flatMap(item=>Array.from({length:item.quantity-(item.settledQuantity??0)},(_,index)=>Object.freeze({
    unitId:`${item.lineId}::${(item.settledQuantity??0)+index+1}`,lineId:item.lineId,
    unitIndex:(item.settledQuantity??0)+index+1,name:item.name,
  })));
  return Object.freeze({orderId:order.orderId,expectedRevision:order.revision,units:Object.freeze(units),maxParts:units.length});
}

export function createMfpSplitCheckoutPart(plan:MfpSplitCheckoutPlan,partId:string,unitIds:readonly string[]):MfpFormalOrderCheckoutPart{
  requiredText(partId,'MFP_SPLIT_PART_ID_INVALID');
  const selected=[...new Set(unitIds)];
  if(!selected.length||selected.length!==unitIds.length||selected.some(id=>!plan.units.some(unit=>unit.unitId===id)))throw new Error('MFP_SPLIT_UNITS_INVALID');
  return Object.freeze({schema:'mfp.checkout.formal-order-part.v1',orderId:plan.orderId,expectedRevision:plan.expectedRevision,partId,unitIds:Object.freeze(selected)});
}

export function openMfpSplitCheckout(entry:MfpA5CheckoutEntry,part:MfpFormalOrderCheckoutPart){return entry.openFormalOrderPart(part);}

export function filterMfpAvailabilityItems(items:readonly MfpAvailabilityItemReadModel[],filter:Readonly<{search?:string;categoryId?:string;status?:MfpAvailabilityItemReadModel['status']}>){
  const search=filter.search?.trim().toLocaleLowerCase()??'';
  return Object.freeze(items.filter(item=>(!search||item.name.toLocaleLowerCase().includes(search)||item.productId.toLocaleLowerCase().includes(search))
    &&(!filter.categoryId||item.categoryId===filter.categoryId)&&(!filter.status||item.status===filter.status)));
}

interface OperationBase{readonly expectedRevision:string|number}
export type MfpOrderOperation=
  |Readonly<OperationBase&{kind:'SET_FULFILLMENT';orderId:string;target:'IN_PROGRESS'|'READY'|'PICKED_UP'}>
  |Readonly<OperationBase&{kind:'REQUEST_MODIFICATION';orderId:string;reason:string}>
  |Readonly<OperationBase&{kind:'CORRECT_PAYMENT';orderId:string;toTenderId:string}>
  |Readonly<OperationBase&{kind:'REFUND';orderId:string;scope:'FULL'|'PARTIAL';amountMinor:number;refundTenderId:string;lineUnits?:readonly Readonly<{lineId:string;quantity:number}>[]}>
  |Readonly<OperationBase&{kind:'CANCEL';orderId:string;reason:string}>
  |Readonly<OperationBase&{kind:'ADMIT_DINING_ORDER';intent:MfpNormalizedOrderingIntent;target:Readonly<{kind:'TABLE';tableId:string;partySize:number}|{kind:'WAITING';waitingId:string;partySize:number}>}>
  |Readonly<OperationBase&{kind:'CREATE_WAITING';partySize:number;customerDisplayName?:string;note?:string}>
  |Readonly<OperationBase&{kind:'ASSIGN_TABLE';waitingId:string;tableId:string;expectedTableRevision:string|number;orderId?:string}>
  |Readonly<OperationBase&{kind:'TRANSFER_TABLE';orderId:string;fromTableId:string;toTableId:string;expectedTableRevision:string|number}>
  |Readonly<OperationBase&{kind:'ADD_DINING_ITEMS';orderId:string;items:readonly Readonly<{productId:string;quantity:number}>[]}>
  |Readonly<OperationBase&{kind:'SET_AVAILABILITY';productIds:readonly string[];status:'AVAILABLE'|'SOLD_OUT'|'PAUSED'}>
  |Readonly<OperationBase&{kind:'CORRECT_CAPACITY';poolId:string;remainingQuantity:number;reason:string}>
  |Readonly<OperationBase&{kind:'CREATE_CAPACITY_OVERRIDE';poolId:string;scope:string;quantity:number;reason:string}>;

export type MfpOrderOperationOutcome=
  |Readonly<{state:'COMMITTED';result:Extract<MfpStoreKernelResult,{state:'COMMITTED'}>;order:MfpCanonicalOrder|null;snapshot:MfpOrderOperationsReadModel|null}>
  |Readonly<{state:'REJECTED';result:Extract<MfpStoreKernelResult,{state:'REJECTED'}>;order:null;snapshot:null}>
  |Readonly<{state:'UNKNOWN';result:Extract<MfpStoreKernelResult,{state:'UNKNOWN'}>|Extract<MfpStoreKernelResult,{state:'COMMITTED'}>;order:null;snapshot:null;readbackRequired:true}>;

type OrderOperationSecurity=Pick<MfpSecurityPort,'submitFrontlineFormalCommand'>;
export interface MfpOrderOperationsReadPort{
  readOrder(orderId:string):Promise<MfpCanonicalOrder|null>;
  readOperations?():Promise<MfpOrderOperationsReadModel>;
}

export function createMfpRefundOperation(order:MfpCanonicalOrder,input:Readonly<{
  scope:'FULL'|'PARTIAL';amountMinor:number;refundTenderId:string;lineUnits?:readonly Readonly<{lineId:string;quantity:number}>[];
}>):Extract<MfpOrderOperation,{kind:'REFUND'}>{
  const eligible=order.refundableAmountMinor;
  if(eligible===undefined)throw new Error('MFP_REFUND_ELIGIBLE_AMOUNT_REQUIRED');
  const amount=positive(input.amountMinor,'MFP_REFUND_AMOUNT_INVALID');
  if(amount>eligible)throw new Error('MFP_REFUND_EXCEEDS_ELIGIBLE_AMOUNT');
  if(input.scope==='PARTIAL'&&!(input.lineUnits?.length))throw new Error('MFP_PARTIAL_REFUND_UNITS_REQUIRED');
  return Object.freeze({kind:'REFUND',orderId:order.orderId,expectedRevision:order.revision,scope:input.scope,
    amountMinor:amount,refundTenderId:requiredText(input.refundTenderId,'MFP_REFUND_TENDER_REQUIRED'),
    ...(input.lineUnits?{lineUnits:Object.freeze([...input.lineUnits])}:{}),
  });
}

export function createMfpRiceGroupAvailabilityOperation(model:MfpOrderOperationsReadModel,riceGroupId:string,status:'AVAILABLE'|'SOLD_OUT'|'PAUSED'):Extract<MfpOrderOperation,{kind:'SET_AVAILABILITY'}>{
  const group=requiredText(riceGroupId,'MFP_RICE_GROUP_ID_REQUIRED');
  const productIds=model.availability.items.filter(item=>item.riceGroupId===group).map(item=>item.productId);
  if(!productIds.length)throw new Error('MFP_RICE_GROUP_UNBOUND');
  return Object.freeze({kind:'SET_AVAILABILITY',expectedRevision:model.availability.revision,productIds:Object.freeze(productIds),status});
}

function commandForOperation(operation:MfpOrderOperation){
  switch(operation.kind){
    case 'SET_FULFILLMENT':return {commandType:'ORDER_FULFILLMENT_SET',payload:{orderId:operation.orderId,target:operation.target}};
    case 'REQUEST_MODIFICATION':return {commandType:'ORDER_MODIFICATION_REQUEST',payload:{orderId:operation.orderId,reason:requiredText(operation.reason,'MFP_ORDER_MODIFICATION_REASON_REQUIRED')}};
    case 'CORRECT_PAYMENT':return {commandType:'ORDER_PAYMENT_CORRECTION',payload:{orderId:operation.orderId,toTenderId:requiredText(operation.toTenderId,'MFP_PAYMENT_CORRECTION_TENDER_REQUIRED')}};
    case 'REFUND':return {commandType:'ORDER_REFUND',payload:{orderId:operation.orderId,scope:operation.scope,amountMinor:positive(operation.amountMinor,'MFP_REFUND_AMOUNT_INVALID'),refundTenderId:requiredText(operation.refundTenderId,'MFP_REFUND_TENDER_REQUIRED'),lineUnits:operation.lineUnits??[]}};
    case 'CANCEL':return {commandType:'ORDER_CANCEL',payload:{orderId:operation.orderId,reason:requiredText(operation.reason,'MFP_ORDER_CANCEL_REASON_REQUIRED')}};
    case 'ADMIT_DINING_ORDER':return {commandType:'DINING_FORMAL_ADMIT',payload:{intent:operation.intent,target:operation.target}};
    case 'CREATE_WAITING':return {commandType:'DINING_WAITING_CREATE',payload:{partySize:positive(operation.partySize,'MFP_DINING_PARTY_SIZE_INVALID'),customerDisplayName:operation.customerDisplayName??'',note:operation.note??''}};
    case 'ASSIGN_TABLE':return {commandType:'DINING_TABLE_ASSIGN',payload:{waitingId:requiredText(operation.waitingId,'MFP_DINING_WAITING_ID_REQUIRED'),tableId:requiredText(operation.tableId,'MFP_DINING_TABLE_ID_REQUIRED'),expectedTableRevision:validRevision(operation.expectedTableRevision),...(operation.orderId?{orderId:operation.orderId}:{})}};
    case 'TRANSFER_TABLE':return {commandType:'DINING_TABLE_TRANSFER',payload:{orderId:operation.orderId,fromTableId:requiredText(operation.fromTableId,'MFP_DINING_TABLE_ID_REQUIRED'),toTableId:requiredText(operation.toTableId,'MFP_DINING_TABLE_ID_REQUIRED'),expectedTableRevision:validRevision(operation.expectedTableRevision)}};
    case 'ADD_DINING_ITEMS':return {commandType:'DINING_ITEMS_ADD',payload:{
      orderId:operation.orderId,
      items:operation.items.map(item=>({
        productId:requiredText(item.productId,'MFP_DINING_ADDITION_PRODUCT_REQUIRED'),
        quantity:positive(item.quantity,'MFP_DINING_ADDITION_QUANTITY_INVALID'),
      })),
    }};
    case 'SET_AVAILABILITY':{
      const productIds=[...new Set(operation.productIds.map(id=>requiredText(id,'MFP_AVAILABILITY_PRODUCT_ID_REQUIRED')))];
      if(!productIds.length)throw new Error('MFP_AVAILABILITY_PRODUCT_REQUIRED');
      return {commandType:'RUNTIME_AVAILABILITY_SET',payload:{productIds,status:operation.status}};
    }
    case 'CORRECT_CAPACITY':return {commandType:'CAPACITY_POOL_CORRECT',payload:{poolId:requiredText(operation.poolId,'MFP_CAPACITY_POOL_ID_REQUIRED'),remainingQuantity:minor(operation.remainingQuantity,'MFP_CAPACITY_QUANTITY_INVALID'),reason:requiredText(operation.reason,'MFP_CAPACITY_REASON_REQUIRED')}};
    case 'CREATE_CAPACITY_OVERRIDE':return {commandType:'CAPACITY_OVERRIDE_CREATE',payload:{poolId:requiredText(operation.poolId,'MFP_CAPACITY_POOL_ID_REQUIRED'),scope:requiredText(operation.scope,'MFP_CAPACITY_SCOPE_REQUIRED'),quantity:positive(operation.quantity,'MFP_CAPACITY_OVERRIDE_QUANTITY_INVALID'),reason:requiredText(operation.reason,'MFP_CAPACITY_REASON_REQUIRED')}};
  }
}

function knownOrderId(operation:MfpOrderOperation){return 'orderId' in operation?operation.orderId:undefined;}

export function createMfpOrderOperationSession(input:{
  readonly storeId?:string;
  readonly operation:MfpOrderOperation;
  readonly operationId:string;
  readonly security:OrderOperationSecurity;
  readonly authority:MfpOrderOperationsReadPort;
  readonly now?:()=>string;
}){
  const operationId=requiredText(input.operationId,'MFP_ORDER_OPERATION_ID_INVALID');
  const expectedRevision=validRevision(input.operation.expectedRevision);
  const createdAt=(input.now??(()=>new Date().toISOString()))();
  if(!Number.isFinite(Date.parse(createdAt)))throw new Error('MFP_ORDER_OPERATION_TIME_INVALID');
  const material=commandForOperation(input.operation);
  const command:Omit<MfpStoreKernelCommandEnvelope,'deviceId'|'staffSessionRef'>=Object.freeze({
    schema:'mfp.store-kernel.command.v1',storeId:requiredText(input.storeId??'MF01','MFP_ORDER_OPERATION_STORE_ID_INVALID'),
    submissionId:operationId,idempotencyKey:operationId,commandType:material.commandType,
    expectedRevision,payload:deepFreeze(material.payload),createdAt,
  });
  let active:Promise<MfpOrderOperationOutcome>|null=null;
  let terminal:MfpOrderOperationOutcome|null=null;

  const committedReadback=async(result:Extract<MfpStoreKernelResult,{state:'COMMITTED'}>):Promise<MfpOrderOperationOutcome>=>{
    const expectedOrderId=knownOrderId(input.operation)??(input.operation.kind==='ADMIT_DINING_ORDER'?result.orderRef:undefined);
    if(knownOrderId(input.operation)&&result.orderRef!==undefined&&result.orderRef!==expectedOrderId)throw new Error('MFP_ORDER_OPERATION_IDENTITY_MISMATCH');
    try{
      if(expectedOrderId){
        const order=await input.authority.readOrder(expectedOrderId);
        if(!order||order.orderId!==expectedOrderId)throw new Error('MFP_ORDER_OPERATION_READBACK_REQUIRED');
        const outcome:MfpOrderOperationOutcome=Object.freeze({state:'COMMITTED',result,order:validateMfpCanonicalOrder(order),snapshot:null});
        terminal=outcome;return outcome;
      }
      if(!input.authority.readOperations)throw new Error('MFP_ORDER_OPERATIONS_READBACK_REQUIRED');
      const snapshot=validateMfpOrderOperationsReadModel(await input.authority.readOperations());
      const outcome:MfpOrderOperationOutcome=Object.freeze({state:'COMMITTED',result,order:null,snapshot});
      terminal=outcome;return outcome;
    }catch{
      return Object.freeze({state:'UNKNOWN',result,order:null,snapshot:null,readbackRequired:true});
    }
  };

  const submit=()=>{
    if(active)return active;
    if(terminal)return Promise.resolve(terminal);
    const task=input.security.submitFrontlineFormalCommand(command).then(result=>{
      if(result.state==='COMMITTED')return committedReadback(result);
      if(result.state==='REJECTED'){
        const outcome:MfpOrderOperationOutcome=Object.freeze({state:'REJECTED',result,order:null,snapshot:null});
        terminal=outcome;return outcome;
      }
      return Object.freeze({state:'UNKNOWN' as const,result,order:null,snapshot:null,readbackRequired:true as const});
    }).finally(()=>{if(active===task)active=null;});
    active=task;
    return task;
  };

  return Object.freeze({submit,command});
}
