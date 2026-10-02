export interface MfpMoneyActor{
  readonly staffId:string;
  readonly displayName:string;
}

export interface MfpOpeningSuggestion{
  readonly amountMinor:number;
  readonly sourceReportId:string;
  readonly sourceBusinessDate:string;
}

export interface MfpBusinessDayOpening{
  readonly businessDayId:string;
  readonly businessDate:string;
  readonly amountMinor:number;
  readonly suggestedMinor?:number;
  readonly sourceReportId?:string;
  readonly sourceBusinessDate?:string;
  readonly changedFromSuggestion:boolean;
  readonly actor:MfpMoneyActor;
  readonly occurredAt:string;
  readonly note?:string;
}

export interface MfpCashMovement{
  readonly movementId:string;
  readonly businessDayId:string;
  readonly type:'CASH_IN'|'CASH_OUT';
  readonly amountMinor:number;
  readonly reason:string;
  readonly actor:MfpMoneyActor;
  readonly occurredAt:string;
  readonly note?:string;
}

export interface MfpCanonicalOrderMoneyFact{
  readonly orderRef:string;
  readonly channelId:string;
  readonly recognizedAmountMinor:number;
  readonly effectiveTenderId:string;
  readonly tenderAudit:readonly string[];
}

export interface MfpMoneySummaryRow{
  readonly id:string;
  readonly orderCount:number;
  readonly amountMinor:number;
}

export interface MfpDailyReport{
  readonly schema:'mfp.daily-report.money.v1';
  readonly reportVersion:'1.0';
  readonly reportId:string;
  readonly businessDate:string;
  readonly businessDayId:string;
  readonly closedAt:string;
  readonly orderCount:number;
  readonly grossSalesMinor:number;
  readonly cashSalesMinor:number;
  readonly cashInMinor:number;
  readonly cashOutMinor:number;
  readonly cashRefundAdjustmentMinor:number;
  readonly expectedCashMinor:number;
  readonly countedCashMinor:number;
  readonly varianceMinor:number;
  readonly cashRemovedMinor:number;
  readonly retainedCashMinor:number;
  readonly opening:MfpBusinessDayOpening;
  readonly movements:readonly MfpCashMovement[];
  readonly channelSummary:readonly MfpMoneySummaryRow[];
  readonly tenderSummary:readonly MfpMoneySummaryRow[];
}

export interface MfpDailyReportAdjustment{
  readonly schema:'mfp.daily-report.adjustment.v1';
  readonly adjustmentVersion:string;
  readonly adjustmentId:string;
  readonly type:'REFUND'|'PAYMENT_CORRECTION'|'ADJUSTMENT';
  readonly originalOrderRef:string;
  readonly originalReportId:string;
  readonly amountMinor:number;
  readonly occurredAt:string;
  readonly tenderId?:string;
  readonly note?:string;
}

const DENOMINATIONS_MINOR=Object.freeze([100,200,500,1000,2000,5000,10000,50000] as const);
const EXACT_ELECTRONIC_PROVIDERS=new Set(['ALIPAY','WECHAT','FPS','PAYME']);

function text(value:string,code:string){
  if(typeof value!=='string'||!value.trim()||value!==value.trim())throw new Error(code);
  return value;
}

function timestamp(value:string,code:string){
  text(value,code);
  if(!Number.isFinite(Date.parse(value)))throw new Error(code);
  return value;
}

function minor(value:number,code='MFP_MONEY_MINOR_INVALID'){
  if(!Number.isSafeInteger(value)||value<0)throw new Error(code);
  return value;
}

function actor(value:MfpMoneyActor){
  text(value.staffId,'MFP_MONEY_ACTOR_INVALID');
  text(value.displayName,'MFP_MONEY_ACTOR_INVALID');
  return Object.freeze({...value});
}

function deepFreeze<T>(value:T):T{
  if(value&&typeof value==='object'&&!Object.isFrozen(value)){
    Object.freeze(value);
    for(const child of Object.values(value as Record<string,unknown>))deepFreeze(child);
  }
  return value;
}

export function createMfpBusinessDayOpening(input:{
  readonly businessDayId:string;
  readonly businessDate:string;
  readonly amountMinor:number;
  readonly suggestion?:MfpOpeningSuggestion|null;
  readonly actor:MfpMoneyActor;
  readonly occurredAt:string;
  readonly note?:string;
}):MfpBusinessDayOpening{
  text(input.businessDayId,'MFP_BUSINESS_DAY_ID_INVALID');
  text(input.businessDate,'MFP_BUSINESS_DATE_INVALID');
  minor(input.amountMinor);
  timestamp(input.occurredAt,'MFP_OPENING_TIME_INVALID');
  const suggestion=input.suggestion??null;
  if(suggestion){
    minor(suggestion.amountMinor);text(suggestion.sourceReportId,'MFP_OPENING_SOURCE_INVALID');text(suggestion.sourceBusinessDate,'MFP_OPENING_SOURCE_INVALID');
  }
  return deepFreeze({
    businessDayId:input.businessDayId,businessDate:input.businessDate,amountMinor:input.amountMinor,
    ...(suggestion?{suggestedMinor:suggestion.amountMinor,sourceReportId:suggestion.sourceReportId,sourceBusinessDate:suggestion.sourceBusinessDate}:{}),
    changedFromSuggestion:Boolean(suggestion&&suggestion.amountMinor!==input.amountMinor),actor:actor(input.actor),
    occurredAt:input.occurredAt,...(input.note?.trim()?{note:input.note.trim()}:{}),
  });
}

export function createMfpCashMovement(input:{
  readonly movementId:string;
  readonly businessDayId:string;
  readonly type:'CASH_IN'|'CASH_OUT';
  readonly amountMinor:number;
  readonly reason:string;
  readonly actor:MfpMoneyActor;
  readonly occurredAt:string;
  readonly note?:string;
}):MfpCashMovement{
  text(input.movementId,'MFP_CASH_MOVEMENT_ID_INVALID');text(input.businessDayId,'MFP_BUSINESS_DAY_ID_INVALID');
  if(input.type!=='CASH_IN'&&input.type!=='CASH_OUT')throw new Error('MFP_CASH_MOVEMENT_TYPE_INVALID');
  if(minor(input.amountMinor)===0)throw new Error('MFP_CASH_MOVEMENT_AMOUNT_INVALID');
  text(input.reason,'MFP_CASH_MOVEMENT_REASON_INVALID');timestamp(input.occurredAt,'MFP_CASH_MOVEMENT_TIME_INVALID');
  return deepFreeze({...input,actor:actor(input.actor),...(input.note?.trim()?{note:input.note.trim()}:{}),});
}

export function appendMfpCashMovement(ledger:readonly MfpCashMovement[],movement:MfpCashMovement){
  const existing=ledger.find(row=>row.movementId===movement.movementId);
  if(existing){
    if(JSON.stringify(existing)!==JSON.stringify(movement))throw new Error('MFP_CASH_MOVEMENT_CONFLICT');
    return Object.freeze([...ledger]);
  }
  return Object.freeze([...ledger,movement]);
}

export function countMfpCashDenominations(counts:Readonly<Record<number,number>>){
  const allowed=new Set<number>(DENOMINATIONS_MINOR);
  let total=0;
  for(const [rawDenomination,quantity] of Object.entries(counts)){
    const denomination=Number(rawDenomination);
    if(!allowed.has(denomination)||!Number.isSafeInteger(quantity)||quantity<0)throw new Error('MFP_CASH_DENOMINATION_INVALID');
    total+=denomination*quantity;
    if(!Number.isSafeInteger(total))throw new Error('MFP_MONEY_MINOR_INVALID');
  }
  return total;
}

function summarize(orders:readonly MfpCanonicalOrderMoneyFact[],key:'channelId'|'effectiveTenderId'){
  const rows=new Map<string,{orderCount:number;amountMinor:number}>();
  for(const order of orders){
    const id=text(order[key],'MFP_ORDER_MONEY_FACT_INVALID');
    const current=rows.get(id)??{orderCount:0,amountMinor:0};
    current.orderCount+=1;current.amountMinor+=minor(order.recognizedAmountMinor,'MFP_ORDER_MONEY_FACT_INVALID');
    rows.set(id,current);
  }
  return Object.freeze([...rows].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([id,row])=>Object.freeze({id,...row})));
}

export function createMfpDailyReport(input:{
  readonly reportId:string;
  readonly businessDate:string;
  readonly opening:MfpBusinessDayOpening;
  readonly orders:readonly MfpCanonicalOrderMoneyFact[];
  readonly movements:readonly MfpCashMovement[];
  readonly cashRefundAdjustmentMinor:number;
  readonly countedCashMinor:number;
  readonly cashRemovedMinor:number;
  readonly closedAt:string;
}):MfpDailyReport{
  text(input.reportId,'MFP_DAILY_REPORT_ID_INVALID');text(input.businessDate,'MFP_BUSINESS_DATE_INVALID');
  timestamp(input.closedAt,'MFP_DAY_CLOSE_TIME_INVALID');
  if(input.opening.businessDate!==input.businessDate)throw new Error('MFP_DAY_CLOSE_OPENING_MISMATCH');
  if(input.movements.some(row=>row.businessDayId!==input.opening.businessDayId))throw new Error('MFP_CASH_MOVEMENT_BUSINESS_DAY_MISMATCH');
  for(const order of input.orders){
    text(order.orderRef,'MFP_ORDER_MONEY_FACT_INVALID');text(order.channelId,'MFP_ORDER_MONEY_FACT_INVALID');text(order.effectiveTenderId,'MFP_ORDER_MONEY_FACT_INVALID');
    minor(order.recognizedAmountMinor,'MFP_ORDER_MONEY_FACT_INVALID');
  }
  const grossSalesMinor=input.orders.reduce((sum,row)=>sum+row.recognizedAmountMinor,0);
  const cashSalesMinor=input.orders.filter(row=>row.effectiveTenderId==='CASH').reduce((sum,row)=>sum+row.recognizedAmountMinor,0);
  const cashInMinor=input.movements.filter(row=>row.type==='CASH_IN').reduce((sum,row)=>sum+row.amountMinor,0);
  const cashOutMinor=input.movements.filter(row=>row.type==='CASH_OUT').reduce((sum,row)=>sum+row.amountMinor,0);
  for(const value of [grossSalesMinor,cashSalesMinor,cashInMinor,cashOutMinor])minor(value);
  minor(input.cashRefundAdjustmentMinor);minor(input.countedCashMinor);minor(input.cashRemovedMinor);
  if(input.cashRemovedMinor>input.countedCashMinor)throw new Error('MFP_CASH_REMOVED_EXCEEDS_COUNTED');
  const expectedCashMinor=input.opening.amountMinor+cashSalesMinor+cashInMinor-input.cashRefundAdjustmentMinor-cashOutMinor;
  if(expectedCashMinor<0||!Number.isSafeInteger(expectedCashMinor))throw new Error('MFP_EXPECTED_CASH_INVALID');
  return deepFreeze({
    schema:'mfp.daily-report.money.v1',reportVersion:'1.0',reportId:input.reportId,businessDate:input.businessDate,
    businessDayId:input.opening.businessDayId,closedAt:input.closedAt,orderCount:input.orders.length,grossSalesMinor,
    cashSalesMinor,cashInMinor,cashOutMinor,cashRefundAdjustmentMinor:input.cashRefundAdjustmentMinor,
    expectedCashMinor,countedCashMinor:input.countedCashMinor,varianceMinor:input.countedCashMinor-expectedCashMinor,
    cashRemovedMinor:input.cashRemovedMinor,retainedCashMinor:input.countedCashMinor-input.cashRemovedMinor,
    opening:input.opening,movements:Object.freeze([...input.movements]),
    channelSummary:summarize(input.orders,'channelId'),tenderSummary:summarize(input.orders,'effectiveTenderId'),
  });
}

export function suggestMfpNextOpening(reports:readonly MfpDailyReport[],businessDate:string):MfpOpeningSuggestion|null{
  const previous=[...reports].filter(row=>row.businessDate<businessDate).sort((a,b)=>b.businessDate.localeCompare(a.businessDate)||b.closedAt.localeCompare(a.closedAt))[0];
  return previous?Object.freeze({amountMinor:previous.retainedCashMinor,sourceReportId:previous.reportId,sourceBusinessDate:previous.businessDate}):null;
}

export function classifyMfpLegacyElectronicTender(input:Readonly<{cash:boolean;provider:string|null}>){
  if(input.cash)return 'CASH';
  const provider=input.provider?.trim().toUpperCase()??'';
  return EXACT_ELECTRONIC_PROVIDERS.has(provider)?provider:'ELECTRONIC_UNCLASSIFIED';
}

export function appendMfpDailyReportAdjustment(
  ledger:readonly MfpDailyReportAdjustment[],
  report:MfpDailyReport,
  input:Omit<MfpDailyReportAdjustment,'schema'|'adjustmentVersion'|'originalReportId'>,
){
  const existing=ledger.find(row=>row.adjustmentId===input.adjustmentId);
  if(existing){
    const candidate={...existing,...input,originalReportId:report.reportId};
    if(JSON.stringify(existing)!==JSON.stringify(candidate))throw new Error('MFP_DAILY_REPORT_ADJUSTMENT_CONFLICT');
    return Object.freeze([...ledger]);
  }
  text(input.adjustmentId,'MFP_DAILY_REPORT_ADJUSTMENT_ID_INVALID');text(input.originalOrderRef,'MFP_DAILY_REPORT_ORDER_REF_INVALID');
  if(!['REFUND','PAYMENT_CORRECTION','ADJUSTMENT'].includes(input.type))throw new Error('MFP_DAILY_REPORT_ADJUSTMENT_TYPE_INVALID');
  minor(input.amountMinor);timestamp(input.occurredAt,'MFP_DAILY_REPORT_ADJUSTMENT_TIME_INVALID');
  const adjustment:MfpDailyReportAdjustment=deepFreeze({
    schema:'mfp.daily-report.adjustment.v1',adjustmentVersion:`1.${ledger.filter(row=>row.originalReportId===report.reportId).length+1}`,
    ...input,originalReportId:report.reportId,
  });
  return Object.freeze([...ledger,adjustment]);
}
