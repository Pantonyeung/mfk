import {printBytesLan,printTextLan} from './native-print.ts';
import {renderTscRasterLabel} from './label-bitmap.ts';
import {renderEscPosRasterTicket} from './ticket-bitmap.ts';
import {buildOrderPrintPlan,groupTscBitmapJobsByPhysicalPrinter,type PrintBinding,type PlannedPrintJob} from './print-routing.ts';
import {queueOrderProjection} from './projection-outbox.ts';
import {hasStaffPermission,readActiveStaffSession} from './staff-auth.ts';
import {etaMinutesForActiveCount,readSmtPrintConfig,readSmtStoreSettings} from './admin-operational-config.ts';
import {mirrorKeetaOrderCommand,type KeetaProviderMirrorResult} from './keeta-provider-commands.ts';
import {buildDailyClosePrintData,renderDailyCloseTicket} from './daily-close-ticket.ts';
import {appendLocalCashMovement,readLocalDayCloses,resolveBusinessWindow} from './local-operations.ts';
import {readBusinessCutoff} from './cash-opening.ts';
import {readSmtDeviceId} from './admin-config-sync.ts';
import {normalizeMfkOrderLineCompositionV1,type MfkOrderLineCompositionV1} from '../../../contracts/order-line-composition-v1.ts';

export interface SmtOperationalMetric{readonly id:string;readonly label:string;readonly value:string;readonly detail?:string}
export interface SmtOrderListItemViewModel{readonly orderId:string;readonly orderIdLabel:string;readonly itemCount:number;readonly totalLabel:string;readonly paymentLabel:string;readonly fulfillmentLabel:string;readonly sourceLabel?:string;readonly localSequenceLabel?:string;readonly customerName?:string;readonly externalOrderNo?:string;readonly pickupCode?:string}
export interface SmtOrderDetailLineViewModel{readonly id:string;readonly name:string;readonly quantity:number;readonly unitLabel:string;readonly lineTotalLabel:string;readonly detail?:string;readonly composition?:MfkOrderLineCompositionV1}
export interface SmtOrderDetailViewModel extends SmtOrderListItemViewModel{readonly attention:readonly string[];readonly metrics:readonly SmtOperationalMetric[];readonly lines:readonly SmtOrderDetailLineViewModel[];readonly paymentEvidenceRef?:string;readonly paymentVerificationState?:'PENDING'|'VERIFIED'|'REJECTED';readonly paymentCorrections?:readonly PaymentCorrectionRecord[];readonly refunds?:readonly OrderRefundRecord[];readonly cancellationNoticeState?:'DONE'|'FAILED'|'UNKNOWN'}
export interface SmtOrdersProjection{readonly items:readonly SmtOrderListItemViewModel[];readonly detailsByOrderId?:Readonly<Record<string,SmtOrderDetailViewModel>>;readonly selectedOrderId?:string;readonly selectedOrder?:SmtOrderDetailViewModel}
export interface SmtDiningQueueItemViewModel{readonly id:string;readonly codeLabel:string;readonly partySize:number;readonly statusLabel:string}
export interface SmtDiningTableViewModel{readonly id:string;readonly areaLabel:string;readonly label:string;readonly state:'available'|'occupied'|'attention'|'settled';readonly partySize?:number;readonly outstandingLabel?:string;readonly holdId?:string;readonly startedAt?:string;readonly itemCount?:number;readonly itemSummary?:string;readonly totalMinor?:number;readonly paidMinor?:number;readonly remainingMinor?:number}
export interface SmtDiningSessionViewModel{readonly sessionId:string;readonly tableLabels:readonly string[];readonly statusLabel:string;readonly metrics:readonly SmtOperationalMetric[]}
export interface SmtDiningProjection{readonly businessDate:string;readonly revision:number;readonly queue:readonly SmtDiningQueueItemViewModel[];readonly tables:readonly SmtDiningTableViewModel[];readonly selectedSession?:SmtDiningSessionViewModel}
export type SmtAvailabilityStatus='available'|'soldout'|'paused';
export interface SmtAvailabilityNodeViewModel{readonly nodeId:string;readonly label:string;readonly detail?:string;readonly status:SmtAvailabilityStatus;readonly sourceLabel?:string}
export interface SmtAvailabilityProjection{readonly revision:number;readonly nodes:readonly SmtAvailabilityNodeViewModel[];readonly canChange:boolean}

export interface OrderRefundRecord{
  readonly id:string;
  readonly createdAt:string;
  readonly kind:'FULL'|'PARTIAL';
  readonly amountMinor:number;
  readonly method:string;
  readonly note:string;
  readonly staffId?:string;
  readonly staffName?:string;
}
export interface PaymentCorrectionRecord{
  readonly id:string;
  readonly createdAt:string;
  readonly from:string;
  readonly to:string;
  readonly staffId?:string;
  readonly staffName?:string;
}
export interface StoredOrder{
  id:string;display:string;createdAt:string;updatedAt?:string;totalMinor:number;paymentLabel:string;fulfillmentLabel:'待處理'|'進行中'|'可取餐'|'已完成'|'已取消';sourceLabel:string;
  checkoutSubmissionId?:string;
  initialPrintAttemptedAt?:string;
  initialPrintState?:'DISPATCHING'|'DONE'|'FAILED'|'UNKNOWN';
  initialPrintSummary?:Readonly<{planned:number;sent:number;failed:number}>;
  paymentCorrections?:readonly PaymentCorrectionRecord[];
  refunds?:readonly OrderRefundRecord[];
  productionIssuedAt?:string;
  cancellationNoticePrintedAt?:string;
  cancellationNoticeState?:'DONE'|'FAILED'|'UNKNOWN';
  staffId?:string;staffName?:string;cancellationReason?:string;
  customerName?:string;customerPhone?:string;
  keetaDeferCount?:number;keetaLastDeferredAt?:string;
  etaMinutes?:number;etaReadyAt?:string;
  providerRef?:string;providerMessageId?:string;providerPickupCode?:string;diningTableLabel?:string;orderRemark?:string;utensilPreference?:'需要'|'不需要';
  providerLastEventId?:number;providerLastEventName?:string;providerLastEventAt?:string;providerLastMessageId?:string;providerLifecycleNote?:string;
  acceptancePrintedAt?:string;
  diningHoldId?:string;
  productionAdmissionAttemptedAt?:string;
  productionAdmissionState?:'DISPATCHING'|'DONE'|'FAILED'|'UNKNOWN';
  productionAdmissionSummary?:Readonly<{planned:number;sent:number;failed:number}>;
  productionAdmissionResults?:readonly PrintDispatchResult[];
  paymentEvidenceRef?:string;paymentVerificationState?:'PENDING'|'VERIFIED'|'REJECTED';
  items:readonly {id:string;name:string;qty:number;unitMinor:number;serviceMode?:'takeaway'|'dine-in';productCode?:string;detail?:string;composition?:MfkOrderLineCompositionV1}[];
}
export type DiningTender='CASH'|'ALIPAY'|'WECHAT'|'FPS'|'PAYME'|'COMBO';
export interface DiningSettlementCommand{
  readonly submissionId:string;
  readonly expectedRevision:string;
  readonly receivedMinor?:number;
  readonly splitTenders?:readonly {tender:Exclude<DiningTender,'COMBO'>;amountMinor:number}[];
}
export interface LocalDiningPayment{
  readonly submissionId?:string;
  readonly requestSignature?:string;
  readonly receivedMinor?:number;
  readonly changeMinor?:number;
  readonly splitTenders?:readonly {tender:Exclude<DiningTender,'COMBO'>;amountMinor:number}[];
  readonly receiptAttemptedAt?:string;
  readonly receiptState?:'DISPATCHING'|'DONE'|'FAILED'|'UNKNOWN';
  readonly id:string;
  readonly createdAt:string;
  readonly tender:DiningTender;
  readonly amountMinor:number;
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
  readonly checkoutRevision?:string;
  readonly archivedAt?:string;
  readonly lastAssignedTable?:string;
  readonly formalOrderId?:string;
  readonly productionAdmittedAt?:string;
  readonly priceOverrides?:readonly LocalPriceOverrideRecord[];
  readonly firstPrintState?:'NOT_STARTED'|'DISPATCHING'|'DONE'|'FAILED'|'UNKNOWN';
  readonly firstPrintSummary?:Readonly<{planned:number;sent:number;failed:number}>;
  readonly firstPrintResults?:readonly PrintDispatchResult[];
  readonly firstPrintAttention?:'NONE'|'TRANSPORT_REPORTED_INCOMPLETE'|'TRANSPORT_UNKNOWN';
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
}
export interface LocalPriceOverrideRecord{
  readonly id:string;
  readonly createdAt:string;
  readonly lineIndex:number;
  readonly productId:string;
  readonly originalUnitMinor:number;
  readonly effectiveUnitMinor:number;
  readonly deltaMinor:number;
  readonly reason:string;
  readonly staffId:string;
  readonly staffName:string;
  readonly source:'MANUAL_OVERRIDE';
  readonly permission:'PRICE_OVERRIDE';
}
export interface LocalHoldDraft{
  readonly archivedAt?:string;
  readonly lastAssignedTable?:string;
  readonly formalOrderId?:string;
  readonly productionAdmittedAt?:string;
  readonly priceOverrides?:readonly LocalPriceOverrideRecord[];
  readonly id:string;
  readonly codeLabel:string;
  readonly kind:'dining'|'waiting';
  readonly createdAt:string;
  readonly partySize:number;
  readonly note:string;
  readonly totalMinor:number;
  readonly assignedTable?:string;
  readonly payments?:readonly LocalDiningPayment[];
  readonly items:readonly {id:string;name:string;qty:number;unitMinor:number;serviceMode?:'takeaway'|'dine-in';detail?:string;composition?:MfkOrderLineCompositionV1}[];
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
function normalizeCompositionItem<T extends Record<string,unknown>>(item:T):T{
  const composition=normalizeMfkOrderLineCompositionV1(item.composition);
  const {composition:_ignored,...rest}=item;
  return (composition?{...rest,composition}:rest) as T;
}
function read():Persisted{
  try{
    const value=JSON.parse(localStorage.getItem(KEY)||'null');
    if(!value||typeof value!=='object')return clone(defaults);
    const orders=(Array.isArray(value.orders)?value.orders:[]).map((order:any)=>{
      const source=String(order?.sourceLabel||'');
      const paid=Boolean(String(order?.paymentLabel||'').trim());
      const legacyLocal=source.startsWith('現場')||source.startsWith('電話／WhatsApp')||source.startsWith('WhatsApp／電話');
      return {...order,fulfillmentLabel:order?.fulfillmentLabel==='待處理'&&paid&&legacyLocal?'進行中':order?.fulfillmentLabel,items:Array.isArray(order?.items)?order.items.map((item:any)=>normalizeCompositionItem(item)):[]};
    }) as StoredOrder[];
    const holds=(Array.isArray(value.holds)?value.holds:[]).map((hold:any)=>({...hold,items:Array.isArray(hold?.items)?hold.items.map((item:any)=>normalizeCompositionItem(item)):[]}));
    return {orders,availability:value.availability||{},holds};
  }catch{return clone(defaults)}
}
let data=read();
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
  markOrderUnready?(orderId:string):Promise<{readonly orderId:string;readonly status:'IN_PROGRESS'}>;
  markOrderCompleted?(orderId:string):Promise<{readonly orderId:string;readonly status:'COMPLETED'}>;
  printOrderReceipt?(orderId:string):Promise<{readonly printJobId:string;readonly state:string}>;
  printDailyClose?(businessDate?:string):Promise<{readonly printJobId:string;readonly state:string;readonly businessDate:string}>;
  printOrderOutputs?(orderId:string):Promise<PrintDispatchSummary>;
  readOrderReprintOptions?(orderId:string):Promise<readonly SmtReprintOption[]>;
  reprintOrderJobs?(orderId:string,jobIds:readonly string[],reason?:string):Promise<PrintDispatchSummary>;
  updateOrderItems?(orderId:string,items:readonly {id:string;name:string;qty:number;unitMinor:number}[]):Promise<{readonly orderId:string;readonly totalMinor:number}>;
  correctOrderPayment?(orderId:string,paymentLabel:string):Promise<StoredOrder>;
  refundOrder?(orderId:string,input:{kind:'FULL'|'PARTIAL';amountMinor:number;method:string;note?:string}):Promise<StoredOrder>;
  cancelOrder?(orderId:string,reason?:string):Promise<{readonly orderId:string;readonly status:'CANCELLED'}>;
  applyProviderLifecycle?(input:{
    orderId:string;eventId:1002|1003|1004|1006|1008;eventName:string;providerMessageId:string;providerPushedAt:string;rawMessage:string;
  }):{readonly orderId:string;readonly disposition:'APPLIED'|'EVIDENCE_ONLY'|'IDEMPOTENT'|'CONFLICT';readonly fulfillmentLabel:StoredOrder['fulfillmentLabel']};
  readDining?(selectedSessionId?:string):Promise<SmtDiningProjection>;
  readAvailability?():Promise<SmtAvailabilityProjection>;
  setAvailability?(nodeId:string,status:SmtAvailabilityStatus,expectedRevision:number):Promise<SmtAvailabilityProjection>;
  createDiningWait?(input:{partySize:number;note?:string}):Promise<LocalHoldDraft>;
  removeDiningWait?(id:string):Promise<void>;
  assignDiningTable?(holdId:string,tableId:string):Promise<void>;
  unassignDiningTable?(holdId:string):Promise<void>;
  readDiningHold?(holdId:string):Promise<LocalDiningHoldDetail>;
  overrideDiningLinePrice?(holdId:string,lineIndex:number,effectiveUnitMinor:number,reason:string,expectedRevision?:string):Promise<LocalDiningHoldDetail>;
  readDiningHistory?():Promise<readonly LocalDiningHoldDetail[]>;
  printDiningPaymentReceipt?(holdId:string,submissionId:string):Promise<PrintDispatchSummary>;
  reprintDiningPaymentReceipt?(holdId:string,submissionId:string):Promise<PrintDispatchSummary>;
  readDiningReprintOptions?(holdId:string):Promise<readonly SmtReprintOption[]>;
  reprintDiningJobs?(holdId:string,jobIds:readonly string[],reason?:string):Promise<PrintDispatchSummary>;
  settleDiningHold?(holdId:string,selections:readonly {lineIndex:number;qty:number}[],tender:DiningTender,command?:DiningSettlementCommand):Promise<LocalDiningHoldDetail>;
  admitDiningProduction?(holdId:string):Promise<{readonly hold:LocalDiningHoldDetail;readonly orderId:string;readonly display:string;readonly print:PrintDispatchSummary}>;
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
    current.unshift({id:'ACT-'+Date.now().toString(36),at:new Date().toISOString(),...input});
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
    items:readonly {id:string;name:string;qty:number;unitMinor:number;serviceMode?:'takeaway'|'dine-in';productCode?:string;detail?:string;composition?:MfkOrderLineCompositionV1}[];
    totalMinor:number;
    paymentLabel:string;
    sourceLabel?:string;
    providerRef?:string;
    providerMessageId?:string;
    providerPickupCode?:string;
    orderRemark?:string;
    utensilPreference?:'需要'|'不需要';
    customerName?:string;
    customerPhone?:string;
    paymentEvidenceRef?:string;
    paymentVerificationState?:'PENDING'|'VERIFIED'|'REJECTED';
    initialFulfillmentLabel?:StoredOrder['fulfillmentLabel'];
    submissionId?:string;
  }):StoredOrder;
  orders():readonly StoredOrder[];
  acceptOrder(orderId:string):Promise<{readonly orderId:string;readonly status:'ACCEPTED';readonly provider:KeetaProviderMirrorResult}>;
  printOrderOutputs(orderId:string):Promise<PrintDispatchSummary>;
  printInitialOrderOutputsOnce(orderId:string):Promise<PrintDispatchSummary>;
  correctOrderPayment(orderId:string,paymentLabel:string):Promise<StoredOrder>;
  refundOrder(orderId:string,input:{kind:'FULL'|'PARTIAL';amountMinor:number;method:string;note?:string}):Promise<StoredOrder>;
  deferKeetaOrder(orderId:string):Promise<StoredOrder>;
  markOrderUnready(orderId:string):Promise<{readonly orderId:string;readonly status:'IN_PROGRESS'}>;
  markOrderCompleted(orderId:string):Promise<{readonly orderId:string;readonly status:'COMPLETED'}>;
  printDailyClose(businessDate?:string):Promise<{readonly printJobId:string;readonly state:string;readonly businessDate:string}>;
  readOrderReprintOptions(orderId:string):Promise<readonly SmtReprintOption[]>;
  reprintOrderJobs(orderId:string,jobIds:readonly string[],reason?:string):Promise<PrintDispatchSummary>;
  updateOrderItems(orderId:string,items:readonly {id:string;name:string;qty:number;unitMinor:number}[]):Promise<{readonly orderId:string;readonly totalMinor:number}>;
  cancelOrder(orderId:string,reason?:string):Promise<{readonly orderId:string;readonly status:'CANCELLED'}>;
  applyProviderLifecycle(input:{
    orderId:string;eventId:1002|1003|1004|1006|1008;eventName:string;providerMessageId:string;providerPushedAt:string;rawMessage:string;
  }):{readonly orderId:string;readonly disposition:'APPLIED'|'EVIDENCE_ONLY'|'IDEMPOTENT'|'CONFLICT';readonly fulfillmentLabel:StoredOrder['fulfillmentLabel']};
  createHold(input:{kind:'dining'|'waiting';items:readonly {id:string;name:string;qty:number;unitMinor:number;serviceMode?:'takeaway'|'dine-in';detail?:string;composition?:MfkOrderLineCompositionV1}[];totalMinor:number;partySize?:number;note?:string}):LocalHoldDraft;
  holds():readonly LocalHoldDraft[];
  removeHold(id:string):void;
  readDiningHold(holdId:string):Promise<LocalDiningHoldDetail>;
  overrideDiningLinePrice(holdId:string,lineIndex:number,effectiveUnitMinor:number,reason:string,expectedRevision?:string):Promise<LocalDiningHoldDetail>;
  readDiningHistory():Promise<readonly LocalDiningHoldDetail[]>;
  printDiningPaymentReceipt(holdId:string,submissionId:string):Promise<PrintDispatchSummary>;
  reprintDiningPaymentReceipt(holdId:string,submissionId:string):Promise<PrintDispatchSummary>;
  readDiningReprintOptions(holdId:string):Promise<readonly SmtReprintOption[]>;
  reprintDiningJobs(holdId:string,jobIds:readonly string[],reason?:string):Promise<PrintDispatchSummary>;
  settleDiningHold(holdId:string,selections:readonly {lineIndex:number;qty:number}[],tender:DiningTender,command?:DiningSettlementCommand):Promise<LocalDiningHoldDetail>;
  admitDiningProduction(holdId:string):Promise<{readonly hold:LocalDiningHoldDetail;readonly orderId:string;readonly display:string;readonly print:PrintDispatchSummary}>;
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
  const bindings=readPrinterBindings().filter(binding=>binding.role==='製作單'&&String(binding.host||'').trim()&&Number(binding.port)>0);
  if(!bindings.length)return {ok:false,code:'CANCEL_NOTICE_PRODUCTION_ROUTE_MISSING'} as const;
  let ok=0;
  let lastCode='CANCEL_NOTICE_FAILED';
  for(const binding of bindings){
    const result=await printTextLan({
      ...printerInput(binding),
      text:'\n*** 取消通知單 ***\n#'+order.display+' 取消\n來源：'+order.sourceLabel+'\n時間：'+new Date().toLocaleString('zh-HK')+'\n\n',
      cutAfter:true,
      kickDrawer:false,
      beepAfter:true,
    });
    if(result.ok)ok+=1;
    else lastCode=result.code||lastCode;
  }
  return ok===bindings.length?{ok:true,code:'CANCEL_NOTICE_SENT'} as const:{ok:false,code:lastCode} as const;
}

async function dispatchOrderOutputs(order:StoredOrder,requestedJobIds?:ReadonlySet<string>,reprint=false):Promise<PrintDispatchSummary>{
  const started=performance.now();
  let plan=[...buildOrderPrintPlan(order,readPrinterBindings(),readSmtPrintConfig())];
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
  listeners.forEach(fn=>fn());
  return summary;
}

const productNames:Record<string,string>={
  riceball:'原味飯團',tuna:'紫菜吞拿魚飯團',pork:'泡菜豬肉飯團',bento:'肉燥便當',
  curry:'咖喱便當',wedges:'香脆薯角',milkTea:'台式奶茶',lemonTea:'手打檸檬茶'
};

// DINING_SETTLEMENT_SAFETY_R2: no extra database, formal Order or print path.
// Single-runtime synchronous critical section: durable envelope first, then in-memory publication.
// Cross-device/multi-tab transaction serialization is NOT claimed by this local guard.
function readDiningState():Persisted{
  const raw=localStorage.getItem(KEY);
  if(raw===null)return clone(defaults);
  const value=JSON.parse(raw);
  if(!value||!Array.isArray(value.orders)||!Array.isArray(value.holds)||!value.availability||typeof value.availability!=='object')throw new Error('DINING_STORAGE_INVALID');
  return value as Persisted;
}
function commitDiningHolds(snapshot:Persisted,holds:LocalHoldDraft[]){
  const next:Persisted={...snapshot,holds,diningRevision:(snapshot.diningRevision??0)+1};
  localStorage.setItem(KEY,JSON.stringify(next));
  data=next;
  for(const listener of listeners){try{listener();}catch{console.warn('DINING_OBSERVER_FAILED');}}
}
const diningMutationQueues=new Map<string,Promise<void>>();
async function withDiningMutationLock<T>(key:string,operation:()=>Promise<T>):Promise<T>{
  const locks=typeof navigator!=='undefined'?(navigator as Navigator&{locks?:{request:<R>(name:string,options:{mode:'exclusive'},callback:()=>Promise<R>)=>Promise<R>}}).locks:undefined;
  if(locks?.request)return locks.request('mfk:dining:'+key,{mode:'exclusive'},operation);
  const previous=diningMutationQueues.get(key)??Promise.resolve();
  let release!:()=>void;
  const gate=new Promise<void>(resolve=>{release=resolve;});
  const tail=previous.then(()=>gate);
  diningMutationQueues.set(key,tail);
  await previous;
  try{return await operation();}
  finally{release();if(diningMutationQueues.get(key)===tail)diningMutationQueues.delete(key);}
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
    holdId:hold.id,
    checkoutRevision:diningCheckoutRevision(hold),
    archivedAt:hold.archivedAt,
    lastAssignedTable:hold.lastAssignedTable,
    formalOrderId:hold.formalOrderId,
    productionAdmittedAt:hold.productionAdmittedAt,
    priceOverrides:hold.priceOverrides??[],
    firstPrintState:(()=>{
      const order=hold.formalOrderId?data.orders.find(row=>row.id===hold.formalOrderId):undefined;
      return order?.productionAdmissionState??'NOT_STARTED';
    })(),
    firstPrintSummary:(()=>{
      const order=hold.formalOrderId?data.orders.find(row=>row.id===hold.formalOrderId):undefined;
      return order?.productionAdmissionSummary;
    })(),
    firstPrintResults:(()=>{
      const order=hold.formalOrderId?data.orders.find(row=>row.id===hold.formalOrderId):undefined;
      return order?.productionAdmissionResults;
    })(),
    firstPrintAttention:(()=>{
      const order=hold.formalOrderId?data.orders.find(row=>row.id===hold.formalOrderId):undefined;
      if(order?.productionAdmissionState==='UNKNOWN')return 'TRANSPORT_UNKNOWN';
      if(order?.productionAdmissionState==='FAILED')return 'TRANSPORT_REPORTED_INCOMPLETE';
      return 'NONE';
    })(),
    codeLabel:hold.codeLabel,
    assignedTable:hold.assignedTable,
    createdAt:hold.createdAt,
    partySize:hold.partySize,
    note:hold.note,
    totalMinor:hold.totalMinor,
    paidMinor,
    remainingMinor:hold.totalMinor-paidMinor,
    lines,
    payments,
  };
}

export const localRuntime:MfkLocalRuntime=Object.freeze({
  subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener)},
  createOrder(input){
    const submissionId=String(input.submissionId||'').trim();
    if(submissionId){
      const existing=data.orders.find(order=>order.checkoutSubmissionId===submissionId);
      if(existing)return existing;
    }
    const providerRef=String(input.providerRef||'').trim();
    if(providerRef){
      const existing=data.orders.find(order=>order.providerRef===providerRef);
      if(existing)return existing;
    }
    const n=data.orders.length+1;
    const createdAt=new Date().toISOString();
    const session=readActiveStaffSession();
    const initialFulfillmentLabel=input.initialFulfillmentLabel??'進行中';
    const activeCount=data.orders.filter(row=>row.fulfillmentLabel==='進行中').length+1;
    const etaMinutes=initialFulfillmentLabel==='進行中'?etaMinutesForActiveCount(activeCount):undefined;
    const etaReadyAt=etaMinutes?new Date(Date.parse(createdAt)+etaMinutes*60_000).toISOString():undefined;
    const order:StoredOrder={
      id:'MFK-'+Date.now().toString(36),
      display:'P'+String(n).padStart(3,'0'),
      createdAt,
      updatedAt:createdAt,
      totalMinor:input.totalMinor,
      paymentLabel:input.paymentLabel,
      fulfillmentLabel:initialFulfillmentLabel,
      sourceLabel:input.sourceLabel||'現場',
      ...(etaMinutes?{etaMinutes,etaReadyAt}:{}),
      ...(submissionId?{checkoutSubmissionId:submissionId}:{}),
      ...(providerRef?{providerRef}:{}),
      ...(input.providerMessageId?{providerMessageId:String(input.providerMessageId)}:{}),
      ...(input.providerPickupCode?{providerPickupCode:String(input.providerPickupCode)}:{}),
      ...(input.orderRemark?{orderRemark:String(input.orderRemark)}:{}),
      ...(input.utensilPreference?{utensilPreference:input.utensilPreference}:{}),
      ...(input.customerName?{customerName:String(input.customerName).trim().slice(0,120)}:{}),
      ...(input.customerPhone?{customerPhone:String(input.customerPhone).trim().slice(0,40)}:{}),
      ...(input.paymentEvidenceRef?{paymentEvidenceRef:input.paymentEvidenceRef}:{}),
      ...(input.paymentVerificationState?{paymentVerificationState:input.paymentVerificationState}:{}),
      ...(session?{staffId:session.staffId,staffName:session.displayName}:{}),
      items:input.items.map(item=>normalizeCompositionItem({...item})),
    };
    data={...data,orders:[order,...data.orders]};
    save();
    projectOrder(order);
    return order;
  },
  orders(){return data.orders},
  createHold(input){
    const snapshot=readDiningState();
    if(input.kind!=='dining'&&input.kind!=='waiting')throw new Error('HOLD_KIND_INVALID');
    const partySize=Math.floor(Number(input.partySize??1));
    if(!Number.isSafeInteger(partySize)||partySize<1||partySize>99)throw new Error('HOLD_PARTY_SIZE_INVALID');
    const items=input.items.map(item=>normalizeCompositionItem({...item}));
    if(items.some(item=>!String(item.id||'').trim()||!String(item.name||'').trim()||!Number.isSafeInteger(item.qty)||item.qty<=0||!Number.isSafeInteger(item.unitMinor)||item.unitMinor<0))throw new Error('HOLD_ITEM_INVALID');
    const computedTotal=items.reduce((sum,item)=>sum+item.qty*item.unitMinor,0);
    if(!Number.isSafeInteger(computedTotal)||computedTotal!==input.totalMinor)throw new Error('HOLD_TOTAL_MISMATCH');
    const nextSequence=snapshot.holds.reduce((max,row)=>{
      const match=/^H(\d+)$/.exec(row.codeLabel);return Math.max(max,match?Number(match[1]):0);
    },0)+1;
    const draft:LocalHoldDraft={
      id:'HOLD-'+Date.now().toString(36)+'-'+nextSequence.toString(36),
      codeLabel:'H'+String(nextSequence).padStart(3,'0'),
      kind:input.kind,
      createdAt:new Date().toISOString(),
      partySize,
      note:String(input.note||'').trim().slice(0,200),
      totalMinor:computedTotal,
      payments:[],
      items,
    };
    const next={...snapshot,holds:[draft,...snapshot.holds],diningRevision:(snapshot.diningRevision??0)+1};
    localStorage.setItem(KEY,JSON.stringify(next));data=next;listeners.forEach(fn=>fn());
    return clone(draft);
  },
  holds(){return readDiningState().holds.filter(hold=>!hold.archivedAt)},
  removeHold(id){
    const snapshot=readDiningState();const hold=snapshot.holds.find(row=>row.id===id);
    if(!hold)throw new Error('HOLD_NOT_FOUND');
    if(hold.archivedAt||hold.payments?.length||hold.formalOrderId)throw new Error('DINING_HISTORY_PROTECTED');
    if(hold.kind==='dining'&&(hold.assignedTable||hold.items.length))throw new Error('DINING_NONEMPTY_HOLD_PROTECTED');
    commitDiningHolds(snapshot,snapshot.holds.filter(row=>row.id!==id));
  },
  clear(){data=clone(defaults);save()},
  async readOrders(selectedOrderId){
    const visibleOrders=data.orders.filter(order=>!order.items.length||!order.items.every(item=>item.serviceMode==='dine-in'));
    const items=visibleOrders.map(order=>({
      orderId:order.id,orderIdLabel:'#'+order.display,itemCount:order.items.reduce((s,x)=>s+x.qty,0),
      totalLabel:money(order.totalMinor),paymentLabel:order.paymentLabel,fulfillmentLabel:order.fulfillmentLabel,
      sourceLabel:order.sourceLabel,localSequenceLabel:order.display,
      ...(order.customerName?{customerName:order.customerName}:{}),
      ...(order.providerRef?{externalOrderNo:order.providerRef.replace(/^[A-Z]+:/,'')}:{}),
      ...(order.providerPickupCode?{pickupCode:order.providerPickupCode}:{}),
    }));
    const selectedId=selectedOrderId&&visibleOrders.some(x=>x.id===selectedOrderId)?selectedOrderId:visibleOrders[0]?.id;
    const details:Record<string,SmtOrderDetailViewModel>={};
    for(const order of visibleOrders)details[order.id]={
      orderId:order.id,orderIdLabel:'#'+order.display,itemCount:order.items.reduce((s,x)=>s+x.qty,0),totalLabel:money(order.totalMinor),
      paymentLabel:order.paymentLabel,fulfillmentLabel:order.fulfillmentLabel,sourceLabel:order.sourceLabel,localSequenceLabel:order.display,
      ...(order.customerName?{customerName:order.customerName}:{}),
      ...(order.providerRef?{externalOrderNo:order.providerRef.replace(/^[A-Z]+:/,'')}:{}),
      ...(order.providerPickupCode?{pickupCode:order.providerPickupCode}:{}),
      ...(order.paymentEvidenceRef?{paymentEvidenceRef:order.paymentEvidenceRef}:{}),
      ...(order.paymentVerificationState?{paymentVerificationState:order.paymentVerificationState}:{}),
      ...(order.paymentCorrections?.length?{paymentCorrections:order.paymentCorrections}:{}),
      ...(order.refunds?.length?{refunds:order.refunds}:{}),
      ...(order.cancellationNoticeState?{cancellationNoticeState:order.cancellationNoticeState}:{}),
      attention:[
        ...(order.providerLifecycleNote?[order.providerLifecycleNote]:[]),
      ],metrics:[
        {id:'time',label:'時間',value:new Date(order.createdAt).toLocaleTimeString('zh-HK')},
        {id:'items',label:'件數',value:String(order.items.reduce((s,x)=>s+x.qty,0))},
        {id:'total',label:'總額',value:money(order.totalMinor)},
        ...(order.etaReadyAt?[{id:'eta',label:'預計取餐',value:new Date(order.etaReadyAt).toLocaleTimeString('zh-HK',{hour:'2-digit',minute:'2-digit'}),detail:(order.etaMinutes??0)+' 分鐘'}]:[]),
        ...(order.providerLastEventId?[{id:'provider-event',label:'Keeta Event',value:String(order.providerLastEventId),detail:order.providerLastEventName}]:[])
      ],
      lines:order.items.map(item=>({
        id:item.id,
        name:item.name,
        quantity:item.qty,
        unitLabel:money(item.unitMinor),
        lineTotalLabel:money(item.unitMinor*item.qty),
        ...(item.detail?{detail:item.detail}:{}),
        ...(item.composition?{composition:item.composition}:{}),
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
    if(found.paymentEvidenceRef&&found.paymentVerificationState!=='VERIFIED')throw new Error('PAYMENT_EVIDENCE_NOT_VERIFIED');
    const updatedAt=new Date().toISOString();
    if(found.fulfillmentLabel==='待處理'){
      const activeCount=data.orders.filter(row=>row.id!==orderId&&row.fulfillmentLabel==='進行中').length+1;
      const etaMinutes=etaMinutesForActiveCount(activeCount);
      const etaReadyAt=new Date(Date.parse(updatedAt)+etaMinutes*60_000).toISOString();
      data={...data,orders:data.orders.map(x=>x.id===orderId?{...x,fulfillmentLabel:'進行中',etaMinutes,etaReadyAt,updatedAt}:x)};
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
      const productionIssued=print.results.some(row=>row.role==='製作單'&&row.ok);
      data={...data,orders:data.orders.map(x=>x.id===orderId?{
        ...x,
        acceptancePrintedAt,
        ...(productionIssued&&!x.productionIssuedAt?{productionIssuedAt:acceptancePrintedAt}:{}),
        updatedAt:acceptancePrintedAt,
      }:x)};
      save();
      current=data.orders.find(x=>x.id===orderId)!;
      projectOrder(current);
      appendActionAudit({action:'ACCEPT_PRINT',orderId});
    }
    return {orderId,status:'ACCEPTED' as const,provider};
  },
  async markOrderReady(orderId){
    const found=data.orders.find(x=>x.id===orderId);if(!found)throw new Error('ORDER_NOT_FOUND');
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
  async markOrderUnready(orderId){
    const found=data.orders.find(x=>x.id===orderId);if(!found)throw new Error('ORDER_NOT_FOUND');
    if(found.fulfillmentLabel!=='可取餐')throw new Error('ORDER_NOT_UNREADYABLE');
    const updatedAt=new Date().toISOString();
    data={...data,orders:data.orders.map(x=>x.id===orderId?{
      ...x,fulfillmentLabel:'進行中',updatedAt,etaMinutes:undefined,etaReadyAt:undefined,
    }:x)};
    save();
    const current=data.orders.find(x=>x.id===orderId)!;
    projectOrder(current);
    appendActionAudit({action:'UNREADY',orderId});
    return {orderId,status:'IN_PROGRESS' as const};
  },
  async markOrderCompleted(orderId){
    const found=data.orders.find(x=>x.id===orderId);if(!found)throw new Error('ORDER_NOT_FOUND');
    if(found.fulfillmentLabel!=='可取餐')throw new Error('ORDER_NOT_COMPLETABLE');
    const updatedAt=new Date().toISOString();
    data={...data,orders:data.orders.map(x=>x.id===orderId?{...x,fulfillmentLabel:'已完成',updatedAt}:x)};
    save();
    const current=data.orders.find(x=>x.id===orderId)!;
    projectOrder(current);
    appendActionAudit({action:'PICKED_UP',orderId});
    return {orderId,status:'COMPLETED' as const};
  },
  async printOrderOutputs(orderId){
    const order=data.orders.find(x=>x.id===orderId);
    if(!order)throw new Error('ORDER_NOT_FOUND');
    return dispatchOrderOutputs(order);
  },
  async printInitialOrderOutputsOnce(orderId){
    let order=data.orders.find(x=>x.id===orderId);
    if(!order)throw new Error('ORDER_NOT_FOUND');
    if(order.initialPrintAttemptedAt){
      const summary=order.initialPrintSummary??{planned:0,sent:0,failed:0};
      return Object.freeze({orderId,planned:summary.planned,sent:summary.sent,failed:summary.failed,results:Object.freeze([])});
    }
    const attemptedAt=new Date().toISOString();
    data={...data,orders:data.orders.map(x=>x.id===orderId?{...x,initialPrintAttemptedAt:attemptedAt,initialPrintState:'DISPATCHING',updatedAt:attemptedAt}:x)};
    save();
    order=data.orders.find(x=>x.id===orderId)!;
    projectOrder(order);
    try{
      const summary=await dispatchOrderOutputs(order);
      const state=summary.failed>0?'FAILED':'DONE';
      const updatedAt=new Date().toISOString();
      const productionIssued=summary.results.some(row=>row.role==='製作單'&&row.ok);
      data={...data,orders:data.orders.map(x=>x.id===orderId?{
        ...x,
        initialPrintState:state,
        initialPrintSummary:{planned:summary.planned,sent:summary.sent,failed:summary.failed},
        ...(productionIssued&&!x.productionIssuedAt?{productionIssuedAt:updatedAt}:{}),
        updatedAt,
      }:x)};
      save();
      projectOrder(data.orders.find(x=>x.id===orderId)!);
      appendActionAudit({action:'INITIAL_PRINT',orderId,reason:state});
      return summary;
    }catch(error){
      const updatedAt=new Date().toISOString();
      data={...data,orders:data.orders.map(x=>x.id===orderId?{...x,initialPrintState:'UNKNOWN',updatedAt}:x)};
      save();
      projectOrder(data.orders.find(x=>x.id===orderId)!);
      appendActionAudit({action:'INITIAL_PRINT_UNKNOWN',orderId});
      throw error;
    }
  },
  async correctOrderPayment(orderId,paymentLabel){
    const order=data.orders.find(x=>x.id===orderId);
    if(!order)throw new Error('ORDER_NOT_FOUND');
    const next=String(paymentLabel||'').trim();
    if(!next)throw new Error('PAYMENT_METHOD_REQUIRED');
    if(next===order.paymentLabel)return order;
    const session=readActiveStaffSession();
    const createdAt=new Date().toISOString();
    const correction:PaymentCorrectionRecord=Object.freeze({
      id:'PC-'+Date.now().toString(36),
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
  },  async refundOrder(orderId,input){
    const order=data.orders.find(x=>x.id===orderId);
    if(!order)throw new Error('ORDER_NOT_FOUND');
    const amountMinor=Math.max(0,Math.round(Number(input.amountMinor)||0));
    const refundedMinor=(order.refunds??[]).reduce((sum,row)=>sum+Math.max(0,Number(row.amountMinor)||0),0);
    const refundableMinor=Math.max(0,order.totalMinor-refundedMinor);
    if(amountMinor<=0)throw new Error('REFUND_AMOUNT_REQUIRED');
    if(amountMinor>refundableMinor)throw new Error('REFUND_EXCEEDS_REMAINING');
    if(input.kind==='FULL'&&amountMinor!==refundableMinor)throw new Error('FULL_REFUND_MUST_EQUAL_REMAINING');
    const method=String(input.method||'').trim();
    if(!method)throw new Error('REFUND_METHOD_REQUIRED');
    const session=readActiveStaffSession();
    const createdAt=new Date().toISOString();
    const refundId='REF-'+order.id+'-'+Date.now().toString(36);
    const refund:OrderRefundRecord=Object.freeze({
      id:refundId,
      createdAt,
      kind:input.kind,
      amountMinor,
      method,
      note:String(input.note??'').trim(),
      ...(session?{staffId:session.staffId,staffName:session.displayName}:{}),
    });
    data={...data,orders:data.orders.map(x=>x.id===orderId?{
      ...x,
      refunds:[...(x.refunds??[]),refund],
      updatedAt:createdAt,
    }:x)};
    save();
    const updated=data.orders.find(x=>x.id===orderId)!;
    projectOrder(updated);
    appendActionAudit({action:'REFUND_'+input.kind,orderId,reason:method+' '+money(amountMinor)});
    if(/\bCASH\b/i.test(method)||method.includes('現金')){
      const cutoff=readBusinessCutoff();
      const businessDate=resolveBusinessWindow(Date.parse(createdAt),cutoff.hour,cutoff.minute).businessDate;
      appendLocalCashMovement({
        id:'CASHMOVE-'+refundId,
        businessDate,
        direction:'OUT',
        kind:'REFUND',
        amountMinor,
        purpose:'訂單退款',
        orderId,
        refundId,
        ...(session?{staffId:session.staffId,staffName:session.displayName}:{}),
        note:String(input.note??'').trim(),
        now:Date.parse(createdAt),
      });
    }
    return updated;
  },

  async deferKeetaOrder(orderId){
    const order=data.orders.find(x=>x.id===orderId);
    if(!order)throw new Error('ORDER_NOT_FOUND');
    if(!/^Keeta\b/i.test(String(order.sourceLabel||'')))throw new Error('KEETA_DEFER_NOT_APPLICABLE');
    if(order.fulfillmentLabel!=='待處理')throw new Error('KEETA_ORDER_NOT_PENDING');
    const count=Math.max(0,Math.floor(Number(order.keetaDeferCount)||0));
    if(count>=2)throw new Error('KEETA_DEFER_LIMIT_REACHED');
    const updatedAt=new Date().toISOString();
    data={...data,orders:data.orders.map(x=>x.id===orderId?{
      ...x,
      keetaDeferCount:count+1,
      keetaLastDeferredAt:updatedAt,
      updatedAt,
    }:x)};
    save();
    const updated=data.orders.find(x=>x.id===orderId)!;
    projectOrder(updated);
    appendActionAudit({action:'KEETA_DEFER',orderId,reason:String(count+1)+'/2'});
    return updated;
  },
  async readOrderReprintOptions(orderId){
    const order=data.orders.find(x=>x.id===orderId);
    if(!order)throw new Error('ORDER_NOT_FOUND');
    const firstResults=new Map((order.productionAdmissionResults??[]).map(row=>[row.jobId,row] as const));
    return buildOrderPrintPlan(order,readPrinterBindings(),readSmtPrintConfig()).map(job=>Object.freeze({
      jobId:job.id,
      role:job.role,
      label:job.renderMode==='tsc-bitmap'&&job.labelSpec?job.role+' · '+job.labelSpec.primaryText:job.role,
      detail:job.labelSpec?.pieceLabel,
      bindingId:job.binding.id,
      printerName:job.binding.name,
      physicalKey:job.binding.host.trim()+':'+job.binding.port,
      firstPrintState:firstResults.has(job.id)?(firstResults.get(job.id)!.ok?'SENT_TO_PRINTER':'TRANSPORT_REPORTED_INCOMPLETE'):'NO_TRANSPORT_EVIDENCE',
      firstPrintCode:firstResults.get(job.id)?.code,
    }));
  },
  async reprintOrderJobs(orderId,jobIds,reason){
    const order=data.orders.find(x=>x.id===orderId);
    if(!order)throw new Error('ORDER_NOT_FOUND');
    if(!jobIds.length)throw new Error('REPRINT_SELECTION_REQUIRED');
    const result=await dispatchOrderOutputs(order,new Set(jobIds),true);
    appendActionAudit({action:'REPRINT',orderId,reason:String(reason||'').trim()||undefined});
    return result;
  },
  async updateOrderItems(orderId,items){
    const order=data.orders.find(x=>x.id===orderId);
    if(!order)throw new Error('ORDER_NOT_FOUND');
    if(order.fulfillmentLabel==='已取消'||order.fulfillmentLabel==='已完成')throw new Error('ORDER_NOT_EDITABLE');
    const normalized=items
      .map((item,index)=>{
        const previous=order.items[index];
        return {
          ...item,
          qty:Math.max(0,Math.floor(Number(item.qty)||0)),
          unitMinor:Math.max(0,Math.floor(Number(item.unitMinor)||0)),
          ...(previous?.serviceMode?{serviceMode:previous.serviceMode}:{}),
          ...(previous?.productCode?{productCode:previous.productCode}:{}),
          ...(previous?.detail?{detail:previous.detail}:{}),
          ...(previous?.composition?{composition:previous.composition}:{}),
        };
      })
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
    data={...data,orders:data.orders.map(current=>current.id===orderId?{
      ...current,fulfillmentLabel:'已取消',updatedAt,
      ...(cancellationReason?{cancellationReason}:{}),
    }:current)};
    save();
    appendActionAudit({action:'CANCEL',orderId,reason:cancellationReason||undefined});
    projectOrder(data.orders.find(current=>current.id===orderId)!);

    order=data.orders.find(x=>x.id===orderId)!;
    if(order.productionIssuedAt&&!order.cancellationNoticePrintedAt){
      const result=await dispatchCancellationNotice(order).catch(()=>({ok:false,code:'CANCEL_NOTICE_UNKNOWN'} as const));
      const at=new Date().toISOString();
      data={...data,orders:data.orders.map(current=>current.id===orderId?{
        ...current,
        cancellationNoticePrintedAt:at,
        cancellationNoticeState:result.ok?'DONE':result.code==='CANCEL_NOTICE_UNKNOWN'?'UNKNOWN':'FAILED',
        updatedAt:at,
      }:current)};
      save();
      projectOrder(data.orders.find(current=>current.id===orderId)!);
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
    const ticket=renderDailyCloseTicket(buildDailyClosePrintData({orders,close}));
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
    data=readDiningState();
    return {
      businessDate:new Date().toISOString().slice(0,10),revision:data.diningRevision??1,
      queue:data.holds.filter(hold=>hold.kind==='dining'&&!hold.archivedAt&&!hold.assignedTable).map(hold=>({
        id:hold.id,
        codeLabel:hold.codeLabel,
        partySize:hold.partySize,
        statusLabel:'待安排座位',
      })),
      tables:(()=>{
        const configured=readSmtStoreSettings().diningTables;
        const tables=configured.length?configured:Array.from({length:9},(_,index)=>({
          id:'T'+String(index+1).padStart(2,'0'),
          name:String(index+1)+' 號枱',
          active:true,
          sortOrder:index+1,
        }));
        const activeTables=tables.filter(table=>table.active!==false).sort((a,b)=>(Number(a.sortOrder)||0)-(Number(b.sortOrder)||0)||String(a.name).localeCompare(String(b.name),'zh-HK'));
        return activeTables.map(table=>{
          const id=table.id;
          const seated=data.holds.find(hold=>hold.kind==='dining'&&!hold.archivedAt&&hold.assignedTable===id);
          if(!seated)return {id,areaLabel:'堂食',label:table.name,state:'available' as const};
          const detail=diningDetail(seated);
          const first=detail.lines.filter(line=>line.qty>0).slice(0,2).map(line=>line.name.split('｜')[0]).join('、');
          return {
            id,
            areaLabel:'堂食',
            label:table.name,
            state:detail.remainingMinor===0&&detail.payments.length>0?'settled' as const:'occupied' as const,
            partySize:seated.partySize,
            outstandingLabel:seated.codeLabel,
            holdId:seated.id,
            startedAt:seated.createdAt,
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
    return withDiningMutationLock('wait-list',async()=>{
      const snapshot=readDiningState();
      const partySize=Math.floor(Number(input.partySize));
      if(!Number.isSafeInteger(partySize)||partySize<1||partySize>99)throw new Error('DINING_PARTY_SIZE_INVALID');
      const note=String(input.note||'').trim().slice(0,200);
      const nextSequence=snapshot.holds.reduce((max,row)=>{
        const match=/^W(\d+)$/.exec(row.codeLabel);return Math.max(max,match?Number(match[1]):0);
      },0)+1;
      const draft:LocalHoldDraft={
        id:'HOLD-'+Date.now().toString(36)+'-'+nextSequence.toString(36),
        codeLabel:'W'+String(nextSequence).padStart(3,'0'),
        kind:'dining',
        createdAt:new Date().toISOString(),
        partySize,
        note,
        totalMinor:0,
        payments:[],
        items:[],
      };
      commitDiningHolds(snapshot,[draft,...snapshot.holds]);
      return clone(draft);
    });
  },
  async removeDiningWait(id){
    return withDiningMutationLock('wait-list',async()=>{
      const snapshot=readDiningState();const hold=requireDiningHold(snapshot,id);
      if(hold.archivedAt||hold.payments?.length)throw new Error('DINING_HISTORY_PROTECTED');
      if(hold.assignedTable||hold.items.length||hold.formalOrderId)throw new Error('DINING_NONEMPTY_HOLD_PROTECTED');
      commitDiningHolds(snapshot,snapshot.holds.filter(row=>row.id!==id));
    });
  },
  async assignDiningTable(holdId,tableId){
    return withDiningMutationLock('table:'+holdId,async()=>{
    const snapshot=readDiningState();const hold=requireDiningHold(snapshot,holdId);
    if(hold.archivedAt)throw new Error('DINING_HISTORY_PROTECTED');
    const allowedTables=readSmtStoreSettings().diningTables;
    if(allowedTables.length&&!allowedTables.some(table=>table.id===tableId))throw new Error('DINING_TABLE_INVALID');
    if(!allowedTables.length&&!/^T0[1-9]$/.test(tableId))throw new Error('DINING_TABLE_INVALID');
    if(snapshot.holds.some(row=>row.id!==holdId&&!row.archivedAt&&row.kind==='dining'&&row.assignedTable===tableId))throw new Error('DINING_TABLE_OCCUPIED');
    if(hold.assignedTable===tableId)return;
    const linkedOrder=hold.formalOrderId?snapshot.orders.find(row=>row.id===hold.formalOrderId):undefined;
    if(hold.formalOrderId&&!linkedOrder)throw new Error('DINING_FORMAL_ORDER_LINK_BROKEN');
    const next:Persisted={
      ...snapshot,
      holds:snapshot.holds.map(row=>row.id===holdId?{...row,assignedTable:tableId}:row),
      orders:linkedOrder?snapshot.orders.map(row=>row.id===linkedOrder.id?{...row,diningTableLabel:tableId,updatedAt:new Date().toISOString()}:row):snapshot.orders,
      diningRevision:(snapshot.diningRevision??0)+1,
    };
    localStorage.setItem(KEY,JSON.stringify(next));data=next;
    for(const listener of listeners){try{listener();}catch{console.warn('DINING_OBSERVER_FAILED');}}
    if(linkedOrder){
      try{projectOrder(data.orders.find(row=>row.id===linkedOrder.id)!);}catch{console.warn('DINING_TABLE_PROJECTION_NON_BLOCKING');}
      appendActionAudit({action:'DINING_TABLE_TRANSFER',orderId:linkedOrder.id,reason:tableId});
      return;
    }
    // Owner contract: 第一次掛入堂食枱就係落單 + 首次完整打印。
    if(hold.items.length)await localRuntime.admitDiningProduction(holdId);
    });
  },
  async unassignDiningTable(holdId){
    return withDiningMutationLock('table:'+holdId,async()=>{
      const snapshot=readDiningState();const hold=requireDiningHold(snapshot,holdId);
      if(hold.archivedAt)throw new Error('DINING_HISTORY_PROTECTED');
      const linkedOrder=hold.formalOrderId?snapshot.orders.find(row=>row.id===hold.formalOrderId):undefined;
      if(hold.formalOrderId&&!linkedOrder)throw new Error('DINING_FORMAL_ORDER_LINK_BROKEN');
      const {assignedTable,...rest}=hold;
      const next:Persisted={
        ...snapshot,
        holds:snapshot.holds.map(row=>row.id===holdId?{...rest,...(assignedTable?{lastAssignedTable:assignedTable}:{})}:row),
        orders:linkedOrder?snapshot.orders.map(row=>row.id===linkedOrder.id?{...row,diningTableLabel:undefined,updatedAt:new Date().toISOString()}:row):snapshot.orders,
        diningRevision:(snapshot.diningRevision??0)+1,
      };
      localStorage.setItem(KEY,JSON.stringify(next));data=next;
      for(const listener of listeners){try{listener();}catch{console.warn('DINING_OBSERVER_FAILED');}}
      if(linkedOrder){
        try{projectOrder(data.orders.find(row=>row.id===linkedOrder.id)!);}catch{console.warn('DINING_TABLE_PROJECTION_NON_BLOCKING');}
        appendActionAudit({action:'DINING_TABLE_UNASSIGN',orderId:linkedOrder.id,reason:assignedTable});
      }
      return clone(diningDetail(requireDiningHold(next,holdId)));
    });
  },
  async overrideDiningLinePrice(holdId,lineIndex,effectiveUnitMinor,reason,expectedRevision){
    return withDiningMutationLock('price:'+holdId,async()=>{
      const snapshot=readDiningState();const hold=requireDiningHold(snapshot,holdId);
      if(expectedRevision&&expectedRevision!==diningCheckoutRevision(hold))throw new Error('DINING_PRICE_OVERRIDE_STALE');
      if(hold.archivedAt)throw new Error('DINING_HISTORY_PROTECTED');
      if(hold.payments?.length)throw new Error('DINING_PRICE_OVERRIDE_AFTER_PAYMENT_FORBIDDEN');
      const session=readActiveStaffSession();
      if(!session)throw new Error('DINING_PRICE_OVERRIDE_AUTH_REQUIRED');
      if(!hasStaffPermission('PRICE_OVERRIDE'))throw new Error('DINING_PRICE_OVERRIDE_FORBIDDEN');
      if(!Number.isSafeInteger(lineIndex)||lineIndex<0||lineIndex>=hold.items.length)throw new Error('DINING_LINE_NOT_FOUND');
      if(!Number.isSafeInteger(effectiveUnitMinor))throw new Error('DINING_PRICE_OVERRIDE_INVALID');
      const normalizedReason=String(reason||'').trim().slice(0,200);
      const item=hold.items[lineIndex];
      const createdAt=new Date().toISOString();
      const record:LocalPriceOverrideRecord={
        id:'DPO:'+holdId+':'+createdAt+':'+lineIndex,
        createdAt,lineIndex,productId:item.id,
        originalUnitMinor:item.unitMinor,effectiveUnitMinor,
        deltaMinor:effectiveUnitMinor-item.unitMinor,
        reason:normalizedReason,staffId:session.staffId,staffName:session.displayName,
        source:'MANUAL_OVERRIDE',permission:'PRICE_OVERRIDE',
      };
      const items=hold.items.map((row,index)=>index===lineIndex?{...row,unitMinor:effectiveUnitMinor}:row);
      const totalMinor=items.reduce((sum,row)=>sum+row.qty*row.unitMinor,0);
      if(!Number.isSafeInteger(totalMinor))throw new Error('DINING_PRICE_OVERRIDE_TOTAL_INVALID');
      const nextHold:LocalHoldDraft={...hold,items,totalMinor,priceOverrides:[...(hold.priceOverrides??[]),record]};
      const linkedOrder=hold.formalOrderId?snapshot.orders.find(row=>row.id===hold.formalOrderId):undefined;
      const next:Persisted={
        ...snapshot,
        holds:snapshot.holds.map(row=>row.id===holdId?nextHold:row),
        orders:linkedOrder?snapshot.orders.map(row=>row.id===linkedOrder.id?{...row,items,totalMinor,updatedAt:createdAt}:row):snapshot.orders,
        diningRevision:(snapshot.diningRevision??0)+1,
      };
      localStorage.setItem(KEY,JSON.stringify(next));data=next;
      for(const listener of listeners){try{listener();}catch{console.warn('DINING_OBSERVER_FAILED');}}
      if(linkedOrder){
        try{projectOrder(data.orders.find(row=>row.id===linkedOrder.id)!);}catch{console.warn('DINING_PRICE_PROJECTION_NON_BLOCKING');}
        appendActionAudit({action:'DINING_PRICE_OVERRIDE',orderId:linkedOrder.id,reason:session.displayName+' '+money(item.unitMinor)+'→'+money(effectiveUnitMinor)+' '+normalizedReason});
      }
      return clone(diningDetail(nextHold));
    });
  },
  async readDiningHold(holdId){
    return clone(diningDetail(requireDiningHold(readDiningState(),holdId)));
  },
  async readDiningHistory(){
    return readDiningState().holds.filter(hold=>hold.kind==='dining'&&hold.archivedAt)
      .sort((a,b)=>String(b.archivedAt).localeCompare(String(a.archivedAt))).map(hold=>clone(diningDetail(hold)));
  },
  async admitDiningProduction(holdId){
    return withDiningMutationLock('admission:'+holdId,async()=>{
    const snapshot=readDiningState();
    const hold=requireDiningHold(snapshot,holdId);
    if(hold.archivedAt)throw new Error('DINING_HISTORY_PROTECTED');
    if(!hold.items.length)throw new Error('DINING_ITEMS_REQUIRED');
    if(hold.items.some(row=>!Number.isSafeInteger(row.qty)||row.qty<=0||!Number.isSafeInteger(row.unitMinor)))throw new Error('DINING_AMOUNT_INVALID');
    const totalMinor=hold.items.reduce((sum,row)=>sum+row.qty*row.unitMinor,0);
    if(!Number.isSafeInteger(totalMinor)||totalMinor!==hold.totalMinor)throw new Error('DINING_TOTAL_MISMATCH');

    let order=hold.formalOrderId?snapshot.orders.find(row=>row.id===hold.formalOrderId):undefined;
    if(hold.formalOrderId&&!order)throw new Error('DINING_FORMAL_ORDER_LINK_BROKEN');

    if(!order){
      const createdAt=new Date().toISOString();
      const session=readActiveStaffSession();
      const n=snapshot.orders.length+1;
      const activeCount=snapshot.orders.filter(row=>row.fulfillmentLabel==='進行中').length+1;
      const etaMinutes=etaMinutesForActiveCount(activeCount);
      const etaReadyAt=etaMinutes?new Date(Date.parse(createdAt)+etaMinutes*60_000).toISOString():undefined;
      order={
        id:'MFK-'+Date.now().toString(36),
        display:'P'+String(n).padStart(3,'0'),
        createdAt,
        updatedAt:createdAt,
        totalMinor,
        paymentLabel:'未結帳',
        fulfillmentLabel:'進行中',
        sourceLabel:'堂食',
        checkoutSubmissionId:'DINING-PRODUCTION:'+hold.id,
        diningHoldId:hold.id,
        diningTableLabel:hold.assignedTable,
        ...(etaMinutes?{etaMinutes,etaReadyAt}:{}),
        ...(session?{staffId:session.staffId,staffName:session.displayName}:{}),
        items:hold.items.map(item=>normalizeCompositionItem({...item,serviceMode:'dine-in' as const})),
      };
      const linkedHold:LocalHoldDraft={...hold,formalOrderId:order.id,productionAdmittedAt:createdAt};
      const next:Persisted={...snapshot,orders:[order,...snapshot.orders],holds:snapshot.holds.map(row=>row.id===hold.id?linkedHold:row),diningRevision:(snapshot.diningRevision??0)+1};
      localStorage.setItem(KEY,JSON.stringify(next));
      data=next;
      for(const listener of listeners){try{listener();}catch{console.warn('DINING_OBSERVER_FAILED');}}
      try{projectOrder(order);}catch{console.warn('DINING_ORDER_PROJECTION_NON_BLOCKING');}
      appendActionAudit({action:'DINING_PRODUCTION_ADMISSION',orderId:order.id,reason:hold.id});
    }

    let current=data.orders.find(row=>row.id===order!.id)!;
    if(current.productionAdmissionAttemptedAt){
      const summary=current.productionAdmissionSummary??{planned:0,sent:0,failed:current.productionAdmissionState==='FAILED'||current.productionAdmissionState==='UNKNOWN'?1:0};
      return {hold:clone(diningDetail(requireDiningHold(readDiningState(),holdId))),orderId:current.id,display:current.display,print:Object.freeze({orderId:current.id,planned:0,sent:0,failed:summary.failed,results:Object.freeze([])})};
    }

    const attemptedAt=new Date().toISOString();
    data={...data,orders:data.orders.map(row=>row.id===current.id?{...row,productionAdmissionAttemptedAt:attemptedAt,productionAdmissionState:'DISPATCHING',updatedAt:attemptedAt}:row)};
    save();
    current=data.orders.find(row=>row.id===current.id)!;
    try{
      const plan=buildOrderPrintPlan(current,readPrinterBindings(),readSmtPrintConfig());
      const productionJobIds=new Set(plan.map(job=>job.id));
      const summary=await dispatchOrderOutputs(current,productionJobIds);
      const state=summary.failed>0?'FAILED':'DONE';
      const updatedAt=new Date().toISOString();
      data={...data,orders:data.orders.map(row=>row.id===current.id?{...row,productionAdmissionState:state,productionAdmissionSummary:{planned:summary.planned,sent:summary.sent,failed:summary.failed},productionAdmissionResults:summary.results,...(summary.results.some(result=>result.role==='製作單'&&result.ok)&&!row.productionIssuedAt?{productionIssuedAt:updatedAt}:{}),updatedAt}:row)};
      save();
      appendActionAudit({action:'DINING_PRODUCTION_PRINT',orderId:current.id,reason:state});
      return {hold:clone(diningDetail(requireDiningHold(readDiningState(),holdId))),orderId:current.id,display:current.display,print:summary};
    }catch(error){
      const updatedAt=new Date().toISOString();
      data={...data,orders:data.orders.map(row=>row.id===current.id?{...row,productionAdmissionState:'UNKNOWN',updatedAt}:row)};
      save();
      appendActionAudit({action:'DINING_PRODUCTION_PRINT_UNKNOWN',orderId:current.id});
      throw error;
    }
    });
  },
  async printDiningPaymentReceipt(holdId,submissionId){
    return withDiningMutationLock('receipt:'+holdId+':'+submissionId,async()=>{
    let snapshot=readDiningState();
    let hold=requireDiningHold(snapshot,holdId);
    if(!hold.formalOrderId)throw new Error('DINING_FORMAL_ORDER_NOT_CREATED');
    let payment=(hold.payments??[]).find(row=>row.submissionId===submissionId);
    if(!payment)throw new Error('DINING_PAYMENT_NOT_FOUND');
    const order=snapshot.orders.find(row=>row.id===hold.formalOrderId);
    if(!order)throw new Error('DINING_FORMAL_ORDER_LINK_BROKEN');
    if(payment.receiptAttemptedAt){
      return Object.freeze({orderId:order.id,planned:0,sent:0,failed:payment.receiptState==='FAILED'||payment.receiptState==='UNKNOWN'?1:0,results:Object.freeze([])});
    }
    const binding=readPrinterBindings().find(row=>row.role==='顧客小票'&&String(row.host||'').trim());
    if(!binding)throw new Error('DINING_RECEIPT_ROUTE_MISSING');

    const attemptedAt=new Date().toISOString();
    const mark=(state:LocalDiningPayment['receiptState'])=>{
      snapshot=readDiningState();hold=requireDiningHold(snapshot,holdId);
      const nextHolds=snapshot.holds.map(row=>row.id===holdId?{
        ...row,payments:(row.payments??[]).map(item=>item.submissionId===submissionId?{...item,receiptAttemptedAt:item.receiptAttemptedAt??attemptedAt,receiptState:state}:item),
      }:row);
      const next={...snapshot,holds:nextHolds,diningRevision:(snapshot.diningRevision??0)+1};
      localStorage.setItem(KEY,JSON.stringify(next));data=next;
      for(const listener of listeners){try{listener();}catch{console.warn('DINING_OBSERVER_FAILED');}}
      hold=requireDiningHold(next,holdId);
      payment=(hold.payments??[]).find(row=>row.submissionId===submissionId)!;
    };
    mark('DISPATCHING');

    const paymentLabel=payment.tender==='COMBO'
      ?'COMBO '+(payment.splitTenders??[]).map(row=>row.tender+' '+money(row.amountMinor)).join(' + ')
      :payment.tender;
    const paymentOrder:StoredOrder={...order,totalMinor:payment.amountMinor,paymentLabel,updatedAt:new Date().toISOString()};
    try{
      const output=await printBytesLan({...printerInput(binding),bytes:await renderEscPosRasterTicket({
        kind:'receipt',order:paymentOrder,cutAfter:true,kickDrawer:payment.tender==='CASH'||Boolean(payment.splitTenders?.some(row=>row.tender==='CASH')),beepAfter:true,
      })});
      mark(output.ok?'DONE':'FAILED');
      const result={jobId:order.id+':payment:'+payment.id+':receipt',role:'顧客小票',ok:output.ok,code:output.code||(output.ok?'SENT':'PRINT_FAILED')} satisfies PrintDispatchResult;
      appendActionAudit({action:'DINING_PAYMENT_RECEIPT',orderId:order.id,reason:paymentLabel+' '+money(payment.amountMinor)});
      return Object.freeze({orderId:order.id,planned:1,sent:result.ok?1:0,failed:result.ok?0:1,results:Object.freeze([Object.freeze(result)])});
    }catch(error){
      mark('UNKNOWN');
      appendActionAudit({action:'DINING_PAYMENT_RECEIPT_UNKNOWN',orderId:order.id,reason:paymentLabel});
      throw error;
    }
    });
  },
  async reprintDiningPaymentReceipt(holdId,submissionId){
    const hold=requireDiningHold(readDiningState(),holdId);
    if(!hold.formalOrderId)throw new Error('DINING_FORMAL_ORDER_NOT_CREATED');
    const payment=(hold.payments??[]).find(row=>row.submissionId===submissionId);
    if(!payment)throw new Error('DINING_PAYMENT_NOT_FOUND');
    const order=data.orders.find(row=>row.id===hold.formalOrderId);
    if(!order)throw new Error('DINING_FORMAL_ORDER_LINK_BROKEN');
    const binding=readPrinterBindings().find(row=>row.role==='顧客小票'&&String(row.host||'').trim());
    if(!binding)throw new Error('DINING_RECEIPT_ROUTE_MISSING');
    const paymentLabel=payment.tender==='COMBO'
      ?'COMBO '+(payment.splitTenders??[]).map(row=>row.tender+' '+money(row.amountMinor)).join(' + ')
      :payment.tender;
    const paymentOrder:StoredOrder={...order,totalMinor:payment.amountMinor,paymentLabel,updatedAt:new Date().toISOString()};
    const output=await printBytesLan({...printerInput(binding),bytes:await renderEscPosRasterTicket({
      kind:'receipt',order:paymentOrder,cutAfter:true,kickDrawer:false,beepAfter:true,
    })});
    appendActionAudit({action:'DINING_PAYMENT_RECEIPT_REPRINT',orderId:order.id,reason:submissionId});
    const result={jobId:order.id+':payment:'+payment.id+':receipt:reprint',role:'顧客小票',ok:output.ok,code:output.code||(output.ok?'SENT':'PRINT_FAILED')} satisfies PrintDispatchResult;
    return Object.freeze({orderId:order.id,planned:1,sent:result.ok?1:0,failed:result.ok?0:1,results:Object.freeze([Object.freeze(result)])});
  },
  async readDiningReprintOptions(holdId){
    const hold=requireDiningHold(readDiningState(),holdId);
    if(!hold.formalOrderId)throw new Error('DINING_FORMAL_ORDER_NOT_CREATED');
    const order=data.orders.find(row=>row.id===hold.formalOrderId);
    if(!order)throw new Error('DINING_FORMAL_ORDER_LINK_BROKEN');
    return buildOrderPrintPlan(order,readPrinterBindings(),readSmtPrintConfig()).map(job=>Object.freeze({
      jobId:job.id,
      role:job.role,
      label:job.role==='枱單'?'枱單':job.role,
      detail:job.labelSpec?.pieceLabel,
      bindingId:job.binding.id,
      printerName:job.binding.name,
      physicalKey:job.binding.host.trim()+':'+job.binding.port,
    }));
  },
  async reprintDiningJobs(holdId,jobIds,reason){
    const hold=requireDiningHold(readDiningState(),holdId);
    if(!hold.formalOrderId)throw new Error('DINING_FORMAL_ORDER_NOT_CREATED');
    const order=data.orders.find(row=>row.id===hold.formalOrderId);
    if(!order)throw new Error('DINING_FORMAL_ORDER_LINK_BROKEN');
    if(!jobIds.length)throw new Error('REPRINT_SELECTION_REQUIRED');
    const plan=buildOrderPrintPlan(order,readPrinterBindings(),readSmtPrintConfig());
    const allowed=new Set(plan.map(job=>job.id));
    const unique=[...new Set(jobIds)];
    if(unique.some(id=>!allowed.has(id)))throw new Error('DINING_REPRINT_JOB_INVALID');
    const result=await dispatchOrderOutputs(order,new Set(unique),true);
    appendActionAudit({action:'DINING_REPRINT',orderId:order.id,reason:(String(reason||'').trim()||'MANUAL')+' jobs='+unique.join(',')});
    return result;
  },
  async settleDiningHold(holdId,selections,tender,command){
    return withDiningMutationLock('payment:'+holdId,async()=>{
    if(!command||typeof command.submissionId!=='string'||!command.submissionId.trim()||command.submissionId.length>200||typeof command.expectedRevision!=='string'||!command.expectedRevision)throw new Error('DINING_CHECKOUT_REFRESH_REQUIRED');
    if(!['CASH','ALIPAY','WECHAT','FPS','PAYME','COMBO'].includes(tender))throw new Error('DINING_TENDER_INVALID');
    if(!Array.isArray(selections)||!selections.length)throw new Error('DINING_SELECTION_INVALID');
    const seen=new Set<number>();
    const normalized=selections.map(selection=>{
      if(!selection||!Number.isSafeInteger(selection.lineIndex)||selection.lineIndex<0||!Number.isSafeInteger(selection.qty)||selection.qty<=0)throw new Error('DINING_SELECTION_INVALID');
      if(seen.has(selection.lineIndex))throw new Error('DINING_DUPLICATE_SELECTION');
      seen.add(selection.lineIndex);return {lineIndex:selection.lineIndex,qty:selection.qty};
    }).sort((a,b)=>a.lineIndex-b.lineIndex);
    const splitTenders=(command.splitTenders??[]).map(row=>({tender:row.tender,amountMinor:row.amountMinor})).filter(row=>row.amountMinor>0);
    if(tender==='COMBO'){
      if(splitTenders.length<2)throw new Error('DINING_COMBO_SPLIT_REQUIRED');
      if(splitTenders.some(row=>!['CASH','ALIPAY','WECHAT','FPS','PAYME'].includes(row.tender)||!Number.isSafeInteger(row.amountMinor)||row.amountMinor<=0))throw new Error('DINING_COMBO_SPLIT_INVALID');
      if(new Set(splitTenders.map(row=>row.tender)).size!==splitTenders.length)throw new Error('DINING_COMBO_SPLIT_DUPLICATE');
    }else if(splitTenders.length)throw new Error('DINING_SPLIT_TENDER_UNEXPECTED');
    const signature=JSON.stringify([holdId,tender,normalized,command.receivedMinor??null,splitTenders]);
    const snapshot=readDiningState();const hold=requireDiningHold(snapshot,holdId);
    const prior=snapshot.holds.flatMap(row=>(row.payments??[]).map(payment=>({holdId:row.id,payment}))).find(row=>row.payment.submissionId===command.submissionId);
    if(prior){
      if(prior.holdId!==holdId||prior.payment.requestSignature!==signature)throw new Error('DINING_SUBMISSION_CONFLICT');
      data=snapshot;return clone(diningDetail(hold));
    }
    if(hold.archivedAt)throw new Error('DINING_ALREADY_SETTLED');
    if(command.expectedRevision!==diningCheckoutRevision(hold))throw new Error('DINING_CHECKOUT_STALE');
    if(hold.items.some(row=>!Number.isSafeInteger(row.qty)||row.qty<=0||!Number.isSafeInteger(row.unitMinor)||row.unitMinor<0))throw new Error('DINING_AMOUNT_INVALID');
    const sum=hold.items.reduce((total,row)=>total+row.qty*row.unitMinor,0);
    if(!Number.isSafeInteger(sum)||sum!==hold.totalMinor)throw new Error('DINING_TOTAL_MISMATCH');
    const detail=diningDetail(hold);
    const paymentSelections=normalized.map(selection=>{
      const line=detail.lines[selection.lineIndex];
      if(!line)throw new Error('DINING_LINE_NOT_FOUND');
      if(selection.qty>line.remainingQty)throw new Error('DINING_QTY_EXCEEDS_REMAINING');
      return {...selection,amountMinor:line.unitMinor*selection.qty};
    });
    const amountMinor=paymentSelections.reduce((sum,row)=>sum+row.amountMinor,0);
    if(!Number.isSafeInteger(amountMinor))throw new Error('DINING_AMOUNT_INVALID');
    if(detail.totalMinor<0||detail.remainingMinor<0)throw new Error('DINING_NEGATIVE_BALANCE_REQUIRES_ADJUSTMENT');
    if(amountMinor<0||amountMinor>detail.remainingMinor)throw new Error('DINING_AMOUNT_INVALID');
    if(tender==='COMBO'&&splitTenders.reduce((sum,row)=>sum+row.amountMinor,0)!==amountMinor)throw new Error('DINING_COMBO_TOTAL_MISMATCH');
    const cashSplit=tender==='COMBO'?splitTenders.find(row=>row.tender==='CASH'):undefined;
    const receivedMinor=tender==='CASH'
      ?command.receivedMinor
      :cashSplit
        ?command.receivedMinor
        :amountMinor;
    if(tender==='CASH'&&(!Number.isSafeInteger(receivedMinor)||receivedMinor!<amountMinor))throw new Error('DINING_CASH_INSUFFICIENT');
    if(cashSplit&&(!Number.isSafeInteger(receivedMinor)||receivedMinor!<cashSplit.amountMinor))throw new Error('DINING_CASH_INSUFFICIENT');
    const createdAt=new Date().toISOString();
    const payment:LocalDiningPayment={
      id:'DP:'+holdId+':'+command.submissionId,submissionId:command.submissionId,requestSignature:signature,createdAt,tender,amountMinor,
      receivedMinor,
      changeMinor:tender==='CASH'?receivedMinor!-amountMinor:cashSplit?receivedMinor!-cashSplit.amountMinor:0,
      ...(splitTenders.length?{splitTenders}:{}),
      selections:paymentSelections,
    };
    let updated:LocalHoldDraft={...hold,payments:[...(hold.payments??[]),payment]};
    const after=diningDetail(updated);
    if(after.remainingMinor===0&&after.lines.length>0&&after.lines.every(row=>row.remainingQty===0))updated=archiveDiningHold(updated,createdAt);

    const formalOrder=hold.formalOrderId?snapshot.orders.find(row=>row.id===hold.formalOrderId):undefined;
    if(hold.formalOrderId&&!formalOrder)throw new Error('DINING_FORMAL_ORDER_LINK_BROKEN');
    const effectivePaymentLabel=updated.payments?.length===1
      ?tender
      :updated.payments?.map(row=>row.tender).every(value=>value===updated.payments?.[0]?.tender)
        ?updated.payments?.[0]?.tender??tender
        :'COMBO';
    const nextOrders=formalOrder?snapshot.orders.map(row=>row.id===formalOrder.id?{
      ...row,
      paymentLabel:effectivePaymentLabel,
      updatedAt:createdAt,
    }:row):snapshot.orders;
    const next:Persisted={
      ...snapshot,
      orders:nextOrders,
      holds:snapshot.holds.map(row=>row.id===holdId?updated:row),
      diningRevision:(snapshot.diningRevision??0)+1,
    };
    // Payment history + current Formal Order tender projection commit together.
    localStorage.setItem(KEY,JSON.stringify(next));
    data=next;
    for(const listener of listeners){try{listener();}catch{console.warn('DINING_OBSERVER_FAILED');}}
    if(formalOrder){
      const current=data.orders.find(row=>row.id===formalOrder.id)!;
      try{projectOrder(current);}catch{console.warn('DINING_PAYMENT_PROJECTION_NON_BLOCKING');}
      appendActionAudit({action:'DINING_PAYMENT',orderId:current.id,reason:tender+' '+money(amountMinor)});
    }
    return clone(diningDetail(updated));
    });
  },
  async clearDiningHold(holdId){
    return withDiningMutationLock('payment:'+holdId,async()=>{
    const snapshot=readDiningState();const hold=requireDiningHold(snapshot,holdId);
    if(hold.archivedAt)return;
    const detail=diningDetail(hold);
    if(detail.remainingMinor>0||!detail.lines.length||!detail.payments.length||detail.lines.some(row=>row.remainingQty>0))throw new Error('DINING_BALANCE_REMAINING');
    const archived=archiveDiningHold(hold,new Date().toISOString());
    commitDiningHolds(snapshot,snapshot.holds.map(row=>row.id===holdId?archived:row));
    });
  },
  async readAvailability(){
    return {revision:1,nodes:Object.entries(productNames).map(([nodeId,label])=>({nodeId,label,status:data.availability[nodeId]||'available',sourceLabel:'LOCAL'})),canChange:true};
  },
  async setAvailability(nodeId,status){
    data={...data,availability:{...data.availability,[nodeId]:status}};save();
    return {revision:1,nodes:Object.entries(productNames).map(([id,label])=>({nodeId:id,label,status:data.availability[id]||'available',sourceLabel:'LOCAL'})),canChange:true};
  }
});
