import {printBytesLan,printTextLan} from './native-print.ts';
import {renderTscRasterLabel} from './label-bitmap.ts';
import {renderEscPosRasterTicket} from './ticket-bitmap.ts';
import {buildOrderPrintPlan,groupTscBitmapJobsByPhysicalPrinter,type PrintBinding,type PlannedPrintJob} from './print-routing.ts';
import {queueOrderProjection} from './projection-outbox.ts';
import {hasStaffPermission,readActiveStaffSession} from './staff-auth.ts';
import {readSmtDiningTableRegistry,readSmtPrintConfig,readSmtStoreSettings} from './admin-operational-config.ts';
import {mirrorKeetaOrderCommand,type KeetaProviderMirrorResult} from './keeta-provider-commands.ts';
import {buildDailyClosePrintData,renderDailyCloseTicket} from './daily-close-ticket.ts';
import {buildLocalReport,readLocalDayCloses,resolveBusinessWindow} from './local-operations.ts';
import {readBusinessCutoff} from './cash-opening.ts';
import {readSmtDeviceId} from './admin-config-sync.ts';
import {validateAdminRefundEvent,type AdminRefundEvent} from '../../../contracts/admin-refund-v1.ts';

export interface SmtOperationalMetric{readonly id:string;readonly label:string;readonly value:string;readonly detail?:string}
export interface SmtOrderListItemViewModel{readonly orderId:string;readonly orderIdLabel:string;readonly itemCount:number;readonly totalLabel:string;readonly paymentLabel:string;readonly fulfillmentLabel:string;readonly sourceLabel?:string;readonly localSequenceLabel?:string}
export interface SmtOrderDetailLineViewModel{readonly id:string;readonly name:string;readonly quantity:number;readonly unitLabel:string;readonly lineTotalLabel:string}
export interface SmtOrderDetailViewModel extends SmtOrderListItemViewModel{readonly attention:readonly string[];readonly metrics:readonly SmtOperationalMetric[];readonly lines:readonly SmtOrderDetailLineViewModel[];readonly diningHoldId?:string;readonly recognizedSalesMinor?:number;readonly outstandingMinor?:number;readonly paymentEvidenceRef?:string;readonly paymentVerificationState?:'PENDING'|'VERIFIED'|'REJECTED';readonly customerPhone?:string;readonly paymentCorrections?:readonly PaymentCorrectionRecord[];readonly refunds?:readonly OrderRefundRecord[];readonly cancellationNoticeState?:'DONE'|'FAILED'|'UNKNOWN'}
export interface SmtOrdersProjection{readonly items:readonly SmtOrderListItemViewModel[];readonly detailsByOrderId?:Readonly<Record<string,SmtOrderDetailViewModel>>;readonly selectedOrderId?:string;readonly selectedOrder?:SmtOrderDetailViewModel}
export interface SmtDiningQueueItemViewModel{
  readonly id:string;
  readonly codeLabel:string;
  readonly partySize:number;
  readonly statusLabel:string;
  readonly formalOrderId?:string;
  readonly itemCount?:number;
  readonly totalMinor?:number;
  readonly paidMinor?:number;
  readonly remainingMinor?:number;
}
export interface SmtDiningTableViewModel{readonly id:string;readonly areaLabel:string;readonly label:string;readonly state:'available'|'occupied'|'attention'|'settled';readonly partySize?:number;readonly outstandingLabel?:string;readonly holdId?:string;readonly startedAt?:string;readonly itemCount?:number;readonly itemSummary?:string;readonly totalMinor?:number;readonly paidMinor?:number;readonly remainingMinor?:number}
export interface SmtDiningSessionViewModel{readonly sessionId:string;readonly tableLabels:readonly string[];readonly statusLabel:string;readonly metrics:readonly SmtOperationalMetric[]}
export interface SmtDiningProjection{readonly businessDate:string;readonly revision:number;readonly queue:readonly SmtDiningQueueItemViewModel[];readonly tables:readonly SmtDiningTableViewModel[];readonly selectedSession?:SmtDiningSessionViewModel}
export type SmtAvailabilityStatus='available'|'soldout'|'paused';
export interface SmtAvailabilityNodeViewModel{readonly nodeId:string;readonly label:string;readonly detail?:string;readonly status:SmtAvailabilityStatus;readonly sourceLabel?:string}
export interface SmtAvailabilityProjection{readonly revision:number;readonly nodes:readonly SmtAvailabilityNodeViewModel[];readonly canChange:boolean}

export interface PaymentCorrectionRecord{
  readonly id:string;
  readonly createdAt:string;
  readonly from:string;
  readonly to:string;
  readonly staffId?:string;
  readonly staffName?:string;
}

export interface OrderRefundLineRecord{
  readonly lineId:string;
  readonly itemName:string;
  readonly quantity:number;
  readonly amountMinor:number;
}
export interface OrderRefundRecord{
  readonly id:string;
  readonly createdAt:string;
  readonly kind:'FULL'|'PARTIAL';
  readonly amountMinor:number;
  readonly method:string;
  readonly note:string;
  readonly lines:readonly OrderRefundLineRecord[];
  readonly staffId?:string;
  readonly staffName?:string;
}

export interface StoredOrder{
  id:string;display:string;createdAt:string;updatedAt?:string;totalMinor:number;paymentLabel:string;fulfillmentLabel:'待處理'|'進行中'|'可取餐'|'已完成'|'已取消';sourceLabel:string;
  paymentCorrections?:readonly PaymentCorrectionRecord[];
  refunds?:readonly OrderRefundRecord[];
  diningHoldId?:string;
  recognizedSalesMinor?:number;
  outstandingMinor?:number;
  paymentEntries?:readonly LocalDiningPayment[];
  diningInitialPrintAttemptedAt?:string;
  diningInitialPrintCompletedAt?:string;
  diningInitialPrintState?:'DONE'|'FAILED'|'UNKNOWN';
  diningInitialPrintPlanned?:number;
  diningInitialPrintSent?:number;
  diningInitialPrintFailed?:number;
  productionIssuedAt?:string;
  cancellationNoticeAttemptedAt?:string;
  cancellationNoticePrintedAt?:string;
  cancellationNoticeState?:'DONE'|'FAILED'|'UNKNOWN';
  staffId?:string;staffName?:string;cancellationReason?:string;
  providerRef?:string;providerMessageId?:string;providerPickupCode?:string;orderRemark?:string;utensilPreference?:'需要'|'不需要';
  providerLastEventId?:number;providerLastEventName?:string;providerLastEventAt?:string;providerLastMessageId?:string;providerLifecycleNote?:string;
  acceptancePrintedAt?:string;
  paymentEvidenceRef?:string;paymentVerificationState?:'PENDING'|'VERIFIED'|'REJECTED';customerPhone?:string;
  items:readonly {id:string;name:string;qty:number;unitMinor:number;serviceMode?:'takeaway'|'dine-in';productCode?:string;detail?:string}[];
}
export type DiningTender='CASH'|'ALIPAY'|'WECHAT'|'FPS'|'PAYME'|'COMBO';
export interface DiningSettlementCommand{
  readonly submissionId:string;
  readonly expectedRevision:string;
  readonly receivedMinor?:number;
  readonly splitTenders?:readonly {readonly tender:Exclude<DiningTender,'COMBO'>;readonly amountMinor:number}[];
}
export interface DiningInitialPrintResult{
  readonly orderId:string;
  readonly state:'DONE'|'FAILED'|'UNKNOWN';
  readonly planned:number;
  readonly sent:number;
  readonly failed:number;
}
export interface DiningPaymentReceiptResult{
  readonly orderId:string;
  readonly paymentId:string;
  readonly submissionId?:string;
  readonly state:'DONE'|'FAILED'|'UNKNOWN';
  readonly planned:number;
  readonly sent:number;
  readonly failed:number;
}
export interface DiningAdditionPrintResult{
  readonly orderId:string;
  readonly additionId:string;
  readonly submissionId:string;
  readonly state:'DONE'|'FAILED'|'UNKNOWN';
  readonly planned:number;
  readonly sent:number;
  readonly failed:number;
}
export interface LocalDiningAddition{
  readonly id:string;
  readonly submissionId:string;
  readonly requestSignature?:string;
  readonly createdAt:string;
  readonly totalMinor:number;
  readonly sourceLabel?:string;
  readonly items:readonly {id:string;name:string;qty:number;unitMinor:number}[];
  readonly printAttemptedAt?:string;
  readonly printCompletedAt?:string;
  readonly printState?:'DONE'|'FAILED'|'UNKNOWN';
  readonly printPlanned?:number;
  readonly printSent?:number;
  readonly printFailed?:number;
}
export interface LocalDiningPayment{
  readonly submissionId?:string;
  readonly requestSignature?:string;
  readonly receivedMinor?:number;
  readonly changeMinor?:number;
  readonly id:string;
  readonly createdAt:string;
  readonly tender:DiningTender;
  readonly amountMinor:number;
  readonly splitTenders?:readonly {readonly tender:Exclude<DiningTender,'COMBO'>;readonly amountMinor:number}[];
  readonly receiptAttemptedAt?:string;
  readonly receiptCompletedAt?:string;
  readonly receiptState?:'DONE'|'FAILED'|'UNKNOWN';
  readonly receiptPlanned?:number;
  readonly receiptSent?:number;
  readonly receiptFailed?:number;
  readonly selections:readonly {lineIndex:number;qty:number;amountMinor:number}[];
}
export interface LocalDiningLineViewModel{
  readonly lineIndex:number;
  readonly id:string;
  readonly name:string;
  readonly qty:number;
  readonly paidQty:number;
  readonly remainingQty:number;
  readonly unitMinor:number;
}
export interface LocalDiningHoldDetail{
  readonly checkoutRevision:string;
  readonly archivedAt?:string;
  readonly cancelledAt?:string;
  readonly lastAssignedTable?:string;
  readonly seatedAt?:string;
  readonly formalOrderId?:string;
  readonly formalOrderDisplay?:string;
  readonly holdId:string;
  readonly codeLabel:string;
  readonly assignedTable?:string;
  readonly createdAt:string;
  readonly partySize:number;
  readonly note:string;
  readonly totalMinor:number;
  readonly paidMinor:number;
  readonly remainingMinor:number;
  readonly lines:readonly LocalDiningLineViewModel[];
  readonly payments:readonly LocalDiningPayment[];
  readonly additions:readonly LocalDiningAddition[];
}
export interface LocalHoldDraft{
  readonly archivedAt?:string;
  readonly cancelledAt?:string;
  readonly lastAssignedTable?:string;
  readonly seatedAt?:string;
  readonly formalOrderId?:string;
  readonly formalOrderDisplay?:string;
  readonly id:string;
  readonly codeLabel:string;
  readonly kind:'dining'|'waiting';
  readonly createdAt:string;
  readonly partySize:number;
  readonly note:string;
  readonly totalMinor:number;
  readonly assignedTable?:string;
  readonly payments?:readonly LocalDiningPayment[];
  readonly additions?:readonly LocalDiningAddition[];
  readonly providerRef?:string;
  readonly sourceLabel?:string;
  readonly smmSubmissionRefs?:readonly string[];
  readonly items:readonly {id:string;name:string;qty:number;unitMinor:number}[];
}
interface Persisted{orders:StoredOrder[];availability:Record<string,SmtAvailabilityStatus>;holds:LocalHoldDraft[];diningRevision?:number}
const KEY='mfk.v2local.runtime.v1';
const PRINTER_BINDING_KEY='mfk.v2local.printers.v5';
const LEGACY_PRINTER_BINDING_KEYS=['mfk.v2local.printers.v4','mfk.v2local.printers.v3','mfk.v2local.printers.v2'] as const;
const RICEBALL_PRODUCT_IDS=Object.freeze(['riceball','tuna','pork']);
const TAKEAWAY_PRODUCT_IDS=Object.freeze(['bento','curry','wedges','milkTea','lemonTea']);
const listeners=new Set<()=>void>();
const defaults:Persisted={orders:[],availability:{},holds:[]};
const clone=<T,>(value:T):T=>JSON.parse(JSON.stringify(value)) as T;
function read():Persisted{
  try{
    const value=JSON.parse(localStorage.getItem(KEY)||'null');
    if(!value||typeof value!=='object')return clone(defaults);
    const orders=(Array.isArray(value.orders)?value.orders:[]).map((order:any)=>{
      const source=String(order?.sourceLabel||'');
      const paid=Boolean(String(order?.paymentLabel||'').trim());
      const legacyLocal=source.startsWith('現場')||source.startsWith('SMM')||source.startsWith('電話')||source.startsWith('WhatsApp');
      return {...order,fulfillmentLabel:order?.fulfillmentLabel==='待處理'&&paid&&legacyLocal?'進行中':order?.fulfillmentLabel};
    }) as StoredOrder[];
    return {orders,availability:value.availability||{},holds:Array.isArray(value.holds)?value.holds:[],diningRevision:Number.isSafeInteger(value.diningRevision)?value.diningRevision:0};
  }catch{return clone(defaults)}
}
let data=read();
let runtimeIdentitySequence=0;
function nextRuntimeIdentity(prefix:'MFK-'|'HOLD-'|'ACT-'){
  const stamp=Date.now().toString(36);
  for(let attempt=0;attempt<4096;attempt++){
    runtimeIdentitySequence=(runtimeIdentitySequence+1)%0x1000000;
    const id=prefix+stamp+'-'+runtimeIdentitySequence.toString(36);
    if(prefix==='MFK-'&&!data.orders.some(order=>order.id===id))return id;
    if(prefix==='HOLD-'&&!data.holds.some(hold=>hold.id===id))return id;
    if(prefix==='ACT-')return id;
  }
  throw new Error('LOCAL_IDENTITY_EXHAUSTED');
}
function save(){localStorage.setItem(KEY,JSON.stringify(data));listeners.forEach(fn=>fn())}
function projectOrder(order:StoredOrder){queueOrderProjection(order)}
const money=(minor:number)=>String.fromCharCode(36)+(minor/100).toFixed(2);

export interface SmtReprintOption{readonly jobId:string;readonly role:string;readonly label:string;readonly detail?:string;readonly bindingId:string;readonly printerName:string;readonly physicalKey:string}
export interface CleanSmtCoreRuntimePort{
  subscribe(listener:()=>void):()=>void;
  readOrders?(selectedOrderId?:string):Promise<SmtOrdersProjection>;
  acceptOrder?(orderId:string):Promise<{readonly orderId:string;readonly status:'ACCEPTED';readonly provider:KeetaProviderMirrorResult}>;
  readPaymentEvidence?(orderId:string):Promise<{readonly objectUrl:string}>;
  reviewPaymentEvidence?(orderId:string,decision:'VERIFIED'|'REJECTED'):Promise<{readonly orderId:string;readonly state:'VERIFIED'|'REJECTED'}>;
  markOrderReady?(orderId:string):Promise<{readonly orderId:string;readonly canonicalRevision:number;readonly status:'READY';readonly provider:KeetaProviderMirrorResult}>;
  printOrderReceipt?(orderId:string):Promise<{readonly printJobId:string;readonly state:string}>;
  printDailyClose?(businessDate?:string):Promise<{readonly printJobId:string;readonly state:string;readonly businessDate:string}>;
  printOrderOutputs?(orderId:string):Promise<PrintDispatchSummary>;
  readOrderReprintOptions?(orderId:string):Promise<readonly SmtReprintOption[]>;
  reprintOrderJobs?(orderId:string,jobIds:readonly string[],reason?:string):Promise<PrintDispatchSummary>;
  updateOrderItems?(orderId:string,items:readonly {id:string;name:string;qty:number;unitMinor:number}[]):Promise<{readonly orderId:string;readonly totalMinor:number}>;
  correctOrderPayment?(orderId:string,paymentLabel:string):Promise<StoredOrder>;
  refundOrder?(orderId:string,input:{lineId:string;quantity:number;amountMinor:number;method:string;note?:string}):Promise<StoredOrder>;
  applyAdminRefundEvent?(input:unknown):{readonly disposition:'APPLIED'|'IDEMPOTENT';readonly refundId:string;readonly orderId:string};
  cancelOrder?(orderId:string,reason?:string):Promise<{readonly orderId:string;readonly status:'CANCELLED'}>;
  applyProviderLifecycle?(input:{
    orderId:string;eventId:1002|1003|1004|1006|1008;eventName:string;providerMessageId:string;providerPushedAt:string;rawMessage:string;
  }):{readonly orderId:string;readonly disposition:'APPLIED'|'EVIDENCE_ONLY'|'IDEMPOTENT'|'CONFLICT';readonly fulfillmentLabel:StoredOrder['fulfillmentLabel']};
  readDining?(selectedSessionId?:string):Promise<SmtDiningProjection>;
  readAvailability?():Promise<SmtAvailabilityProjection>;
  setAvailability?(nodeId:string,status:SmtAvailabilityStatus,expectedRevision:number):Promise<SmtAvailabilityProjection>;
  createDiningWait?(input:{partySize:number;note?:string}):Promise<LocalHoldDraft>;
  removeDiningWait?(id:string):Promise<void>;
  admitDiningHold?(holdId:string):Promise<LocalDiningHoldDetail>;
  assignDiningTable?(holdId:string,tableId:string):Promise<void>;
  unassignDiningTable?(holdId:string):Promise<void>;
  readDiningHold?(holdId:string):Promise<LocalDiningHoldDetail>;
  readDiningHistory?():Promise<readonly LocalDiningHoldDetail[]>;
  ensureDiningInitialPrint?(holdId:string):Promise<DiningInitialPrintResult>;
  ensureDiningPaymentReceipt?(holdId:string,submissionId:string):Promise<DiningPaymentReceiptResult>;
  appendDiningItems?(holdId:string,input:{submissionId:string;items:readonly {id:string;name:string;qty:number;unitMinor:number}[];totalMinor:number;sourceLabel?:string}):Promise<{readonly detail:LocalDiningHoldDetail;readonly additionId:string}>;
  ensureDiningAdditionPrint?(holdId:string,additionId:string):Promise<DiningAdditionPrintResult>;
  settleDiningHold?(holdId:string,selections:readonly {lineIndex:number;qty:number}[],tender:DiningTender,command?:DiningSettlementCommand):Promise<LocalDiningHoldDetail>;
  clearDiningHold?(holdId:string):Promise<void>;
}
export interface PrintDispatchResult{readonly jobId:string;readonly role:string;readonly ok:boolean;readonly code:string}
export interface PrintDispatchSummary{
  readonly orderId:string;
  readonly planned:number;
  readonly sent:number;
  readonly failed:number;
  readonly results:readonly PrintDispatchResult[];
}

export interface PrintPhysicalDiagnostic{
  readonly physicalKey:string;
  readonly bindingIds:readonly string[];
  readonly roles:readonly string[];
  readonly planned:number;
  readonly ok:boolean;
  readonly code:string;
  readonly elapsedMs:number;
}
export interface PrintDispatchDiagnostic{
  readonly orderId:string;
  readonly display:string;
  readonly createdAt:string;
  readonly elapsedMs:number;
  readonly planned:number;
  readonly sent:number;
  readonly failed:number;
  readonly physical:readonly PrintPhysicalDiagnostic[];
}
const PRINT_DIAGNOSTIC_KEY='mfk.v2local.print-diagnostic.v1';
const ACTION_AUDIT_KEY='mfk.v2local.action-audit.v1';
function appendActionAudit(input:{action:string;orderId:string;reason?:string}){
  try{
    const rows=JSON.parse(localStorage.getItem(ACTION_AUDIT_KEY)||'[]');
    const current=Array.isArray(rows)?rows:[];
    current.unshift({id:nextRuntimeIdentity('ACT-'),at:new Date().toISOString(),...input});
    localStorage.setItem(ACTION_AUDIT_KEY,JSON.stringify(current.slice(0,1000)));
  }catch{}
}
export function readLastPrintDiagnostic():PrintDispatchDiagnostic|null{
  try{
    const value=JSON.parse(localStorage.getItem(PRINT_DIAGNOSTIC_KEY)||'null');
    return value&&typeof value==='object'?value as PrintDispatchDiagnostic:null;
  }catch{return null}
}
export interface MfkLocalRuntime extends CleanSmtCoreRuntimePort{
  createOrder(input:{
    items:readonly {id:string;name:string;qty:number;unitMinor:number;serviceMode?:'takeaway'|'dine-in';productCode?:string;detail?:string}[];
    totalMinor:number;
    paymentLabel:string;
    sourceLabel?:string;
    providerRef?:string;
    providerMessageId?:string;
    providerPickupCode?:string;
    orderRemark?:string;
    utensilPreference?:'需要'|'不需要';
    paymentEvidenceRef?:string;
    paymentVerificationState?:'PENDING'|'VERIFIED'|'REJECTED';
    customerPhone?:string;
    initialFulfillmentLabel?:StoredOrder['fulfillmentLabel'];
  }):StoredOrder;
  orders():readonly StoredOrder[];
  acceptOrder(orderId:string):Promise<{readonly orderId:string;readonly status:'ACCEPTED';readonly provider:KeetaProviderMirrorResult}>;
  printOrderOutputs(orderId:string):Promise<PrintDispatchSummary>;
  printDailyClose(businessDate?:string):Promise<{readonly printJobId:string;readonly state:string;readonly businessDate:string}>;
  readOrderReprintOptions(orderId:string):Promise<readonly SmtReprintOption[]>;
  reprintOrderJobs(orderId:string,jobIds:readonly string[],reason?:string):Promise<PrintDispatchSummary>;
  updateOrderItems(orderId:string,items:readonly {id:string;name:string;qty:number;unitMinor:number}[]):Promise<{readonly orderId:string;readonly totalMinor:number}>;
  correctOrderPayment(orderId:string,paymentLabel:string):Promise<StoredOrder>;
  refundOrder(orderId:string,input:{lineId:string;quantity:number;amountMinor:number;method:string;note?:string}):Promise<StoredOrder>;
  applyAdminRefundEvent(input:unknown):{readonly disposition:'APPLIED'|'IDEMPOTENT';readonly refundId:string;readonly orderId:string};
  cancelOrder(orderId:string,reason?:string):Promise<{readonly orderId:string;readonly status:'CANCELLED'}>;
  applyProviderLifecycle(input:{
    orderId:string;eventId:1002|1003|1004|1006|1008;eventName:string;providerMessageId:string;providerPushedAt:string;rawMessage:string;
  }):{readonly orderId:string;readonly disposition:'APPLIED'|'EVIDENCE_ONLY'|'IDEMPOTENT'|'CONFLICT';readonly fulfillmentLabel:StoredOrder['fulfillmentLabel']};
  createHold(input:{kind:'dining'|'waiting';items:readonly {id:string;name:string;qty:number;unitMinor:number}[];totalMinor:number;partySize?:number;note?:string}):LocalHoldDraft;
  upsertSmmDiningHold(input:{providerRef:string;target:{kind:'TABLE'|'WAITING';tableId?:string;covers?:number};items:readonly {id:string;name:string;qty:number;unitMinor:number}[];totalMinor:number;sourceLabel?:string}):LocalHoldDraft;
  holds():readonly LocalHoldDraft[];
  removeHold(id:string):void;
  readDiningHold(holdId:string):Promise<LocalDiningHoldDetail>;
  readDiningHistory():Promise<readonly LocalDiningHoldDetail[]>;
  admitDiningHold(holdId:string):Promise<LocalDiningHoldDetail>;
  ensureDiningInitialPrint(holdId:string):Promise<DiningInitialPrintResult>;
  ensureDiningPaymentReceipt(holdId:string,submissionId:string):Promise<DiningPaymentReceiptResult>;
  appendDiningItems(holdId:string,input:{submissionId:string;items:readonly {id:string;name:string;qty:number;unitMinor:number}[];totalMinor:number;sourceLabel?:string}):Promise<{readonly detail:LocalDiningHoldDetail;readonly additionId:string}>;
  ensureDiningAdditionPrint(holdId:string,additionId:string):Promise<DiningAdditionPrintResult>;
  settleDiningHold(holdId:string,selections:readonly {lineIndex:number;qty:number}[],tender:DiningTender,command?:DiningSettlementCommand):Promise<LocalDiningHoldDetail>;
  unassignDiningTable(holdId:string):Promise<void>;
  clearDiningHold(holdId:string):Promise<void>;
  clear():void;
}

function fallbackProductIds(id:string,routeKey:string):readonly string[]{
  if(id==='product-label-1'||routeKey==='logical.product-label.riceball')return RICEBALL_PRODUCT_IDS;
  if(id==='product-label-2'||routeKey==='logical.product-label.takeaway')return TAKEAWAY_PRODUCT_IDS;
  return [];
}

function readPrinterBindings():PrintBinding[]{
  try{
    const currentRaw=localStorage.getItem(PRINTER_BINDING_KEY);
    let raw=currentRaw;
    let usingLegacy=false;
    if(!raw){
      for(const key of LEGACY_PRINTER_BINDING_KEYS){
        const candidate=localStorage.getItem(key);
        if(candidate){raw=candidate;usingLegacy=true;break;}
      }
    }
    const value=JSON.parse(raw||'[]');
    if(!Array.isArray(value))return [];
    let rows=value
      .filter(row=>row&&typeof row==='object')
      .map(row=>{
        const capability=(row.capability==='label-58mm'?'label-58mm':'receipt-80mm/kitchen') as PrintBinding['capability'];
        const encoding=(
          capability==='label-58mm'
            ? (row.encoding==='utf-8'?'utf-8':usingLegacy?'big5':row.encoding==='big5'?'big5':'big5')
            : (row.encoding==='big5'||row.encoding==='utf-8'?row.encoding:'gb18030')
        ) as PrintBinding['encoding'];
        const id=String(row.id||'');
        const routeKey=String(row.routeKey||'');
        const role=String(row.role||'') as PrintBinding['role'];
        const productIds=role==='產品標籤'
          ? (Array.isArray(row.productIds)?row.productIds.map(String):[...fallbackProductIds(id,routeKey)])
          : undefined;
        return {
          id,
          routeKey,
          name:String(row.name||'LAN PRINTER'),
          model:String(row.model||'LAN PRINTER'),
          role,
          host:String(row.host||''),
          port:Number(row.port)||9100,
          capability,
          encoding,
          logicalPrinterId:typeof row.logicalPrinterId==='string'?row.logicalPrinterId:undefined,
          ...(productIds===undefined?{}:{productIds}),
        };
      })
      .filter(row=>row.id&&['顧客小票','製作單','打包單','產品標籤','袋標籤'].includes(row.role));

    const takeawayIndex=rows.findIndex(row=>row.id==='product-label-2');
    const takeaway=takeawayIndex>=0?rows[takeawayIndex]:undefined;
    const bag=rows.find(row=>row.role==='袋標籤'&&String(row.host||'').trim());
    if((!takeaway||!String(takeaway.host||'').trim())&&bag){
      const derived:PrintBinding={
        id:'product-label-2',
        routeKey:'logical.product-label.takeaway',
        name:'外賣標籤機',
        model:bag.model,
        role:'產品標籤',
        host:bag.host,
        port:bag.port,
        capability:'label-58mm',
        encoding:bag.encoding,
        productIds:[...TAKEAWAY_PRODUCT_IDS],
      };
      if(takeawayIndex>=0)rows=rows.map((row,index)=>index===takeawayIndex?derived:row);
      else rows=[...rows,derived];
    }
    if(usingLegacy)localStorage.setItem(PRINTER_BINDING_KEY,JSON.stringify(rows));
    return rows;
  }catch{return []}
}

function concatPrintBytes(parts:readonly Uint8Array[]):Uint8Array{
  const total=parts.reduce((sum,part)=>sum+part.length,0);
  const output=new Uint8Array(total);
  let offset=0;
  for(const part of parts){output.set(part,offset);offset+=part.length;}
  return output;
}

function printerInput(binding:PrintBinding){
  return {
    endpointId:binding.id,
    host:binding.host.trim(),
    port:Number(binding.port)||9100,
    displayName:binding.name,
    model:binding.model,
    capability:binding.capability,
    encoding:binding.encoding,
  };
}

function pushDispatchResults(results:PrintDispatchResult[],jobs:readonly PlannedPrintJob[],ok:boolean,code:string){
  for(const job of jobs)results.push({jobId:job.id,role:job.role,ok,code});
}

function physicalKey(binding:PrintBinding){
  return binding.host.trim().toLowerCase()+':'+(Number(binding.port)||9100);
}

async function dispatchCancellationNotice(order:StoredOrder){
  const seen=new Set<string>();
  const bindings=readPrinterBindings().filter(binding=>{
    if(binding.role!=='製作單'||!String(binding.host||'').trim()||Number(binding.port)<=0)return false;
    const key=physicalKey(binding);
    if(seen.has(key))return false;
    seen.add(key);
    return true;
  });
  if(!bindings.length)return {ok:false,code:'CANCEL_NOTICE_PRODUCTION_ROUTE_MISSING',state:'FAILED' as const};
  let sent=0;
  let lastCode='CANCEL_NOTICE_FAILED';
  for(const binding of bindings){
    try{
      const result=await printTextLan({
        ...printerInput(binding),
        text:'\n*** 取消通知單 ***\n#'+order.display+' 已取消\n來源：'+order.sourceLabel
          +(order.cancellationReason?'\n原因：'+order.cancellationReason:'')
          +'\n時間：'+new Date().toLocaleString('zh-HK')
          +'\n*** 停止製作／如已製作請通知前台 ***\n\n',
        cutAfter:true,
        kickDrawer:false,
        beepAfter:true,
      });
      if(result.ok)sent+=1;
      else lastCode=result.code||lastCode;
    }catch{
      return {ok:false,code:'CANCEL_NOTICE_OUTCOME_UNKNOWN',state:'UNKNOWN' as const};
    }
  }
  return sent===bindings.length
    ?{ok:true,code:'CANCEL_NOTICE_SENT',state:'DONE' as const}
    :{ok:false,code:lastCode,state:'FAILED' as const};
}

async function dispatchOrderOutputs(order:StoredOrder,requestedJobIds?:ReadonlySet<string>,reprint=false,mode:'standard'|'dining-initial'|'dining-payment'|'dining-addition'='standard'):Promise<PrintDispatchSummary>{
  const started=performance.now();
  let plan=[...buildOrderPrintPlan(order,readPrinterBindings(),readSmtPrintConfig(),mode)];
  if(requestedJobIds)plan=plan.filter(job=>requestedJobIds.has(job.id));
  if(reprint)plan=plan.map(job=>({...job,kickDrawer:false}));
  const groups=new Map<string,PlannedPrintJob[]>();
  for(const job of plan){
    const key=physicalKey(job.binding);
    const existing=groups.get(key);
    if(existing)existing.push(job);
    else groups.set(key,[job]);
  }

  const groupResults=await Promise.all([...groups.entries()].map(async([key,jobs])=>{
    const groupStarted=performance.now();
    const results:PrintDispatchResult[]=[];
    let groupCode='SENT';
    try{
      const bitmapOnly=jobs.every(job=>job.renderMode==='tsc-bitmap'&&job.labelSpec);
      if(bitmapOnly){
        const payloads=await Promise.all(jobs.map(job=>renderTscRasterLabel(job.labelSpec!)));
        const result=await printBytesLan({...printerInput(jobs[0]!.binding),bytes:concatPrintBytes(payloads)});
        groupCode=result.code||(result.ok?'SENT':'PRINT_FAILED');
        pushDispatchResults(results,jobs,result.ok,groupCode);
      }else{
        for(const job of jobs){
          try{
            const result=job.renderMode==='tsc-bitmap'&&job.labelSpec
              ?await printBytesLan({...printerInput(job.binding),bytes:await renderTscRasterLabel(job.labelSpec)})
              :job.renderMode==='escpos-raster'&&job.ticketKind&&job.ticketOrder
                ?await printBytesLan({...printerInput(job.binding),bytes:await renderEscPosRasterTicket({
                  kind:job.ticketKind,
                  order:job.ticketOrder,
                  cutAfter:job.cutAfter,
                  kickDrawer:job.kickDrawer,
                  beepAfter:job.beepAfter,
                })})
                :await printTextLan({...printerInput(job.binding),text:job.payload,cutAfter:job.cutAfter,kickDrawer:job.kickDrawer,beepAfter:job.beepAfter});
            const code=result.code||(result.ok?'SENT':'PRINT_FAILED');
            results.push({jobId:job.id,role:job.role,ok:result.ok,code});
            if(!result.ok)groupCode=code;
          }catch(error){
            const code=error instanceof Error?error.message:'PRINT_FAILED';
            results.push({jobId:job.id,role:job.role,ok:false,code});
            groupCode=code;
          }
        }
      }
    }catch(error){
      groupCode=error instanceof Error?error.message:'PRINT_FAILED';
      const unresolved=jobs.filter(job=>!results.some(row=>row.jobId===job.id));
      pushDispatchResults(results,unresolved,false,groupCode);
    }
    return {
      results,
      diagnostic:{
        physicalKey:key,
        bindingIds:Object.freeze([...new Set(jobs.map(job=>job.binding.id))]),
        roles:Object.freeze([...new Set(jobs.map(job=>job.role))]),
        planned:jobs.length,
        ok:results.every(row=>row.ok),
        code:groupCode,
        elapsedMs:Math.round(performance.now()-groupStarted),
      } satisfies PrintPhysicalDiagnostic,
    };
  }));

  const results=groupResults.flatMap(group=>group.results);
  const sent=results.filter(result=>result.ok).length;
  const summary=Object.freeze({
    orderId:order.id,
    planned:plan.length,
    sent,
    failed:plan.length-sent,
    results:Object.freeze(results.map(result=>Object.freeze(result))),
  });
  const diagnostic:PrintDispatchDiagnostic={
    orderId:order.id,
    display:order.display,
    createdAt:new Date().toISOString(),
    elapsedMs:Math.round(performance.now()-started),
    planned:summary.planned,
    sent:summary.sent,
    failed:summary.failed,
    physical:Object.freeze(groupResults.map(group=>Object.freeze(group.diagnostic))),
  };
  localStorage.setItem(PRINT_DIAGNOSTIC_KEY,JSON.stringify(diagnostic));
  const productionIssued=summary.results.some(row=>row.role==='製作單'&&row.ok);
  if(productionIssued&&order.fulfillmentLabel!=='已取消'){
    const current=data.orders.find(row=>row.id===order.id);
    if(current&&!current.productionIssuedAt){
      const productionIssuedAt=new Date().toISOString();
      data={...data,orders:data.orders.map(row=>row.id===order.id?{...row,productionIssuedAt,updatedAt:productionIssuedAt}:row)};
      save();
      const updated=data.orders.find(row=>row.id===order.id);
      if(updated)projectOrder(updated);
      appendActionAudit({action:'PRODUCTION_ISSUED',orderId:order.id});
    }
  }
  listeners.forEach(fn=>fn());
  return summary;
}

const productNames:Record<string,string>={
  riceball:'原味飯團',tuna:'紫菜吞拿魚飯團',pork:'泡菜豬肉飯團',bento:'肉燥便當',
  curry:'咖喱便當',wedges:'香脆薯角',milkTea:'台式奶茶',lemonTea:'手打檸檬茶'
};

// C1 Dining settlement reliability: one durable local envelope, fresh-read before mutation,
// durable-write-before-memory-success, stable submission replay, stale-revision fail closed.
function readDiningState():Persisted{
  const raw=localStorage.getItem(KEY);
  if(raw===null)return clone(defaults);
  const value=JSON.parse(raw);
  if(!value||!Array.isArray(value.orders)||!Array.isArray(value.holds)||!value.availability||typeof value.availability!=='object'){
    throw new Error('DINING_STORAGE_INVALID');
  }
  return {
    ...value,
    orders:value.orders as StoredOrder[],
    holds:value.holds as LocalHoldDraft[],
    availability:value.availability as Record<string,SmtAvailabilityStatus>,
    diningRevision:Number.isSafeInteger(value.diningRevision)?value.diningRevision:0,
  };
}
function commitDiningState(snapshot:Persisted,input:{holds?:LocalHoldDraft[];orders?:StoredOrder[]}){
  const next:Persisted={
    ...snapshot,
    holds:input.holds??snapshot.holds,
    orders:input.orders??snapshot.orders,
    diningRevision:(snapshot.diningRevision??0)+1,
  };
  localStorage.setItem(KEY,JSON.stringify(next));
  data=next;
  for(const listener of listeners){try{listener();}catch{console.warn('DINING_OBSERVER_FAILED');}}
  return next;
}
function commitDiningHolds(snapshot:Persisted,holds:LocalHoldDraft[]){
  return commitDiningState(snapshot,{holds});
}
function diningCheckoutRevision(hold:LocalHoldDraft){return 'DINING2:'+JSON.stringify(hold);}
function requireDiningHold(snapshot:Persisted,id:string){
  const hold=snapshot.holds.find(row=>row.id===id);
  if(!hold)throw new Error('HOLD_NOT_FOUND');
  if(hold.kind!=='dining')throw new Error('NOT_DINING_HOLD');
  return hold;
}
function archiveDiningHold(hold:LocalHoldDraft,at:string):LocalHoldDraft{
  const {assignedTable,...rest}=hold;
  return {...rest,archivedAt:hold.archivedAt??at,...(assignedTable?{lastAssignedTable:assignedTable}:{})};
}
function cancelDiningHold(hold:LocalHoldDraft,at:string):LocalHoldDraft{
  return {...archiveDiningHold(hold,at),cancelledAt:hold.cancelledAt??at};
}
function diningPaymentLabel(payments:readonly LocalDiningPayment[]){
  if(!payments.length)return '未收款';
  const tenders=[...new Set(payments.map(payment=>payment.tender))];
  return tenders.length===1?tenders[0]:'COMBO';
}
function syncDiningFormalOrder(order:StoredOrder,hold:LocalHoldDraft,at:string):StoredOrder{
  const payments=Array.isArray(hold.payments)?hold.payments:[];
  const confirmedPaidMinor=payments.reduce((sum,payment)=>sum+Math.max(0,Number(payment.amountMinor)||0),0);
  const fullyPaid=hold.totalMinor>0&&confirmedPaidMinor>=hold.totalMinor;
  const fulfillmentLabel:StoredOrder['fulfillmentLabel']=hold.cancelledAt
    ?'已取消'
    :hold.archivedAt&&fullyPaid
      ?'已完成'
      :order.fulfillmentLabel;
  const next:StoredOrder={
    ...order,
    diningHoldId:hold.id,
    totalMinor:hold.totalMinor,
    recognizedSalesMinor:confirmedPaidMinor,
    outstandingMinor:hold.cancelledAt?0:Math.max(0,hold.totalMinor-confirmedPaidMinor),
    fulfillmentLabel,
    paymentEntries:payments.map(payment=>({
      ...payment,
      ...(payment.splitTenders?{splitTenders:payment.splitTenders.map(row=>({...row}))}:{}),
      selections:payment.selections.map(selection=>({...selection})),
    })),
    paymentLabel:diningPaymentLabel(payments),
    items:hold.items.map(item=>({...item,serviceMode:'dine-in' as const})),
  };
  return JSON.stringify(next)===JSON.stringify(order)?order:{...next,updatedAt:at};
}
function ensureDiningFormalOrder(snapshot:Persisted,hold:LocalHoldDraft,at:string){
  const byId=hold.formalOrderId?snapshot.orders.find(order=>order.id===hold.formalOrderId):undefined;
  const existing=byId??snapshot.orders.find(order=>order.diningHoldId===hold.id);
  if(existing){
    const linked:LocalHoldDraft={
      ...hold,
      formalOrderId:existing.id,
      formalOrderDisplay:existing.display,
    };
    const synced=syncDiningFormalOrder(existing,linked,at);
    const changed=JSON.stringify(existing)!==JSON.stringify(synced)||hold.formalOrderId!==existing.id||hold.formalOrderDisplay!==existing.display;
    return {
      hold:linked,
      order:synced,
      orders:snapshot.orders.map(order=>order.id===existing.id?synced:order),
      created:false,
      changed,
    };
  }
  if(!hold.items.length||hold.totalMinor<=0){
    return {hold,order:undefined,orders:snapshot.orders,created:false,changed:false};
  }
  const session=readActiveStaffSession();
  const order:StoredOrder={
    id:nextRuntimeIdentity('MFK-'),
    display:'P'+String(snapshot.orders.length+1).padStart(3,'0'),
    createdAt:at,
    updatedAt:at,
    totalMinor:hold.totalMinor,
    paymentLabel:'未收款',
    fulfillmentLabel:'進行中',
    sourceLabel:hold.sourceLabel||'堂食',
    diningHoldId:hold.id,
    recognizedSalesMinor:0,
    outstandingMinor:hold.totalMinor,
    paymentEntries:[],
    ...(session?{staffId:session.staffId,staffName:session.displayName}:{}),
    items:hold.items.map(item=>({...item,serviceMode:'dine-in' as const})),
  };
  const linked:LocalHoldDraft={...hold,formalOrderId:order.id,formalOrderDisplay:order.display};
  const synced=syncDiningFormalOrder(order,linked,at);
  return {hold:linked,order:synced,orders:[synced,...snapshot.orders],created:true,changed:true};
}
function projectDiningOrderNonBlocking(order?:StoredOrder){
  if(!order)return;
  try{projectOrder(order);}catch{console.warn('DINING_ORDER_PROJECTION_DEFERRED');}
}

function diningTableLabel(hold:LocalHoldDraft){
  const id=hold.assignedTable??hold.lastAssignedTable;
  if(!id)return '輪候 '+(hold.formalOrderDisplay??hold.codeLabel);
  const table=readSmtDiningTableRegistry().find(row=>row.id===id);
  return table?.name||id;
}
const diningInitialPrintInflight=new Map<string,Promise<DiningInitialPrintResult>>();
function storedDiningInitialPrintResult(order:StoredOrder):DiningInitialPrintResult{
  return {
    orderId:order.id,
    state:order.diningInitialPrintState??'UNKNOWN',
    planned:Math.max(0,Number(order.diningInitialPrintPlanned)||0),
    sent:Math.max(0,Number(order.diningInitialPrintSent)||0),
    failed:Math.max(0,Number(order.diningInitialPrintFailed)||0),
  };
}
function ensureDiningInitialPrintByHold(holdId:string):Promise<DiningInitialPrintResult>{
  const active=diningInitialPrintInflight.get(holdId);
  if(active)return active;

  const snapshot=readDiningState();
  const hold=requireDiningHold(snapshot,holdId);
  if(!hold.formalOrderId)throw new Error('DINING_FORMAL_ORDER_REQUIRED');
  const order=snapshot.orders.find(row=>row.id===hold.formalOrderId);
  if(!order)throw new Error('DINING_FORMAL_ORDER_NOT_FOUND');
  if(order.diningInitialPrintAttemptedAt)return Promise.resolve(storedDiningInitialPrintResult(order));

  const task=(async()=>{
    const attemptedAt=new Date().toISOString();
    const attempted:StoredOrder={
      ...order,
      diningInitialPrintAttemptedAt:attemptedAt,
      diningInitialPrintState:'UNKNOWN',
      updatedAt:attemptedAt,
    };
    commitDiningState(snapshot,{orders:snapshot.orders.map(row=>row.id===order.id?attempted:row)});
    projectDiningOrderNonBlocking(attempted);

    let summary:PrintDispatchSummary;
    try{
      summary=await dispatchOrderOutputs(
        {
          ...attempted,
          diningTableLabel:diningTableLabel(hold),
          diningTicketTitle:hold.assignedTable?'堂食枱單':'堂食輪候單',
        } as StoredOrder & {diningTableLabel:string;diningTicketTitle:string},
        undefined,
        false,
        'dining-initial',
      );
    }catch{
      summary=Object.freeze({orderId:order.id,planned:0,sent:0,failed:0,results:Object.freeze([])});
    }

    const unknown=summary.results.some(result=>String(result.code||'').toUpperCase().includes('UNKNOWN'));
    const state:DiningInitialPrintResult['state']=unknown?'UNKNOWN':summary.planned>0&&summary.failed===0?'DONE':'FAILED';
    const after=readDiningState();
    const current=after.orders.find(row=>row.id===order.id);
    if(!current)throw new Error('DINING_FORMAL_ORDER_NOT_FOUND');
    const completedAt=new Date().toISOString();
    const finalized:StoredOrder={
      ...current,
      diningInitialPrintState:state,
      diningInitialPrintPlanned:summary.planned,
      diningInitialPrintSent:summary.sent,
      diningInitialPrintFailed:summary.failed,
      ...(state==='DONE'?{diningInitialPrintCompletedAt:completedAt}:{}),
      updatedAt:completedAt,
    };
    commitDiningState(after,{orders:after.orders.map(row=>row.id===order.id?finalized:row)});
    projectDiningOrderNonBlocking(finalized);
    return storedDiningInitialPrintResult(finalized);
  })().finally(()=>diningInitialPrintInflight.delete(holdId));

  diningInitialPrintInflight.set(holdId,task);
  return task;
}

function diningPaymentReceiptLabel(payment:LocalDiningPayment){
  if(payment.tender!=='COMBO')return payment.tender;
  const rows=payment.splitTenders??[];
  return rows.length
    ?'COMBO '+rows.map(row=>row.tender+' '+money(row.amountMinor)).join(' + ')
    :'COMBO';
}
function storedDiningPaymentReceiptResult(order:StoredOrder,payment:LocalDiningPayment):DiningPaymentReceiptResult{
  return {
    orderId:order.id,
    paymentId:payment.id,
    submissionId:payment.submissionId,
    state:payment.receiptState??'UNKNOWN',
    planned:Math.max(0,Number(payment.receiptPlanned)||0),
    sent:Math.max(0,Number(payment.receiptSent)||0),
    failed:Math.max(0,Number(payment.receiptFailed)||0),
  };
}
const diningPaymentReceiptInflight=new Map<string,Promise<DiningPaymentReceiptResult>>();
function ensureDiningPaymentReceiptBySubmission(holdId:string,submissionId:string):Promise<DiningPaymentReceiptResult>{
  const key=holdId+':'+submissionId;
  const active=diningPaymentReceiptInflight.get(key);
  if(active)return active;

  const snapshot=readDiningState();
  const hold=requireDiningHold(snapshot,holdId);
  if(!hold.formalOrderId)throw new Error('DINING_FORMAL_ORDER_REQUIRED');
  const order=snapshot.orders.find(row=>row.id===hold.formalOrderId);
  if(!order)throw new Error('DINING_FORMAL_ORDER_NOT_FOUND');
  const payment=(hold.payments??[]).find(row=>row.submissionId===submissionId);
  if(!payment)throw new Error('DINING_PAYMENT_NOT_FOUND');
  if(payment.receiptAttemptedAt)return Promise.resolve(storedDiningPaymentReceiptResult(order,payment));

  const task=(async()=>{
    const attemptedAt=new Date().toISOString();
    const attemptedPayment:LocalDiningPayment={
      ...payment,
      receiptAttemptedAt:attemptedAt,
      receiptState:'UNKNOWN',
    };
    const attemptedHold:LocalHoldDraft={
      ...hold,
      payments:(hold.payments??[]).map(row=>row.id===payment.id?attemptedPayment:row),
    };
    const attemptedEnsured=ensureDiningFormalOrder(snapshot,attemptedHold,attemptedAt);
    commitDiningState(snapshot,{
      holds:snapshot.holds.map(row=>row.id===hold.id?attemptedEnsured.hold:row),
      orders:attemptedEnsured.orders,
    });
    projectDiningOrderNonBlocking(attemptedEnsured.order);

    const selectedItems=attemptedPayment.selections.map(selection=>{
      const item=attemptedHold.items[selection.lineIndex];
      if(!item)throw new Error('DINING_LINE_NOT_FOUND');
      return {...item,qty:selection.qty,serviceMode:'dine-in' as const};
    });
    const detail=diningDetail(attemptedEnsured.hold);
    const noteLines=[
      '枱號：'+diningTableLabel(attemptedEnsured.hold),
      '本次付款：'+money(attemptedPayment.amountMinor),
      ...(attemptedPayment.tender==='CASH'?[
        '實收：'+money(attemptedPayment.receivedMinor??attemptedPayment.amountMinor),
        '找續：'+money(attemptedPayment.changeMinor??0),
      ]:[]),
      '付款後未收款：'+money(detail.remainingMinor),
    ];
    const printable={
      ...attemptedEnsured.order!,
      id:attemptedEnsured.order!.id+':payment:'+attemptedPayment.id,
      totalMinor:attemptedPayment.amountMinor,
      paymentLabel:diningPaymentReceiptLabel(attemptedPayment),
      items:selectedItems,
      diningTableLabel:diningTableLabel(attemptedEnsured.hold),
      receiptTitle:'堂食付款收據',
      receiptNoteLines:noteLines,
    } as StoredOrder & {
      diningTableLabel:string;
      receiptTitle:string;
      receiptNoteLines:readonly string[];
    };

    let summary:PrintDispatchSummary;
    let dispatchUnknown=false;
    try{
      summary=await dispatchOrderOutputs(printable,undefined,false,'dining-payment');
    }catch{
      dispatchUnknown=true;
      summary=Object.freeze({orderId:printable.id,planned:0,sent:0,failed:0,results:Object.freeze([])});
    }

    const unknown=dispatchUnknown||summary.results.some(result=>String(result.code||'').toUpperCase().includes('UNKNOWN'));
    const state:DiningPaymentReceiptResult['state']=unknown?'UNKNOWN':summary.planned>0&&summary.failed===0?'DONE':'FAILED';
    const after=readDiningState();
    const currentHold=requireDiningHold(after,holdId);
    const currentPayment=(currentHold.payments??[]).find(row=>row.id===payment.id);
    if(!currentPayment)throw new Error('DINING_PAYMENT_NOT_FOUND');
    const completedAt=new Date().toISOString();
    const finalizedPayment:LocalDiningPayment={
      ...currentPayment,
      receiptState:state,
      receiptPlanned:summary.planned,
      receiptSent:summary.sent,
      receiptFailed:summary.failed,
      ...(state==='DONE'?{receiptCompletedAt:completedAt}:{}),
    };
    const finalizedHold:LocalHoldDraft={
      ...currentHold,
      payments:(currentHold.payments??[]).map(row=>row.id===payment.id?finalizedPayment:row),
    };
    const finalizedEnsured=ensureDiningFormalOrder(after,finalizedHold,completedAt);
    commitDiningState(after,{
      holds:after.holds.map(row=>row.id===holdId?finalizedEnsured.hold:row),
      orders:finalizedEnsured.orders,
    });
    projectDiningOrderNonBlocking(finalizedEnsured.order);
    return storedDiningPaymentReceiptResult(finalizedEnsured.order!,finalizedPayment);
  })().finally(()=>diningPaymentReceiptInflight.delete(key));

  diningPaymentReceiptInflight.set(key,task);
  return task;
}

function storedDiningAdditionPrintResult(order:StoredOrder,addition:LocalDiningAddition):DiningAdditionPrintResult{
  return {
    orderId:order.id,
    additionId:addition.id,
    submissionId:addition.submissionId,
    state:addition.printState??'UNKNOWN',
    planned:Math.max(0,Number(addition.printPlanned)||0),
    sent:Math.max(0,Number(addition.printSent)||0),
    failed:Math.max(0,Number(addition.printFailed)||0),
  };
}
const diningAdditionPrintInflight=new Map<string,Promise<DiningAdditionPrintResult>>();
function ensureDiningAdditionPrintById(holdId:string,additionId:string):Promise<DiningAdditionPrintResult>{
  const key=holdId+':'+additionId;
  const active=diningAdditionPrintInflight.get(key);
  if(active)return active;

  const snapshot=readDiningState();
  const hold=requireDiningHold(snapshot,holdId);
  if(!hold.formalOrderId)throw new Error('DINING_FORMAL_ORDER_REQUIRED');
  const order=snapshot.orders.find(row=>row.id===hold.formalOrderId);
  if(!order)throw new Error('DINING_FORMAL_ORDER_NOT_FOUND');
  const addition=(hold.additions??[]).find(row=>row.id===additionId);
  if(!addition)throw new Error('DINING_ADDITION_NOT_FOUND');
  if(addition.printAttemptedAt)return Promise.resolve(storedDiningAdditionPrintResult(order,addition));

  const task=(async()=>{
    const attemptedAt=new Date().toISOString();
    const attemptedAddition:LocalDiningAddition={
      ...addition,
      printAttemptedAt:attemptedAt,
      printState:'UNKNOWN',
    };
    const attemptedHold:LocalHoldDraft={
      ...hold,
      additions:(hold.additions??[]).map(row=>row.id===addition.id?attemptedAddition:row),
    };
    const attemptedEnsured=ensureDiningFormalOrder(snapshot,attemptedHold,attemptedAt);
    commitDiningState(snapshot,{
      holds:snapshot.holds.map(row=>row.id===hold.id?attemptedEnsured.hold:row),
      orders:attemptedEnsured.orders,
    });
    projectDiningOrderNonBlocking(attemptedEnsured.order);

    const printable={
      ...attemptedEnsured.order!,
      id:attemptedEnsured.order!.id+':addition:'+attemptedAddition.id,
      totalMinor:attemptedAddition.totalMinor,
      paymentLabel:'未收款',
      sourceLabel:attemptedAddition.sourceLabel||attemptedEnsured.order!.sourceLabel,
      orderRemark:['堂食加單',diningTableLabel(attemptedEnsured.hold)].filter(Boolean).join(' · '),
      items:attemptedAddition.items.map(item=>({...item,serviceMode:'dine-in' as const})),
    } as StoredOrder;

    let summary:PrintDispatchSummary;
    let dispatchUnknown=false;
    try{
      summary=await dispatchOrderOutputs(printable,undefined,false,'dining-addition');
    }catch{
      dispatchUnknown=true;
      summary=Object.freeze({orderId:printable.id,planned:0,sent:0,failed:0,results:Object.freeze([])});
    }

    const unknown=dispatchUnknown||summary.results.some(result=>String(result.code||'').toUpperCase().includes('UNKNOWN'));
    const state:DiningAdditionPrintResult['state']=unknown?'UNKNOWN':summary.planned>0&&summary.failed===0?'DONE':'FAILED';
    const after=readDiningState();
    const currentHold=requireDiningHold(after,holdId);
    const currentAddition=(currentHold.additions??[]).find(row=>row.id===addition.id);
    if(!currentAddition)throw new Error('DINING_ADDITION_NOT_FOUND');
    const completedAt=new Date().toISOString();
    const finalizedAddition:LocalDiningAddition={
      ...currentAddition,
      printState:state,
      printPlanned:summary.planned,
      printSent:summary.sent,
      printFailed:summary.failed,
      ...(state==='DONE'?{printCompletedAt:completedAt}:{}),
    };
    const finalizedHold:LocalHoldDraft={
      ...currentHold,
      additions:(currentHold.additions??[]).map(row=>row.id===addition.id?finalizedAddition:row),
    };
    const finalizedEnsured=ensureDiningFormalOrder(after,finalizedHold,completedAt);
    commitDiningState(after,{
      holds:after.holds.map(row=>row.id===holdId?finalizedEnsured.hold:row),
      orders:finalizedEnsured.orders,
    });
    projectDiningOrderNonBlocking(finalizedEnsured.order);
    return storedDiningAdditionPrintResult(finalizedEnsured.order!,finalizedAddition);
  })().finally(()=>diningAdditionPrintInflight.delete(key));

  diningAdditionPrintInflight.set(key,task);
  return task;
}

function appendDiningItemsToSnapshot(snapshot:Persisted,hold:LocalHoldDraft,input:{
  submissionId:string;
  items:readonly {id:string;name:string;qty:number;unitMinor:number}[];
  totalMinor:number;
  sourceLabel?:string;
}){
  if(hold.archivedAt||hold.cancelledAt)throw new Error('DINING_HISTORY_PROTECTED');
  if(!hold.formalOrderId)throw new Error('DINING_FORMAL_ORDER_REQUIRED');
  const submissionId=String(input.submissionId||'').trim();
  if(!submissionId||submissionId.length>200)throw new Error('DINING_ADDITION_SUBMISSION_REQUIRED');
  const items=input.items
    .map(item=>({
      id:String(item.id||''),
      name:String(item.name||''),
      qty:Math.max(0,Math.floor(Number(item.qty)||0)),
      unitMinor:Math.max(0,Math.floor(Number(item.unitMinor)||0)),
    }))
    .filter(item=>item.id&&item.name&&item.qty>0);
  if(!items.length)throw new Error('DINING_ADDITION_ITEMS_REQUIRED');
  const computed=items.reduce((sum,item)=>sum+item.qty*item.unitMinor,0);
  const totalMinor=Math.max(0,Math.floor(Number(input.totalMinor)||0));
  if(!Number.isSafeInteger(computed)||computed<=0||computed!==totalMinor)throw new Error('DINING_ADDITION_TOTAL_MISMATCH');
  const sourceLabel=String(input.sourceLabel||hold.sourceLabel||'堂食');
  const requestSignature=JSON.stringify([hold.id,items,totalMinor,sourceLabel]);
  const prior=(hold.additions??[]).find(row=>row.submissionId===submissionId);
  if(prior){
    if(prior.requestSignature&&prior.requestSignature!==requestSignature)throw new Error('DINING_ADDITION_SUBMISSION_CONFLICT');
    return {hold,addition:prior,order:snapshot.orders.find(row=>row.id===hold.formalOrderId),orders:snapshot.orders,changed:false};
  }
  const createdAt=new Date().toISOString();
  const addition:LocalDiningAddition={
    id:'DA:'+hold.id+':'+submissionId,
    submissionId,
    requestSignature,
    createdAt,
    totalMinor,
    sourceLabel,
    items,
  };
  const updated:LocalHoldDraft={
    ...hold,
    items:[...hold.items,...items],
    totalMinor:hold.totalMinor+totalMinor,
    additions:[...(hold.additions??[]),addition],
  };
  const ensured=ensureDiningFormalOrder(snapshot,updated,createdAt);
  if(!ensured.order)throw new Error('DINING_FORMAL_ORDER_REQUIRED');
  return {hold:ensured.hold,addition,order:ensured.order,orders:ensured.orders,changed:true};
}

function diningDetail(hold:LocalHoldDraft):LocalDiningHoldDetail{
  const payments=Array.isArray(hold.payments)?hold.payments:[];
  const paidByLine=new Map<number,number>();
  for(const payment of payments){
    for(const selection of payment.selections){
      paidByLine.set(selection.lineIndex,(paidByLine.get(selection.lineIndex)??0)+selection.qty);
    }
  }
  const lines=hold.items.map((item,lineIndex)=>{
    const paidQty=Math.min(item.qty,paidByLine.get(lineIndex)??0);
    return {
      lineIndex,
      id:item.id,
      name:item.name,
      qty:item.qty,
      paidQty,
      remainingQty:Math.max(0,item.qty-paidQty),
      unitMinor:item.unitMinor,
    };
  });
  const paidMinor=payments.reduce((sum,payment)=>sum+payment.amountMinor,0);
  return {
    checkoutRevision:diningCheckoutRevision(hold),
    ...(hold.archivedAt?{archivedAt:hold.archivedAt}:{}),
    ...(hold.cancelledAt?{cancelledAt:hold.cancelledAt}:{}),
    ...(hold.lastAssignedTable?{lastAssignedTable:hold.lastAssignedTable}:{}),
    ...(hold.seatedAt?{seatedAt:hold.seatedAt}:{}),
    ...(hold.formalOrderId?{formalOrderId:hold.formalOrderId}:{}),
    ...(hold.formalOrderDisplay?{formalOrderDisplay:hold.formalOrderDisplay}:{}),
    holdId:hold.id,
    codeLabel:hold.formalOrderDisplay??hold.codeLabel,
    assignedTable:hold.assignedTable,
    createdAt:hold.createdAt,
    partySize:hold.partySize,
    note:hold.note,
    totalMinor:hold.totalMinor,
    paidMinor,
    remainingMinor:hold.cancelledAt?0:Math.max(0,hold.totalMinor-paidMinor),
    lines,
    payments,
    additions:Array.isArray(hold.additions)?hold.additions:[],
  };
}

export const localRuntime:MfkLocalRuntime=Object.freeze({
  subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener)},
  createOrder(input){
    const providerRef=String(input.providerRef||'').trim();
    if(providerRef){
      const existing=data.orders.find(order=>order.providerRef===providerRef);
      if(existing)return existing;
    }
    const n=data.orders.length+1;
    const createdAt=new Date().toISOString();
    const session=readActiveStaffSession();
    const order:StoredOrder={
      id:nextRuntimeIdentity('MFK-'),
      display:'P'+String(n).padStart(3,'0'),
      createdAt,
      updatedAt:createdAt,
      totalMinor:input.totalMinor,
      paymentLabel:input.paymentLabel,
      fulfillmentLabel:input.initialFulfillmentLabel??'進行中',
      sourceLabel:input.sourceLabel||'現場',
      ...(providerRef?{providerRef}:{}),
      ...(input.providerMessageId?{providerMessageId:String(input.providerMessageId)}:{}),
      ...(input.providerPickupCode?{providerPickupCode:String(input.providerPickupCode)}:{}),
      ...(input.orderRemark?{orderRemark:String(input.orderRemark)}:{}),
      ...(input.utensilPreference?{utensilPreference:input.utensilPreference}:{}),
      ...(input.paymentEvidenceRef?{paymentEvidenceRef:input.paymentEvidenceRef}:{}),
      ...(input.paymentVerificationState?{paymentVerificationState:input.paymentVerificationState}:{}),
      ...(input.customerPhone?{customerPhone:input.customerPhone}:{}),
      ...(session?{staffId:session.staffId,staffName:session.displayName}:{}),
      items:input.items.map(item=>({...item})),
    };
    data={...data,orders:[order,...data.orders]};
    save();
    projectOrder(order);
    return order;
  },
  orders(){return data.orders},
  createHold(input){
    const n=data.holds.length+1;
    const draft:LocalHoldDraft={
      id:nextRuntimeIdentity('HOLD-'),
      codeLabel:'H'+String(n).padStart(3,'0'),
      kind:input.kind,
      createdAt:new Date().toISOString(),
      partySize:Math.max(1,Math.floor(Number(input.partySize)||1)),
      note:String(input.note||''),
      totalMinor:Math.max(0,Math.floor(Number(input.totalMinor)||0)),
      payments:[],
      items:input.items.map(item=>({...item})),
    };
    data={...data,holds:[draft,...data.holds]};save();return draft;
  },
  upsertSmmDiningHold(input){
    const snapshot=readDiningState();
    const providerRef=String(input.providerRef||'').trim();
    if(!providerRef)throw new Error('SMM_DINING_PROVIDER_REF_REQUIRED');
    const existingByRef=snapshot.holds.find(hold=>hold.providerRef===providerRef);
    if(existingByRef)return existingByRef;
    const target=input.target;
    const covers=Math.max(1,Math.floor(Number(target.covers)||1));
    const items=input.items.map(item=>({...item}));
    if(target.kind==='WAITING'){
      const at=new Date().toISOString();
      const draft:LocalHoldDraft={
        id:nextRuntimeIdentity('HOLD-'),codeLabel:'W'+String(snapshot.holds.length+1).padStart(3,'0'),kind:'dining',
        createdAt:at,partySize:covers,note:'SMM 輪候',totalMinor:Math.max(0,Math.floor(Number(input.totalMinor)||0)),
        payments:[],providerRef,sourceLabel:input.sourceLabel||'SMM',smmSubmissionRefs:[providerRef],items,
      };
      const ensured=ensureDiningFormalOrder(snapshot,draft,at);
      if(!ensured.order)throw new Error('DINING_ORDER_ITEMS_REQUIRED');
      commitDiningState(snapshot,{holds:[ensured.hold,...snapshot.holds],orders:ensured.orders});
      projectDiningOrderNonBlocking(ensured.order);
      return ensured.hold;
    }
    const tableId=String(target.tableId||'').trim();
    if(!/^T\d{2}$/.test(tableId))throw new Error('SMM_DINING_TABLE_INVALID');
    const occupied=snapshot.holds.find(hold=>hold.kind==='dining'&&!hold.archivedAt&&hold.assignedTable===tableId);
    if(occupied){
      const priorAddition=(occupied.additions??[]).find(row=>row.submissionId===providerRef);
      if((occupied.smmSubmissionRefs??[]).includes(providerRef)){
        if(priorAddition){
          appendDiningItemsToSnapshot(snapshot,occupied,{
            submissionId:providerRef,
            items,
            totalMinor:Math.max(0,Math.floor(Number(input.totalMinor)||0)),
            sourceLabel:input.sourceLabel||'SMM',
          });
        }
        return occupied;
      }
      const appended=appendDiningItemsToSnapshot(snapshot,occupied,{
        submissionId:providerRef,
        items,
        totalMinor:Math.max(0,Math.floor(Number(input.totalMinor)||0)),
        sourceLabel:input.sourceLabel||'SMM',
      });
      const withSubmission:LocalHoldDraft={
        ...appended.hold,
        smmSubmissionRefs:[...(occupied.smmSubmissionRefs??[]),providerRef],
      };
      const ensured=ensureDiningFormalOrder(snapshot,withSubmission,new Date().toISOString());
      commitDiningState(snapshot,{
        holds:snapshot.holds.map(hold=>hold.id===occupied.id?ensured.hold:hold),
        orders:ensured.orders,
      });
      projectDiningOrderNonBlocking(ensured.order);
      return ensured.hold;
    }
    const at=new Date().toISOString();
    const draft:LocalHoldDraft={
      id:nextRuntimeIdentity('HOLD-'),codeLabel:'H'+String(snapshot.holds.length+1).padStart(3,'0'),kind:'dining',
      createdAt:at,partySize:covers,note:'SMM 堂食',totalMinor:Math.max(0,Math.floor(Number(input.totalMinor)||0)),
      assignedTable:tableId,seatedAt:at,payments:[],providerRef,sourceLabel:input.sourceLabel||'SMM',smmSubmissionRefs:[providerRef],items,
    };
    const ensured=ensureDiningFormalOrder(snapshot,draft,at);
    commitDiningState(snapshot,{holds:[ensured.hold,...snapshot.holds],orders:ensured.orders});
    projectDiningOrderNonBlocking(ensured.order);
    return ensured.hold;
  },
  holds(){return readDiningState().holds.filter(hold=>!hold.archivedAt)},
  removeHold(id){
    const snapshot=readDiningState();
    const hold=snapshot.holds.find(row=>row.id===id);
    if(hold?.archivedAt||hold?.payments?.length)throw new Error('DINING_HISTORY_PROTECTED');
    if(hold?.kind==='dining'&&(hold.assignedTable||hold.items.length))throw new Error('DINING_NONEMPTY_HOLD_PROTECTED');
    commitDiningHolds(snapshot,snapshot.holds.filter(row=>row.id!==id));
  },
  clear(){data=clone(defaults);save()},
  async readOrders(selectedOrderId){
    const visibleOrders=data.orders.filter(order=>{
      const pureDining=Boolean(order.items.length)&&order.items.every(item=>item.serviceMode==='dine-in');
      if(!pureDining)return true;
      if(order.fulfillmentLabel==='已完成'||order.fulfillmentLabel==='已取消')return true;
      return Boolean(selectedOrderId&&order.id===selectedOrderId);
    });
    const items=visibleOrders.map(order=>({
      orderId:order.id,orderIdLabel:'#'+order.display,itemCount:order.items.reduce((s,x)=>s+x.qty,0),
      totalLabel:money(order.totalMinor),paymentLabel:order.paymentLabel,fulfillmentLabel:order.fulfillmentLabel,
      sourceLabel:order.sourceLabel,localSequenceLabel:order.display,
    }));
    const selectedId=selectedOrderId&&visibleOrders.some(x=>x.id===selectedOrderId)?selectedOrderId:visibleOrders[0]?.id;
    const details:Record<string,SmtOrderDetailViewModel>={};
    for(const order of visibleOrders)details[order.id]={
      orderId:order.id,orderIdLabel:'#'+order.display,itemCount:order.items.reduce((s,x)=>s+x.qty,0),totalLabel:money(order.totalMinor),
      paymentLabel:order.paymentLabel,fulfillmentLabel:order.fulfillmentLabel,sourceLabel:order.sourceLabel,localSequenceLabel:order.display,
      ...(order.diningHoldId?{diningHoldId:order.diningHoldId}:{}),
      ...(order.recognizedSalesMinor!==undefined?{recognizedSalesMinor:order.recognizedSalesMinor}:{}),
      ...(order.outstandingMinor!==undefined?{outstandingMinor:order.outstandingMinor}:{}),
      ...(order.paymentEvidenceRef?{paymentEvidenceRef:order.paymentEvidenceRef}:{}),
      ...(order.paymentVerificationState?{paymentVerificationState:order.paymentVerificationState}:{}),
      ...(order.customerPhone?{customerPhone:order.customerPhone}:{}),
      ...(order.paymentCorrections?.length?{paymentCorrections:order.paymentCorrections}:{}),
      ...(order.refunds?.length?{refunds:order.refunds}:{}),
      ...(order.cancellationNoticeState?{cancellationNoticeState:order.cancellationNoticeState}:{}),
      attention:[
        ...(order.providerLifecycleNote?[order.providerLifecycleNote]:[]),
      ],metrics:[
        {id:'time',label:'時間',value:new Date(order.createdAt).toLocaleTimeString('zh-HK')},
        {id:'items',label:'件數',value:String(order.items.reduce((s,x)=>s+x.qty,0))},
        {id:'total',label:'總額',value:money(order.totalMinor)},
        ...(order.providerLastEventId?[{id:'provider-event',label:'Keeta Event',value:String(order.providerLastEventId),detail:order.providerLastEventName}]:[])
      ],
      lines:order.items.map(item=>({
        id:item.id,
        name:item.name,
        quantity:item.qty,
        unitLabel:money(item.unitMinor),
        lineTotalLabel:money(item.unitMinor*item.qty),
      }))
    };
    return {items,detailsByOrderId:details,selectedOrderId:selectedId,selectedOrder:selectedId?details[selectedId]:undefined};
  },
  async readPaymentEvidence(orderId){
    const order=data.orders.find(row=>row.id===orderId);
    if(!order)throw new Error('ORDER_NOT_FOUND');
    if(!order.paymentEvidenceRef)throw new Error('PAYMENT_EVIDENCE_NOT_FOUND');
    const deviceId=readSmtDeviceId();
    const response=await fetch('https://admin.morefunos.com/api/customer/smt/payment-evidence?storeId=MF01&deviceId='+encodeURIComponent(deviceId)+'&ref='+encodeURIComponent(order.paymentEvidenceRef),{cache:'no-store'});
    if(!response.ok)throw new Error('PAYMENT_EVIDENCE_READ_HTTP_'+response.status);
    const blob=await response.blob();
    return{objectUrl:URL.createObjectURL(blob)};
  },
  async reviewPaymentEvidence(orderId,decision){
    const order=data.orders.find(row=>row.id===orderId);
    if(!order)throw new Error('ORDER_NOT_FOUND');
    if(!order.paymentEvidenceRef)throw new Error('PAYMENT_EVIDENCE_NOT_FOUND');
    if(decision!=='VERIFIED'&&decision!=='REJECTED')throw new Error('PAYMENT_EVIDENCE_DECISION_INVALID');
    const updatedAt=new Date().toISOString();
    data={...data,orders:data.orders.map(row=>row.id===orderId?{...row,paymentVerificationState:decision,updatedAt}:row)};
    save();
    const current=data.orders.find(row=>row.id===orderId)!;
    projectOrder(current);
    appendActionAudit({action:'PAYMENT_EVIDENCE_'+decision,orderId});
    return{orderId,state:decision};
  },
  async acceptOrder(orderId){
    const found=data.orders.find(x=>x.id===orderId);if(!found)throw new Error('ORDER_NOT_FOUND');
    if(found.fulfillmentLabel==='已完成'||found.fulfillmentLabel==='已取消')throw new Error('ORDER_NOT_ACCEPTABLE');
    const updatedAt=new Date().toISOString();
    if(found.fulfillmentLabel==='待處理'){
      data={...data,orders:data.orders.map(x=>x.id===orderId?{...x,fulfillmentLabel:'進行中',updatedAt}:x)};
      save();
      projectOrder(data.orders.find(x=>x.id===orderId)!);
      appendActionAudit({action:'ACCEPT',orderId});
    }
    let current=data.orders.find(x=>x.id===orderId)!;
    const provider=await mirrorKeetaOrderCommand(current,'CONFIRM');
    if(!current.acceptancePrintedAt){
      const print=await dispatchOrderOutputs(current);
      if(print.failed>0)throw new Error('KEETA_ORDER_ACCEPT_PRINT_FAILED:'+print.sent+'/'+print.planned);
      const acceptancePrintedAt=new Date().toISOString();
      data={...data,orders:data.orders.map(x=>x.id===orderId?{...x,acceptancePrintedAt,updatedAt:acceptancePrintedAt}:x)};
      save();
      current=data.orders.find(x=>x.id===orderId)!;
      projectOrder(current);
      appendActionAudit({action:'ACCEPT_PRINT',orderId});
    }
    return {orderId,status:'ACCEPTED' as const,provider};
  },
  async markOrderReady(orderId){
    const found=data.orders.find(x=>x.id===orderId);if(!found)throw new Error('ORDER_NOT_FOUND');
    if(found.diningHoldId)throw new Error('DINING_FULFILLMENT_MANAGED_BY_DINING');
    if(found.fulfillmentLabel==='已完成'||found.fulfillmentLabel==='已取消')throw new Error('ORDER_NOT_READYABLE');
    const updatedAt=new Date().toISOString();
    data={...data,orders:data.orders.map(x=>x.id===orderId?{...x,fulfillmentLabel:'可取餐',updatedAt}:x)};
    save();
    projectOrder(data.orders.find(x=>x.id===orderId)!);
    appendActionAudit({action:'READY',orderId});
    const current=data.orders.find(x=>x.id===orderId)!;
    const provider=await mirrorKeetaOrderCommand(current,'READY');
    return {orderId,canonicalRevision:Date.now(),status:'READY' as const,provider};
  },
  async printOrderOutputs(orderId){
    const order=data.orders.find(x=>x.id===orderId);
    if(!order)throw new Error('ORDER_NOT_FOUND');
    return dispatchOrderOutputs(order);
  },
  async correctOrderPayment(orderId,paymentLabel){
    if(!hasStaffPermission('ORDER_CORRECTION'))throw new Error('ORDER_CORRECTION_PERMISSION_REQUIRED');
    const order=data.orders.find(x=>x.id===orderId);
    if(!order)throw new Error('ORDER_NOT_FOUND');
    if(order.diningHoldId)throw new Error('DINING_PAYMENT_CORRECTION_REQUIRES_PAYMENT_ENTRY');
    const next=String(paymentLabel||'').trim();
    if(!next)throw new Error('PAYMENT_METHOD_REQUIRED');
    if(next===order.paymentLabel)return order;
    const session=readActiveStaffSession();
    const createdAt=new Date().toISOString();
    const correctionIndex=(order.paymentCorrections?.length??0)+1;
    const correction:PaymentCorrectionRecord=Object.freeze({
      id:'PC-'+order.id+'-'+String(correctionIndex).padStart(3,'0'),
      createdAt,
      from:order.paymentLabel,
      to:next,
      ...(session?{staffId:session.staffId,staffName:session.displayName}:{}),
    });
    data={...data,orders:data.orders.map(x=>x.id===orderId?{
      ...x,
      paymentLabel:next,
      paymentCorrections:[...(x.paymentCorrections??[]),correction],
      updatedAt:createdAt,
    }:x)};
    save();
    const updated=data.orders.find(x=>x.id===orderId)!;
    projectOrder(updated);
    appendActionAudit({action:'PAYMENT_CORRECTION',orderId,reason:order.paymentLabel+' -> '+next});
    return updated;
  },

  async refundOrder(orderId,input){
    if(!hasStaffPermission('ORDER_CORRECTION'))throw new Error('ORDER_CORRECTION_PERMISSION_REQUIRED');
    const order=data.orders.find(x=>x.id===orderId);
    if(!order)throw new Error('ORDER_NOT_FOUND');
    if(/^Keeta\b|^Foodpanda\b|^第三方/.test(String(order.sourceLabel||'')))throw new Error('PROVIDER_REFUND_USE_AFTERSALE');
    if(order.diningHoldId&&!['已完成','已取消'].includes(order.fulfillmentLabel)){
      throw new Error('DINING_REFUND_REQUIRES_CLOSED_CHECK');
    }

    const cutoff=readBusinessCutoff();
    const now=Date.now();
    const currentWindow=resolveBusinessWindow(now,cutoff.hour,cutoff.minute);
    const orderAt=Date.parse(order.createdAt);
    if(!Number.isFinite(orderAt))throw new Error('ORDER_CREATED_AT_INVALID');
    const orderWindow=resolveBusinessWindow(orderAt,cutoff.hour,cutoff.minute);
    if(orderWindow.businessDate!==currentWindow.businessDate)throw new Error('REFUND_ADMIN_REQUIRED_CLOSED_DAY');
    if(readLocalDayCloses().some(row=>row.businessDate===orderWindow.businessDate))throw new Error('REFUND_ADMIN_REQUIRED_CLOSED_DAY');

    const matchingLineIndexes=order.items.map((row,index)=>row.id===input.lineId?index:-1).filter(index=>index>=0);
    if(!matchingLineIndexes.length)throw new Error('REFUND_LINE_NOT_FOUND');
    if(order.diningHoldId&&matchingLineIndexes.length!==1)throw new Error('DINING_REFUND_LINE_AMBIGUOUS');
    const lineIndex=matchingLineIndexes[0]!;
    const line=order.items[lineIndex]!;
    const quantity=Math.max(0,Math.floor(Number(input.quantity)||0));
    if(quantity<1||quantity>line.qty)throw new Error('REFUND_QUANTITY_INVALID');
    if(order.diningHoldId){
      const paidQty=(order.paymentEntries??[]).reduce((sum,payment)=>
        sum+(payment.selections??[]).filter(selection=>selection.lineIndex===lineIndex)
          .reduce((selectionSum,selection)=>selectionSum+Math.max(0,Number(selection.qty)||0),0)
      ,0);
      const priorRefundQty=(order.refunds??[]).flatMap(refund=>refund.lines)
        .filter(row=>row.lineId===line.id)
        .reduce((sum,row)=>sum+Math.max(0,Number(row.quantity)||0),0);
      if(quantity>Math.max(0,paidQty-priorRefundQty))throw new Error('DINING_REFUND_EXCEEDS_PAID_QUANTITY');
    }
    const amountMinor=Math.max(0,Math.round(Number(input.amountMinor)||0));
    if(amountMinor<=0)throw new Error('REFUND_AMOUNT_REQUIRED');

    const priorLineRefund=(order.refunds??[]).flatMap(refund=>refund.lines).filter(row=>row.lineId===line.id)
      .reduce((sum,row)=>sum+Math.max(0,Number(row.amountMinor)||0),0);
    const lineOriginalMinor=Math.max(0,line.qty*line.unitMinor);
    const lineRemainingMinor=Math.max(0,lineOriginalMinor-priorLineRefund);
    const selectedMaximumMinor=Math.max(0,quantity*line.unitMinor);
    if(amountMinor>lineRemainingMinor||amountMinor>selectedMaximumMinor)throw new Error('REFUND_EXCEEDS_LINE_REMAINING');

    const priorOrderRefund=(order.refunds??[]).reduce((sum,row)=>sum+Math.max(0,Number(row.amountMinor)||0),0);
    if(priorOrderRefund+amountMinor>order.totalMinor)throw new Error('REFUND_EXCEEDS_ORDER_REMAINING');
    if(order.diningHoldId&&priorOrderRefund+amountMinor>Math.max(0,Number(order.recognizedSalesMinor)||0)){
      throw new Error('DINING_REFUND_EXCEEDS_CONFIRMED_PAID');
    }

    const method=String(input.method||'').trim();
    if(!method)throw new Error('REFUND_METHOD_REQUIRED');
    const createdAt=new Date(now).toISOString();
    const session=readActiveStaffSession();
    const nextTotal=priorOrderRefund+amountMinor;
    const index=(order.refunds?.length??0)+1;
    const refund:OrderRefundRecord=Object.freeze({
      id:'REF-'+order.id+'-'+String(index).padStart(3,'0'),
      createdAt,
      kind:nextTotal===order.totalMinor?'FULL':'PARTIAL',
      amountMinor,
      method,
      note:String(input.note??'').trim(),
      lines:Object.freeze([Object.freeze({
        lineId:line.id,
        itemName:line.name,
        quantity,
        amountMinor,
      })]),
      ...(session?{staffId:session.staffId,staffName:session.displayName}:{}),
    });
    data={...data,orders:data.orders.map(x=>x.id===orderId?{
      ...x,refunds:[...(x.refunds??[]),refund],updatedAt:createdAt,
    }:x)};
    save();
    const updated=data.orders.find(x=>x.id===orderId)!;
    projectOrder(updated);
    appendActionAudit({action:'REFUND_'+refund.kind,orderId,reason:method+' '+money(amountMinor)+' · '+line.name});
    return updated;
  },

  applyAdminRefundEvent(input){
    const event:AdminRefundEvent=validateAdminRefundEvent(input);
    const order=data.orders.find(row=>row.id===event.orderId);
    if(!order)throw new Error('ADMIN_REFUND_LOCAL_ORDER_NOT_FOUND');
    if((order.refunds??[]).some(refund=>refund.id===event.refundId)){
      return {disposition:'IDEMPOTENT' as const,refundId:event.refundId,orderId:order.id};
    }
    if(event.storeId!=='MF01')throw new Error('ADMIN_REFUND_STORE_MISMATCH');
    const lineEvent=event.lines[0];
    if(!lineEvent||event.lines.length!==1)throw new Error('ADMIN_REFUND_LINE_CARDINALITY_UNSUPPORTED');
    const line=order.items.find(row=>row.id===lineEvent.lineId);
    if(!line)throw new Error('ADMIN_REFUND_LOCAL_LINE_NOT_FOUND');
    if(lineEvent.quantity<1||lineEvent.quantity>line.qty)throw new Error('ADMIN_REFUND_LOCAL_QUANTITY_INVALID');
    const priorLineRefund=(order.refunds??[]).flatMap(refund=>refund.lines).filter(row=>row.lineId===line.id)
      .reduce((sum,row)=>sum+Math.max(0,Number(row.amountMinor)||0),0);
    const lineRemaining=Math.max(0,line.qty*line.unitMinor-priorLineRefund);
    if(event.amountMinor>lineRemaining||lineEvent.amountMinor!==event.amountMinor){
      throw new Error('ADMIN_REFUND_LOCAL_AMOUNT_CONFLICT');
    }
    const priorOrderRefund=(order.refunds??[]).reduce((sum,row)=>sum+Math.max(0,Number(row.amountMinor)||0),0);
    if(priorOrderRefund+event.amountMinor>order.totalMinor)throw new Error('ADMIN_REFUND_LOCAL_ORDER_AMOUNT_CONFLICT');
    const nextTotal=priorOrderRefund+event.amountMinor;
    const refund:OrderRefundRecord=Object.freeze({
      id:event.refundId,
      createdAt:event.executionAt,
      kind:nextTotal===order.totalMinor?'FULL':'PARTIAL',
      amountMinor:event.amountMinor,
      method:event.method,
      note:event.note,
      lines:Object.freeze(event.lines.map(row=>Object.freeze({
        lineId:row.lineId,
        itemName:row.itemName,
        quantity:row.quantity,
        amountMinor:row.amountMinor,
      }))),
    });
    data={...data,orders:data.orders.map(row=>row.id===order.id?{
      ...row,
      refunds:[...(row.refunds??[]),refund],
      updatedAt:event.executionAt,
    }:row)};
    save();
    const updated=data.orders.find(row=>row.id===order.id)!;
    projectOrder(updated);
    appendActionAudit({action:'ADMIN_REFUND_APPLIED',orderId:order.id,reason:event.refundId+' · '+event.method+' '+money(event.amountMinor)});
    return {disposition:'APPLIED' as const,refundId:event.refundId,orderId:order.id};
  },

  async readOrderReprintOptions(orderId){
    const order=data.orders.find(x=>x.id===orderId);
    if(!order)throw new Error('ORDER_NOT_FOUND');
    if(order.diningHoldId&&!['已完成','已取消'].includes(order.fulfillmentLabel))throw new Error('DINING_REPRINT_USE_DINING_SURFACE');
    return buildOrderPrintPlan(order,readPrinterBindings(),readSmtPrintConfig()).map(job=>Object.freeze({
      jobId:job.id,
      role:job.role,
      label:job.renderMode==='tsc-bitmap'&&job.labelSpec?job.role+' · '+job.labelSpec.primaryText:job.role,
      detail:job.labelSpec?.pieceLabel,
      bindingId:job.binding.id,
      printerName:job.binding.name,
      physicalKey:job.binding.host.trim()+':'+job.binding.port,
    }));
  },
  async reprintOrderJobs(orderId,jobIds,reason){
    const order=data.orders.find(x=>x.id===orderId);
    if(!order)throw new Error('ORDER_NOT_FOUND');
    if(order.diningHoldId&&!['已完成','已取消'].includes(order.fulfillmentLabel))throw new Error('DINING_REPRINT_USE_DINING_SURFACE');
    if(!jobIds.length)throw new Error('REPRINT_SELECTION_REQUIRED');
    const result=await dispatchOrderOutputs(order,new Set(jobIds),true);
    appendActionAudit({action:'REPRINT',orderId,reason:String(reason||'').trim()||undefined});
    return result;
  },
  async updateOrderItems(orderId,items){
    const order=data.orders.find(x=>x.id===orderId);
    if(!order)throw new Error('ORDER_NOT_FOUND');
    if(order.diningHoldId)throw new Error('DINING_ITEMS_MANAGED_BY_DINING');
    if(order.fulfillmentLabel==='已取消'||order.fulfillmentLabel==='已完成')throw new Error('ORDER_NOT_EDITABLE');
    const normalized=items
      .map(item=>({...item,qty:Math.max(0,Math.floor(Number(item.qty)||0)),unitMinor:Math.max(0,Math.floor(Number(item.unitMinor)||0))}))
      .filter(item=>item.qty>0);
    if(!normalized.length)throw new Error('ORDER_ITEMS_REQUIRED');
    const totalMinor=normalized.reduce((sum,item)=>sum+item.qty*item.unitMinor,0);
    const updatedAt=new Date().toISOString();
    data={...data,orders:data.orders.map(current=>current.id===orderId?{...current,items:normalized,totalMinor,updatedAt}:current)};
    save();
    projectOrder(data.orders.find(current=>current.id===orderId)!);
    return {orderId,totalMinor};
  },
  async cancelOrder(orderId,reason){
    let order=data.orders.find(x=>x.id===orderId);
    if(!order)throw new Error('ORDER_NOT_FOUND');
    if(order.fulfillmentLabel==='已完成')throw new Error('COMPLETED_ORDER_CANNOT_CANCEL');
    if(order.fulfillmentLabel==='已取消')return {orderId,status:'CANCELLED' as const};
    const updatedAt=new Date().toISOString();
    const cancellationReason=String(reason||'').trim();
    const linkedHoldId=order.diningHoldId;
    const linkedHold=linkedHoldId?data.holds.find(hold=>hold.id===linkedHoldId):undefined;
    const nextHolds=linkedHold
      ?data.holds.map(hold=>hold.id===linkedHoldId?cancelDiningHold(hold,updatedAt):hold)
      :data.holds;
    data={
      ...data,
      holds:nextHolds,
      diningRevision:linkedHold?(data.diningRevision??0)+1:data.diningRevision,
      orders:data.orders.map(current=>current.id===orderId?{
        ...current,fulfillmentLabel:'已取消',updatedAt,
        ...(current.diningHoldId?{outstandingMinor:0}:{}),
        ...(cancellationReason?{cancellationReason}:{}),
      }:current),
    };
    save();
    appendActionAudit({action:'CANCEL',orderId,reason:cancellationReason||undefined});
    projectOrder(data.orders.find(current=>current.id===orderId)!);

    order=data.orders.find(x=>x.id===orderId)!;
    if(order.productionIssuedAt&&!order.cancellationNoticeAttemptedAt){
      const cancellationNoticeAttemptedAt=new Date().toISOString();
      data={...data,orders:data.orders.map(current=>current.id===orderId?{
        ...current,cancellationNoticeAttemptedAt,updatedAt:cancellationNoticeAttemptedAt,
      }:current)};
      save();
      order=data.orders.find(x=>x.id===orderId)!;
      const result=await dispatchCancellationNotice(order).catch(()=>({ok:false,code:'CANCEL_NOTICE_OUTCOME_UNKNOWN',state:'UNKNOWN' as const}));
      const completedAt=new Date().toISOString();
      data={...data,orders:data.orders.map(current=>current.id===orderId?{
        ...current,
        cancellationNoticeState:result.state,
        ...(result.ok?{cancellationNoticePrintedAt:completedAt}:{}),
        updatedAt:completedAt,
      }:current)};
      save();
      const updated=data.orders.find(current=>current.id===orderId)!;
      projectOrder(updated);
      appendActionAudit({action:'CANCEL_NOTICE',orderId,reason:result.code});
    }
    return {orderId,status:'CANCELLED' as const};
  },
  applyProviderLifecycle(input){
    const order=data.orders.find(x=>x.id===input.orderId);
    if(!order)throw new Error('ORDER_NOT_FOUND');
    if(order.providerLastMessageId===input.providerMessageId){
      return {orderId:order.id,disposition:'IDEMPOTENT' as const,fulfillmentLabel:order.fulfillmentLabel};
    }

    let parsed:Record<string,unknown>={};
    try{
      const value=JSON.parse(input.rawMessage);
      if(value&&typeof value==='object'&&!Array.isArray(value))parsed=value as Record<string,unknown>;
    }catch{}
    const reason=typeof parsed.cancelReason==='string'?parsed.cancelReason.trim():'';
    let disposition:'APPLIED'|'EVIDENCE_ONLY'|'CONFLICT'='EVIDENCE_ONLY';
    let nextLabel=order.fulfillmentLabel;
    let note='Keeta '+input.eventId+' '+input.eventName;

    if(input.eventId===1002&&order.fulfillmentLabel==='待處理'){
      nextLabel='進行中';disposition='APPLIED';
    }else if(input.eventId===1003&&order.fulfillmentLabel!=='已取消'){
      nextLabel='已完成';disposition=order.fulfillmentLabel==='已完成'?'EVIDENCE_ONLY':'APPLIED';
    }else if(input.eventId===1004||input.eventId===1008){
      if(order.fulfillmentLabel==='已完成'){
        disposition='CONFLICT';
        note='Keeta 已回報取消，但本地訂單已完成';
      }else{
        nextLabel='已取消';disposition=order.fulfillmentLabel==='已取消'?'EVIDENCE_ONLY':'APPLIED';
        note=reason?'Keeta 取消：'+reason:'Keeta 已取消訂單';
      }
    }else if(input.eventId===1006){
      const logisticsStatus=Number(parsed.logisticsStatus);
      note='Keeta 配送狀態 '+(Number.isFinite(logisticsStatus)?String(logisticsStatus):'更新');
    }

    const updatedAt=new Date().toISOString();
    data={...data,orders:data.orders.map(current=>current.id===order.id?{
      ...current,
      fulfillmentLabel:nextLabel,
      updatedAt,
      providerLastEventId:input.eventId,
      providerLastEventName:input.eventName,
      providerLastEventAt:input.providerPushedAt,
      providerLastMessageId:input.providerMessageId,
      providerLifecycleNote:note,
      ...((input.eventId===1004||input.eventId===1008)&&reason?{cancellationReason:reason}:{}),
    }:current)};
    save();
    const updated=data.orders.find(x=>x.id===order.id)!;
    projectOrder(updated);
    appendActionAudit({
      action:'PROVIDER_EVENT_'+input.eventId,
      orderId:order.id,
      reason:note,
    });
    return {orderId:order.id,disposition,fulfillmentLabel:updated.fulfillmentLabel};
  },
  async printDailyClose(businessDate){
    const closes=readLocalDayCloses();
    const wanted=String(businessDate||'').trim();
    const close=[...closes]
      .filter(row=>!wanted||row.businessDate===wanted)
      .sort((a,b)=>b.businessDate.localeCompare(a.businessDate)||b.version-a.version||b.createdAt-a.createdAt)[0];
    if(!close)throw new Error('DAY_CLOSE_NOT_RECORDED');

    const cutoff=readBusinessCutoff();
    const orders=data.orders.filter(order=>{
      const at=Date.parse(order.createdAt);
      if(!Number.isFinite(at))return false;
      return resolveBusinessWindow(at,cutoff.hour,cutoff.minute).businessDate===close.businessDate;
    });
    const report=buildLocalReport(data.orders,{
      now:close.createdAt,
      businessStartHour:cutoff.hour,
      businessStartMinute:cutoff.minute,
    });
    const refunds=data.orders.flatMap(order=>(order.refunds??[]).map(refund=>({
      id:refund.id,
      orderId:order.id,
      display:order.display,
      originalCreatedAt:order.createdAt,
      executionAt:refund.createdAt,
      method:refund.method,
      amountMinor:refund.amountMinor,
      items:refund.lines.map(line=>line.itemName+' ×'+line.quantity).join('、'),
    }))).filter(refund=>{
      const at=Date.parse(refund.executionAt);
      const window=resolveBusinessWindow(close.createdAt,cutoff.hour,cutoff.minute);
      return Number.isFinite(at)&&at>=window.start&&at<window.end;
    });
    const ticket=renderDailyCloseTicket(buildDailyClosePrintData({orders,close,refunds,refundMinor:report.refundMinor}));
    const config=readSmtPrintConfig();
    const receiptLogical=config.logicalPrinters.find(row=>row.id==='logical-receipt');
    if(receiptLogical&&receiptLogical.active===false)throw new Error('DAY_CLOSE_RECEIPT_ROUTE_DISABLED');
    const binding=readPrinterBindings().find(row=>row.role==='顧客小票'&&String(row.host||'').trim());
    if(!binding)throw new Error('DAY_CLOSE_RECEIPT_PRINTER_UNBOUND');
    const result=await printTextLan({
      ...printerInput(binding),
      text:ticket,
      cutAfter:true,
      kickDrawer:false,
      beepAfter:true,
    });
    if(!result.ok)throw new Error(result.code||'DAY_CLOSE_PRINT_FAILED');
    return {printJobId:'dayclose-'+close.id,state:'SENT',businessDate:close.businessDate};
  },
  async printOrderReceipt(orderId){
    const order=data.orders.find(x=>x.id===orderId);
    if(!order)throw new Error('ORDER_NOT_FOUND');
    const summary=await dispatchOrderOutputs(order);
    if(summary.planned===0)throw new Error('NO_PRINTER_ROUTE_BOUND');
    if(summary.failed>0){
      const codes=summary.results.filter(result=>!result.ok).map(result=>result.role+':'+result.code).join(',');
      throw new Error('PRINT_FANOUT_FAILED:'+codes);
    }
    return {printJobId:'fanout-'+order.id,state:'SENT'};
  },
  async readDining(){
    const snapshot=readDiningState();
    data=snapshot;
    const activeHolds=snapshot.holds.filter(hold=>hold.kind==='dining'&&!hold.archivedAt);
    return {
      businessDate:new Date().toISOString().slice(0,10),revision:snapshot.diningRevision??0,
      queue:activeHolds.filter(hold=>!hold.assignedTable).map(hold=>{
        const detail=diningDetail(hold);
        const itemCount=hold.items.reduce((sum,item)=>sum+item.qty,0);
        return {
          id:hold.id,
          codeLabel:hold.formalOrderDisplay??hold.codeLabel,
          partySize:hold.partySize,
          statusLabel:hold.formalOrderId?'待安排座位 · 已落單':'待安排座位',
          ...(hold.formalOrderId?{formalOrderId:hold.formalOrderId}:{}),
          itemCount,
          totalMinor:hold.totalMinor,
          paidMinor:detail.paidMinor,
          remainingMinor:detail.remainingMinor,
        };
      }),
      tables:(()=>{
        const registry=readSmtDiningTableRegistry();
        const active=registry.filter(table=>table.active);
        const fallback=Array.from({length:9},(_,index)=>({id:'T'+String(index+1).padStart(2,'0'),name:String(index+1)+' 號枱',active:true,sortOrder:index+1}));
        const visibleBase=registry.length?active:fallback;
        const byId=new Map(registry.map(table=>[table.id,table]));
        const orphanOccupied=activeHolds
          .filter(hold=>hold.assignedTable&&!visibleBase.some(table=>table.id===hold.assignedTable))
          .map(hold=>{
            const id=String(hold.assignedTable);
            const known=byId.get(id);
            return {id,name:known?.name||id,active:false,sortOrder:Number.MAX_SAFE_INTEGER};
          });
        const visible=[...visibleBase,...orphanOccupied.filter((table,index,rows)=>rows.findIndex(row=>row.id===table.id)===index)];
        return visible.map(table=>{
          const id=table.id;
          const seated=activeHolds.find(hold=>hold.assignedTable===id);
          if(!seated)return {id,areaLabel:'堂食',label:table.name,state:'available' as const};
          const detail=diningDetail(seated);
          const first=detail.lines.filter(line=>line.qty>0).slice(0,2).map(line=>line.name.split('｜')[0]).join('、');
          return {
            id,
            areaLabel:table.active===false?'堂食 · 已停用':'堂食',
            label:table.name,
            state:detail.remainingMinor===0?'settled' as const:'occupied' as const,
            partySize:seated.partySize,
            outstandingLabel:seated.formalOrderDisplay??seated.codeLabel,
            holdId:seated.id,
            startedAt:seated.seatedAt??seated.createdAt,
            itemCount:seated.items.reduce((sum,item)=>sum+item.qty,0),
            itemSummary:first,
            totalMinor:seated.totalMinor,
            paidMinor:detail.paidMinor,
            remainingMinor:detail.remainingMinor,
          };
        });
      })()
    };
  },
  async createDiningWait(input){
    const snapshot=readDiningState();
    const draft:LocalHoldDraft={
      id:nextRuntimeIdentity('HOLD-'),
      codeLabel:'W'+String(snapshot.holds.length+1).padStart(3,'0'),
      kind:'dining',
      createdAt:new Date().toISOString(),
      partySize:Math.max(1,Math.floor(Number(input.partySize)||1)),
      note:String(input.note||''),
      totalMinor:0,
      payments:[],
      items:[],
    };
    commitDiningHolds(snapshot,[draft,...snapshot.holds]);
    return draft;
  },
  async removeDiningWait(id){
    const snapshot=readDiningState();
    const hold=requireDiningHold(snapshot,id);
    if(hold.archivedAt||hold.payments?.length)throw new Error('DINING_HISTORY_PROTECTED');
    if(hold.assignedTable||hold.items.length)throw new Error('DINING_NONEMPTY_HOLD_PROTECTED');
    commitDiningHolds(snapshot,snapshot.holds.filter(row=>row.id!==id));
  },
  async admitDiningHold(holdId){
    const snapshot=readDiningState();
    const hold=requireDiningHold(snapshot,holdId);
    if(hold.archivedAt)throw new Error('DINING_HISTORY_PROTECTED');
    const at=new Date().toISOString();
    const ensured=ensureDiningFormalOrder(snapshot,hold,at);
    if(!ensured.order)throw new Error('DINING_ORDER_ITEMS_REQUIRED');
    if(ensured.changed){
      commitDiningState(snapshot,{
        holds:snapshot.holds.map(row=>row.id===holdId?ensured.hold:row),
        orders:ensured.orders,
      });
      projectDiningOrderNonBlocking(ensured.order);
    }
    return clone(diningDetail(ensured.hold));
  },
  async assignDiningTable(holdId,tableId){
    const snapshot=readDiningState();
    const hold=requireDiningHold(snapshot,holdId);
    if(hold.archivedAt)throw new Error('DINING_HISTORY_PROTECTED');
    const registry=readSmtDiningTableRegistry();
    const allowed=registry.length
      ?registry.filter(table=>table.active).map(table=>table.id)
      :Array.from({length:9},(_,index)=>'T'+String(index+1).padStart(2,'0'));
    if(!allowed.includes(tableId))throw new Error('DINING_TABLE_NOT_ASSIGNABLE');
    if(snapshot.holds.some(row=>row.id!==holdId&&!row.archivedAt&&row.kind==='dining'&&row.assignedTable===tableId)){
      throw new Error('DINING_TABLE_OCCUPIED');
    }
    const at=new Date().toISOString();
    const seatedAt=hold.seatedAt??(hold.assignedTable?hold.createdAt:at);
    const seated=hold.assignedTable===tableId&&hold.seatedAt
      ?hold
      :{...hold,assignedTable:tableId,seatedAt};
    const ensured=ensureDiningFormalOrder(snapshot,seated,at);
    if(hold.assignedTable===tableId&&!ensured.changed)return;
    commitDiningState(snapshot,{
      holds:snapshot.holds.map(row=>row.id===holdId?ensured.hold:row),
      orders:ensured.orders,
    });
    projectDiningOrderNonBlocking(ensured.order);
  },
  async unassignDiningTable(holdId){
    const snapshot=readDiningState();
    const hold=requireDiningHold(snapshot,holdId);
    if(hold.archivedAt)throw new Error('DINING_HISTORY_PROTECTED');
    const {assignedTable,...rest}=hold;
    commitDiningHolds(snapshot,snapshot.holds.map(row=>row.id===holdId?{...rest,...(assignedTable?{lastAssignedTable:assignedTable}:{})}:row));
  },
  async readDiningHold(holdId){
    return clone(diningDetail(requireDiningHold(readDiningState(),holdId)));
  },
  async readDiningHistory(){
    return readDiningState().holds.filter(hold=>hold.kind==='dining'&&hold.archivedAt)
      .sort((a,b)=>String(b.archivedAt).localeCompare(String(a.archivedAt)))
      .map(hold=>clone(diningDetail(hold)));
  },
  async ensureDiningInitialPrint(holdId){
    return clone(await ensureDiningInitialPrintByHold(holdId));
  },
  async ensureDiningPaymentReceipt(holdId,submissionId){
    return clone(await ensureDiningPaymentReceiptBySubmission(holdId,submissionId));
  },
  async appendDiningItems(holdId,input){
    const snapshot=readDiningState();
    const hold=requireDiningHold(snapshot,holdId);
    const appended=appendDiningItemsToSnapshot(snapshot,hold,input);
    if(appended.changed){
      commitDiningState(snapshot,{
        holds:snapshot.holds.map(row=>row.id===holdId?appended.hold:row),
        orders:appended.orders,
      });
      projectDiningOrderNonBlocking(appended.order);
    }
    return Object.freeze({detail:clone(diningDetail(appended.hold)),additionId:appended.addition.id});
  },
  async ensureDiningAdditionPrint(holdId,additionId){
    return clone(await ensureDiningAdditionPrintById(holdId,additionId));
  },
  async settleDiningHold(holdId,selections,tender,command){
    if(!command||typeof command.submissionId!=='string'||!command.submissionId.trim()||command.submissionId.length>200||
       typeof command.expectedRevision!=='string'||!command.expectedRevision){
      throw new Error('DINING_CHECKOUT_REFRESH_REQUIRED');
    }
    if(!['CASH','ALIPAY','WECHAT','FPS','PAYME','COMBO'].includes(tender))throw new Error('DINING_TENDER_INVALID');
    if(!Array.isArray(selections)||!selections.length)throw new Error('DINING_SELECTION_INVALID');

    const seen=new Set<number>();
    const normalized=selections.map(selection=>{
      if(!selection||!Number.isSafeInteger(selection.lineIndex)||selection.lineIndex<0||
         !Number.isSafeInteger(selection.qty)||selection.qty<=0){
        throw new Error('DINING_SELECTION_INVALID');
      }
      if(seen.has(selection.lineIndex))throw new Error('DINING_DUPLICATE_SELECTION');
      seen.add(selection.lineIndex);
      return {lineIndex:selection.lineIndex,qty:selection.qty};
    }).sort((a,b)=>a.lineIndex-b.lineIndex);

    const rawSplit=Array.isArray(command.splitTenders)?command.splitTenders:[];
    const splitTenders=rawSplit.map(row=>({
      tender:row.tender,
      amountMinor:Math.max(0,Math.floor(Number(row.amountMinor)||0)),
    })).filter(row=>row.amountMinor>0)
      .sort((a,b)=>a.tender.localeCompare(b.tender));
    if(tender!=='COMBO'&&splitTenders.length)throw new Error('DINING_SPLIT_TENDER_INVALID');
    if(splitTenders.some(row=>!['CASH','ALIPAY','WECHAT','FPS','PAYME'].includes(row.tender))){
      throw new Error('DINING_SPLIT_TENDER_INVALID');
    }
    const signature=JSON.stringify([holdId,tender,normalized,command.receivedMinor??null,splitTenders]);
    const snapshot=readDiningState();
    const hold=requireDiningHold(snapshot,holdId);
    const prior=snapshot.holds
      .flatMap(row=>(row.payments??[]).map(payment=>({holdId:row.id,payment})))
      .find(row=>row.payment.submissionId===command.submissionId);
    if(prior){
      if(prior.holdId!==holdId||prior.payment.requestSignature!==signature)throw new Error('DINING_SUBMISSION_CONFLICT');
      data=snapshot;
      return clone(diningDetail(hold));
    }

    if(hold.archivedAt)throw new Error('DINING_ALREADY_SETTLED');
    if(command.expectedRevision!==diningCheckoutRevision(hold))throw new Error('DINING_CHECKOUT_STALE');
    if(hold.items.some(row=>!Number.isSafeInteger(row.qty)||row.qty<=0||!Number.isSafeInteger(row.unitMinor)||row.unitMinor<0)){
      throw new Error('DINING_AMOUNT_INVALID');
    }
    const computedTotal=hold.items.reduce((total,row)=>total+row.qty*row.unitMinor,0);
    if(!Number.isSafeInteger(computedTotal)||computedTotal!==hold.totalMinor)throw new Error('DINING_TOTAL_MISMATCH');

    const detail=diningDetail(hold);
    const paymentSelections=normalized.map(selection=>{
      const line=detail.lines[selection.lineIndex];
      if(!line)throw new Error('DINING_LINE_NOT_FOUND');
      if(selection.qty>line.remainingQty)throw new Error('DINING_QTY_EXCEEDS_REMAINING');
      return {...selection,amountMinor:line.unitMinor*selection.qty};
    });
    const amountMinor=paymentSelections.reduce((sum,row)=>sum+row.amountMinor,0);
    if(!Number.isSafeInteger(amountMinor)||amountMinor<=0||amountMinor>detail.remainingMinor)throw new Error('DINING_AMOUNT_INVALID');
    if(tender==='COMBO'){
      const splitTotal=splitTenders.reduce((sum,row)=>sum+row.amountMinor,0);
      if(!splitTenders.length||splitTotal!==amountMinor)throw new Error('DINING_SPLIT_TENDER_TOTAL_MISMATCH');
    }

    const receivedMinor=tender==='CASH'?command.receivedMinor:amountMinor;
    if(!Number.isSafeInteger(receivedMinor)||Number(receivedMinor)<amountMinor)throw new Error('DINING_CASH_INSUFFICIENT');

    const createdAt=new Date().toISOString();
    const payment:LocalDiningPayment={
      id:'DP:'+holdId+':'+command.submissionId,
      submissionId:command.submissionId,
      requestSignature:signature,
      createdAt,
      tender,
      amountMinor,
      ...(tender==='COMBO'?{splitTenders}:{}),
      receivedMinor,
      changeMinor:Number(receivedMinor)-amountMinor,
      selections:paymentSelections,
    };
    let updated:LocalHoldDraft={...hold,payments:[...(hold.payments??[]),payment]};
    const after=diningDetail(updated);
    if(after.remainingMinor===0&&after.lines.length>0&&after.lines.every(row=>row.remainingQty===0)){
      updated=archiveDiningHold(updated,createdAt);
    }
    const ensured=ensureDiningFormalOrder(snapshot,updated,createdAt);
    commitDiningState(snapshot,{
      holds:snapshot.holds.map(row=>row.id===holdId?ensured.hold:row),
      orders:ensured.orders,
    });
    projectDiningOrderNonBlocking(ensured.order);
    return clone(diningDetail(ensured.hold));
  },
  async clearDiningHold(holdId){
    const snapshot=readDiningState();
    const hold=requireDiningHold(snapshot,holdId);
    if(hold.archivedAt)return;
    const detail=diningDetail(hold);
    if(detail.remainingMinor>0||!detail.lines.length||!detail.payments.length||detail.lines.some(row=>row.remainingQty>0)){
      throw new Error('DINING_BALANCE_REMAINING');
    }
    const archived=archiveDiningHold(hold,new Date().toISOString());
    commitDiningHolds(snapshot,snapshot.holds.map(row=>row.id===holdId?archived:row));
  },
  async readAvailability(){
    return {revision:1,nodes:Object.entries(productNames).map(([nodeId,label])=>({nodeId,label,status:data.availability[nodeId]||'available',sourceLabel:'LOCAL'})),canChange:true};
  },
  async setAvailability(nodeId,status){
    data={...data,availability:{...data.availability,[nodeId]:status}};save();
    return {revision:1,nodes:Object.entries(productNames).map(([id,label])=>({nodeId:id,label,status:data.availability[id]||'available',sourceLabel:'LOCAL'})),canChange:true};
  }
});
