import {printBytesLan,printTextLan} from './native-print.ts';
import {renderTscRasterLabel} from './label-bitmap.ts';
import {renderEscPosRasterTicket} from './ticket-bitmap.ts';
import {buildOrderPrintPlan,groupTscBitmapJobsByPhysicalPrinter,type PrintBinding,type PlannedPrintJob} from './print-routing.ts';
import {queueOrderProjection} from './projection-outbox.ts';
import {readActiveStaffSession} from './staff-auth.ts';
import {etaMinutesForActiveCount,readSmtPrintConfig} from './admin-operational-config.ts';
import {mirrorKeetaOrderCommand,type KeetaProviderMirrorResult} from './keeta-provider-commands.ts';
import {buildDailyClosePrintData,renderDailyCloseTicket} from './daily-close-ticket.ts';
import {readLocalDayCloses,resolveBusinessWindow} from './local-operations.ts';
import {readBusinessCutoff} from './cash-opening.ts';
import {readSmtDeviceId} from './admin-config-sync.ts';
import {normalizeMfkOrderLineCompositionV1,type MfkOrderLineCompositionV1} from '../../../contracts/order-line-composition-v1.ts';

export interface SmtOperationalMetric{readonly id:string;readonly label:string;readonly value:string;readonly detail?:string}
export interface SmtOrderListItemViewModel{readonly orderId:string;readonly orderIdLabel:string;readonly itemCount:number;readonly totalLabel:string;readonly paymentLabel:string;readonly fulfillmentLabel:string;readonly sourceLabel?:string;readonly localSequenceLabel?:string;readonly customerName?:string;readonly externalOrderNo?:string;readonly pickupCode?:string}
export interface SmtOrderDetailLineViewModel{readonly id:string;readonly name:string;readonly quantity:number;readonly unitLabel:string;readonly lineTotalLabel:string;readonly detail?:string;readonly composition?:MfkOrderLineCompositionV1}
export interface SmtOrderDetailViewModel extends SmtOrderListItemViewModel{readonly attention:readonly string[];readonly metrics:readonly SmtOperationalMetric[];readonly lines:readonly SmtOrderDetailLineViewModel[];readonly paymentEvidenceRef?:string;readonly paymentVerificationState?:'PENDING'|'VERIFIED'|'REJECTED'}
export interface SmtOrdersProjection{readonly items:readonly SmtOrderListItemViewModel[];readonly detailsByOrderId?:Readonly<Record<string,SmtOrderDetailViewModel>>;readonly selectedOrderId?:string;readonly selectedOrder?:SmtOrderDetailViewModel}
export interface SmtDiningQueueItemViewModel{readonly id:string;readonly codeLabel:string;readonly partySize:number;readonly statusLabel:string}
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
export interface StoredOrder{
  id:string;display:string;createdAt:string;updatedAt?:string;totalMinor:number;paymentLabel:string;fulfillmentLabel:'待處理'|'進行中'|'可取餐'|'已完成'|'已取消';sourceLabel:string;
  checkoutSubmissionId?:string;
  initialPrintAttemptedAt?:string;
  initialPrintState?:'DISPATCHING'|'DONE'|'FAILED'|'UNKNOWN';
  initialPrintSummary?:Readonly<{planned:number;sent:number;failed:number}>;
  paymentCorrections?:readonly PaymentCorrectionRecord[];
  staffId?:string;staffName?:string;cancellationReason?:string;
  customerName?:string;customerPhone?:string;
  keetaDeferCount?:number;keetaLastDeferredAt?:string;
  etaMinutes?:number;etaReadyAt?:string;
  providerRef?:string;providerMessageId?:string;providerPickupCode?:string;orderRemark?:string;utensilPreference?:'需要'|'不需要';
  providerLastEventId?:number;providerLastEventName?:string;providerLastEventAt?:string;providerLastMessageId?:string;providerLifecycleNote?:string;
  acceptancePrintedAt?:string;
  paymentEvidenceRef?:string;paymentVerificationState?:'PENDING'|'VERIFIED'|'REJECTED';
  items:readonly {id:string;name:string;qty:number;unitMinor:number;serviceMode?:'takeaway'|'dine-in';productCode?:string;detail?:string;composition?:MfkOrderLineCompositionV1}[];
}
export type DiningTender='CASH'|'ALIPAY'|'WECHAT'|'FPS'|'PAYME'|'COMBO';
export interface LocalDiningPayment{
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
export interface LocalHoldDraft{
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
interface Persisted{orders:StoredOrder[];availability:Record<string,SmtAvailabilityStatus>;holds:LocalHoldDraft[]}
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
  settleDiningHold?(holdId:string,selections:readonly {lineIndex:number;qty:number}[],tender:DiningTender):Promise<LocalDiningHoldDetail>;
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
  settleDiningHold(holdId:string,selections:readonly {lineIndex:number;qty:number}[],tender:DiningTender):Promise<LocalDiningHoldDetail>;
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
    codeLabel:hold.codeLabel,
    assignedTable:hold.assignedTable,
    createdAt:hold.createdAt,
    partySize:hold.partySize,
    note:hold.note,
    totalMinor:hold.totalMinor,
    paidMinor,
    remainingMinor:Math.max(0,hold.totalMinor-paidMinor),
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
    const n=data.holds.length+1;
    const draft:LocalHoldDraft={
      id:'HOLD-'+Date.now().toString(36),
      codeLabel:'H'+String(n).padStart(3,'0'),
      kind:input.kind,
      createdAt:new Date().toISOString(),
      partySize:Math.max(1,Math.floor(Number(input.partySize)||1)),
      note:String(input.note||''),
      totalMinor:Math.max(0,Math.floor(Number(input.totalMinor)||0)),
      payments:[],
      items:input.items.map(item=>normalizeCompositionItem({...item})),
    };
    data={...data,holds:[draft,...data.holds]};save();return draft;
  },
  holds(){return data.holds},
  removeHold(id){data={...data,holds:data.holds.filter(item=>item.id!==id)};save()},
  clear(){data=clone(defaults);save()},
  async readOrders(selectedOrderId){
    const items=data.orders.map(order=>({
      orderId:order.id,orderIdLabel:'#'+order.display,itemCount:order.items.reduce((s,x)=>s+x.qty,0),
      totalLabel:money(order.totalMinor),paymentLabel:order.paymentLabel,fulfillmentLabel:order.fulfillmentLabel,
      sourceLabel:order.sourceLabel,localSequenceLabel:order.display,
      ...(order.customerName?{customerName:order.customerName}:{}),
      ...(order.providerRef?{externalOrderNo:order.providerRef.replace(/^[A-Z]+:/,'')}:{}),
      ...(order.providerPickupCode?{pickupCode:order.providerPickupCode}:{}),
    }));
    const selectedId=selectedOrderId&&data.orders.some(x=>x.id===selectedOrderId)?selectedOrderId:data.orders[0]?.id;
    const details:Record<string,SmtOrderDetailViewModel>={};
    for(const order of data.orders)details[order.id]={
      orderId:order.id,orderIdLabel:'#'+order.display,itemCount:order.items.reduce((s,x)=>s+x.qty,0),totalLabel:money(order.totalMinor),
      paymentLabel:order.paymentLabel,fulfillmentLabel:order.fulfillmentLabel,sourceLabel:order.sourceLabel,localSequenceLabel:order.display,
      ...(order.customerName?{customerName:order.customerName}:{}),
      ...(order.providerRef?{externalOrderNo:order.providerRef.replace(/^[A-Z]+:/,'')}:{}),
      ...(order.providerPickupCode?{pickupCode:order.providerPickupCode}:{}),
      ...(order.paymentEvidenceRef?{paymentEvidenceRef:order.paymentEvidenceRef}:{}),
      ...(order.paymentVerificationState?{paymentVerificationState:order.paymentVerificationState}:{}),
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
      data={...data,orders:data.orders.map(x=>x.id===orderId?{
        ...x,
        initialPrintState:state,
        initialPrintSummary:{planned:summary.planned,sent:summary.sent,failed:summary.failed},
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
    const order=data.orders.find(x=>x.id===orderId);
    if(!order)throw new Error('ORDER_NOT_FOUND');
    if(order.fulfillmentLabel==='已完成')throw new Error('COMPLETED_ORDER_CANNOT_CANCEL');
    const updatedAt=new Date().toISOString();
    const cancellationReason=String(reason||'').trim();
    data={...data,orders:data.orders.map(current=>current.id===orderId?{
      ...current,fulfillmentLabel:'已取消',updatedAt,
      ...(cancellationReason?{cancellationReason}:{}),
    }:current)};
    save();
    appendActionAudit({action:'CANCEL',orderId,reason:cancellationReason||undefined});
    projectOrder(data.orders.find(current=>current.id===orderId)!);
    return {orderId,status:'CANCELLED'};
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
    return {
      businessDate:new Date().toISOString().slice(0,10),revision:1,
      queue:data.holds.filter(hold=>hold.kind==='dining'&&!hold.assignedTable).map(hold=>({
        id:hold.id,
        codeLabel:hold.codeLabel,
        partySize:hold.partySize,
        statusLabel:'待安排座位',
      })),
      tables:Array.from({length:9},(_,index)=>{
        const id='T'+String(index+1).padStart(2,'0');
        const seated=data.holds.find(hold=>hold.kind==='dining'&&hold.assignedTable===id);
        if(!seated)return {id,areaLabel:'堂食',label:String(index+1),state:'available' as const};
        const detail=diningDetail(seated);
        const first=detail.lines.filter(line=>line.qty>0).slice(0,2).map(line=>line.name.split('｜')[0]).join('、');
        return {
          id,
          areaLabel:'堂食',
          label:String(index+1),
          state:detail.remainingMinor===0?'settled' as const:'occupied' as const,
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
      })
    };
  },
  async createDiningWait(input){
    const draft:LocalHoldDraft={
      id:'HOLD-'+Date.now().toString(36),
      codeLabel:'W'+String(data.holds.length+1).padStart(3,'0'),
      kind:'dining',
      createdAt:new Date().toISOString(),
      partySize:Math.max(1,Math.floor(Number(input.partySize)||1)),
      note:String(input.note||''),
      totalMinor:0,
      payments:[],
      items:[],
    };
    data={...data,holds:[draft,...data.holds]};save();return draft;
  },
  async removeDiningWait(id){
    data={...data,holds:data.holds.filter(item=>item.id!==id)};save();
  },
  async assignDiningTable(holdId,tableId){
    const found=data.holds.find(item=>item.id===holdId);
    if(!found)throw new Error('HOLD_NOT_FOUND');
    data={...data,holds:data.holds.map(item=>item.id===holdId?{...item,assignedTable:tableId}:item)};save();
  },
  async unassignDiningTable(holdId){
    const found=data.holds.find(item=>item.id===holdId);
    if(!found)throw new Error('HOLD_NOT_FOUND');
    data={...data,holds:data.holds.map(item=>{
      if(item.id!==holdId)return item;
      const {assignedTable:_assignedTable,...rest}=item;
      return rest as LocalHoldDraft;
    })};save();
  },
  async readDiningHold(holdId){
    const hold=data.holds.find(item=>item.id===holdId);
    if(!hold)throw new Error('HOLD_NOT_FOUND');
    return diningDetail(hold);
  },
  async settleDiningHold(holdId,selections,tender){
    const hold=data.holds.find(item=>item.id===holdId);
    if(!hold)throw new Error('HOLD_NOT_FOUND');
    if(!hold.assignedTable)throw new Error('DINING_TABLE_NOT_ASSIGNED');
    const detail=diningDetail(hold);
    const normalized=selections.map(selection=>({
      lineIndex:Math.floor(Number(selection.lineIndex)),
      qty:Math.max(0,Math.floor(Number(selection.qty)||0)),
    })).filter(selection=>selection.qty>0);
    if(!normalized.length)throw new Error('DINING_PAYMENT_SELECTION_REQUIRED');
    let amountMinor=0;
    const paymentSelections:{lineIndex:number;qty:number;amountMinor:number}[]=[];
    for(const selection of normalized){
      const line=detail.lines.find(item=>item.lineIndex===selection.lineIndex);
      if(!line)throw new Error('DINING_LINE_NOT_FOUND');
      if(selection.qty>line.remainingQty)throw new Error('DINING_QTY_EXCEEDS_REMAINING');
      const lineAmount=line.unitMinor*selection.qty;
      amountMinor+=lineAmount;
      paymentSelections.push({lineIndex:selection.lineIndex,qty:selection.qty,amountMinor:lineAmount});
    }
    const payment:LocalDiningPayment={
      id:'DP-'+Date.now().toString(36),
      createdAt:new Date().toISOString(),
      tender,
      amountMinor,
      selections:paymentSelections,
    };
    data={...data,holds:data.holds.map(item=>item.id===holdId?{...item,payments:[...(item.payments??[]),payment]}:item)};save();
    const updated=data.holds.find(item=>item.id===holdId)!;
    return diningDetail(updated);
  },
  async clearDiningHold(holdId){
    const hold=data.holds.find(item=>item.id===holdId);
    if(!hold)throw new Error('HOLD_NOT_FOUND');
    const detail=diningDetail(hold);
    if(detail.remainingMinor>0)throw new Error('DINING_BALANCE_REMAINING');
    data={...data,holds:data.holds.filter(item=>item.id!==holdId)};save();
  },
  async readAvailability(){
    return {revision:1,nodes:Object.entries(productNames).map(([nodeId,label])=>({nodeId,label,status:data.availability[nodeId]||'available',sourceLabel:'LOCAL'})),canChange:true};
  },
  async setAvailability(nodeId,status){
    data={...data,availability:{...data.availability,[nodeId]:status}};save();
    return {revision:1,nodes:Object.entries(productNames).map(([id,label])=>({nodeId:id,label,status:data.availability[id]||'available',sourceLabel:'LOCAL'})),canChange:true};
  }
});
