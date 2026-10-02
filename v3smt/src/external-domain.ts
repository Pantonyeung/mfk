import {
  createMfpOrderOperationSession,
  createMfpRefundOperation,
  validateMfpCanonicalOrder,
  type MfpCanonicalOrder,
  type MfpOrderOperationsReadPort,
} from './order-operations-domain.ts';
import type {MfpSecurityPort} from './security-port.ts';
import type {MfpStoreKernelCommandEnvelope,MfpStoreKernelResult} from './store-kernel-port.ts';

export type MfpPaymentEvidenceReview='NOT_REQUIRED'|'UNREVIEWED'|'VERIFIED'|'REJECTED'|'NEEDS_RESUBMISSION';
export type MfpExternalIntentStatus='PENDING'|'ATTENTION'|'COMMITTED'|'CANCELLED';

interface MfpExternalIntentBase{
  readonly revision:string|number;
  readonly itemCount:number;
  readonly status:MfpExternalIntentStatus;
  readonly attentionCode:string|null;
  readonly canonicalOrderId:string|null;
  readonly productIds:readonly string[];
}

export interface MfpCustomerExternalItem{
  readonly lineId:string;
  readonly name:string;
  readonly quantity:number;
  readonly previewUnitMinor?:number;
}

export interface MfpCustomerExternalIntent extends MfpExternalIntentBase{
  readonly kind:'CUSTOMER';
  readonly submissionId:string;
  readonly idempotencyKey:string;
  readonly customerDisplayName:string;
  readonly phone:string;
  readonly previewAmountMinor:number|null;
  readonly serviceMode:'TAKEAWAY'|'DINE_IN';
  readonly paymentMethod:'PAY_AT_STORE'|'ELECTRONIC';
  readonly paymentChannelId:string|null;
  readonly paymentEvidenceRef:string|null;
  readonly evidenceReview:MfpPaymentEvidenceReview;
  readonly createdAt:string;
  readonly items:readonly MfpCustomerExternalItem[];
}

export interface MfpKeetaExternalItem{
  readonly providerLineId:string;
  readonly providerName:string;
  readonly quantity:number;
  readonly mappedProductId:string|null;
  readonly mappedName:string|null;
}

export interface MfpKeetaExternalIntent extends MfpExternalIntentBase{
  readonly kind:'KEETA';
  readonly provider:'KEETA';
  readonly providerShopId:number;
  readonly providerOrderId:string;
  readonly providerMessageId:string;
  readonly fingerprint:string;
  readonly providerPushedAt:string;
  readonly receivedAt:string;
  readonly providerEvidenceRef:string;
  readonly amountMinor:number;
  readonly mappingState:'VALID'|'MISSING'|'AMBIGUOUS';
  readonly mappingRevision:string|number|null;
  readonly providerFactsValid:boolean;
  readonly acceptanceMode:'AUTO'|'MANUAL';
  readonly deferCount:0|1|2;
  readonly items:readonly MfpKeetaExternalItem[];
}

export type MfpExternalIntent=MfpCustomerExternalIntent|MfpKeetaExternalIntent;

export interface MfpKeetaLifecycleEvent{
  readonly providerOrderId:string;
  readonly providerMessageId:string;
  readonly fingerprint:string;
  readonly providerPushedAt:string;
  readonly receivedAt:string;
  readonly eventCode:string;
  readonly canonicalOrderId:string|null;
  readonly state:'PENDING'|'LINKED'|'ATTENTION';
  readonly attentionCode:string|null;
}

export interface MfpKeetaAfterSaleCase{
  readonly afterSaleOrderId:string;
  readonly providerOrderId:string;
  readonly providerMessageId:string;
  readonly canonicalOrderId:string;
  readonly providerStatus:string;
  readonly requestedRefundMinor:number;
  readonly eligibleRefundMinor:number;
  readonly lineUnits:readonly Readonly<{lineId:string;quantity:number}>[];
  readonly state:'PENDING'|'APPROVED'|'REJECTED'|'ATTENTION';
  readonly attentionCode:string|null;
}

export interface MfpExternalReadModel{
  readonly schema:'mfp.external.read.v1';
  readonly storeId:string;
  readonly revision:string|number;
  readonly readAt:string;
  readonly customer:Readonly<{
    intents:readonly MfpCustomerExternalIntent[];
    confirmations:readonly MfpCustomerModificationConfirmation[];
    acceptance:Readonly<{
      revision:string|number;
      mode:'OPEN'|'SPECIAL_CUTOFF'|'IMMEDIATE_STOP';
      acceptingNew:boolean;
      cutoffAt:string|null;
      message:string|null;
    }>;
  }>;
  readonly keeta:Readonly<{
    intents:readonly MfpKeetaExternalIntent[];
    lifecycleEvents:readonly MfpKeetaLifecycleEvent[];
    afterSales:readonly MfpKeetaAfterSaleCase[];
  }>;
  readonly health:Readonly<{
    customer:Readonly<{state:'READY'|'ATTENTION'|'BLOCKED';code:string|null;observedAt:string}>;
    keeta:Readonly<{state:'READY'|'ATTENTION'|'BLOCKED';code:string|null;observedAt:string}>;
  }>;
}

export type MfpExternalAdapterAction=
  |Readonly<{kind:'ACK_ACCEPTED';externalKind:MfpExternalIntent['kind'];identity:string;canonicalOrderId:string;providerMessageId?:string}>
  |Readonly<{kind:'CUSTOMER_EVIDENCE_REVIEW';submissionId:string;idempotencyKey:string;evidenceRef:string;evidenceReview:Exclude<MfpPaymentEvidenceReview,'NOT_REQUIRED'|'UNREVIEWED'>}>
  |Readonly<{kind:'CUSTOMER_PENDING_CANCEL';submissionId:string;idempotencyKey:string;reason:string}>
  |Readonly<{kind:'CUSTOMER_MODIFICATION_PROPOSE';submissionId:string;idempotencyKey:string;proposal:string}>
  |Readonly<{kind:'CUSTOMER_CONTACT';submissionId:string;channel:'WHATSAPP';reason:MfpWhatsAppReason}>
  |Readonly<{kind:'CUSTOMER_CHANNEL_CONTROL_PROPAGATE';commandId:string;scope:'FUTURE_CUSTOMER_SUBMISSIONS_ONLY';mode:'OPEN'|'SPECIAL_CUTOFF'|'IMMEDIATE_STOP';cutoffAt:string|null}>
  |Readonly<{kind:'KEETA_DEFER';providerOrderId:string;providerMessageId:string;fingerprint:string;nextDeferCount:1|2;deferredAt:string;status:'PENDING'}>
  |Readonly<{kind:'KEETA_LIFECYCLE_ACK';providerOrderId:string;providerMessageId:string;canonicalOrderId:string}>
  |Readonly<{kind:'KEETA_AFTER_SALE_DECISION';afterSaleOrderId:string;providerOrderId:string;canonicalOrderId:string;decision:'APPROVE'|'REJECT';reason?:string}>;

export interface MfpExternalAdapter{
  submitExternalAction(action:MfpExternalAdapterAction):Promise<Readonly<{state:'ACKNOWLEDGED'|'ATTENTION';code?:string}>>;
}

export type MfpExternalAdmissionOutcome=
  |Readonly<{state:'COMMITTED';result:Extract<MfpStoreKernelResult,{state:'COMMITTED'}>;order:MfpCanonicalOrder;ackState:'ACKNOWLEDGED'|'ATTENTION'}>
  |Readonly<{state:'REJECTED';result:Extract<MfpStoreKernelResult,{state:'REJECTED'}>;order:null;ackState:null}>
  |Readonly<{state:'UNKNOWN';result:Extract<MfpStoreKernelResult,{state:'UNKNOWN'}>|Extract<MfpStoreKernelResult,{state:'COMMITTED'}>;order:null;ackState:null;readbackRequired:true}>;

type ExternalSecurity=Pick<MfpSecurityPort,'submitFrontlineFormalCommand'>;
type ExternalAuthority=MfpOrderOperationsReadPort&Required<Pick<MfpOrderOperationsReadPort,'readOperations'>>;

function text(value:unknown,code:string,max=240){
  if(typeof value!=='string'||!value.trim()||value!==value.trim()||value.length>max)throw new Error(code);
  return value;
}

function revision(value:unknown){
  if(typeof value==='string')return text(value,'MFP_EXTERNAL_REVISION_INVALID');
  if(!Number.isSafeInteger(value)||Number(value)<0)throw new Error('MFP_EXTERNAL_REVISION_INVALID');
  return Number(value);
}

function instant(value:unknown,code:string){
  const out=text(value,code,80);
  if(!Number.isFinite(Date.parse(out)))throw new Error(code);
  return out;
}

function nonNegative(value:unknown,code:string){
  if(!Number.isSafeInteger(value)||Number(value)<0)throw new Error(code);
  return Number(value);
}

function canonical(value:unknown):string{
  if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  const row=value as Record<string,unknown>;
  return '{'+Object.keys(row).sort().map(key=>JSON.stringify(key)+':'+canonical(row[key])).join(',')+'}';
}

function externalIdentity(intent:MfpExternalIntent){
  return intent.kind==='CUSTOMER'
    ?`CUSTOMER:${text(intent.submissionId,'MFP_CUSTOMER_SUBMISSION_ID_INVALID')}:${text(intent.idempotencyKey,'MFP_CUSTOMER_IDEMPOTENCY_KEY_INVALID')}`
    :`KEETA:${intent.providerShopId}:${text(intent.providerOrderId,'MFP_KEETA_PROVIDER_ORDER_ID_INVALID')}:${text(intent.providerMessageId,'MFP_KEETA_PROVIDER_MESSAGE_ID_INVALID')}:${text(intent.fingerprint,'MFP_KEETA_FINGERPRINT_INVALID')}`;
}

function stableFormalIdentity(intent:MfpExternalIntent){
  if(intent.kind==='CUSTOMER')return Object.freeze({submissionId:intent.submissionId,idempotencyKey:intent.idempotencyKey});
  const base=`MFP-KEETA-${intent.providerShopId}-${intent.providerOrderId}`;
  return Object.freeze({submissionId:base,idempotencyKey:`${base}-${intent.fingerprint}`});
}

function validatePendingIntent(intent:MfpExternalIntent){
  if(intent.status!=='PENDING'&&intent.status!=='ATTENTION')throw new Error('MFP_EXTERNAL_INTENT_NOT_PENDING');
  if(!Number.isSafeInteger(intent.itemCount)||intent.itemCount<1)throw new Error('MFP_EXTERNAL_ITEM_COUNT_INVALID');
  if(!intent.productIds.length||new Set(intent.productIds).size!==intent.productIds.length)throw new Error('MFP_EXTERNAL_PRODUCT_IDS_INVALID');
  revision(intent.revision);
  externalIdentity(intent);
  if(intent.kind==='CUSTOMER'){
    if(intent.paymentMethod==='ELECTRONIC'&&(intent.evidenceReview!=='VERIFIED'||!intent.paymentEvidenceRef))throw new Error('MFP_CUSTOMER_PAYMENT_EVIDENCE_NOT_VERIFIED');
  }else{
    if(!Number.isSafeInteger(intent.providerShopId)||intent.providerShopId<1)throw new Error('MFP_KEETA_PROVIDER_SHOP_INVALID');
    if(intent.mappingState!=='VALID'||intent.mappingRevision===null)throw new Error('MFP_KEETA_MAPPING_INVALID');
    if(!intent.providerFactsValid)throw new Error('MFP_KEETA_PROVIDER_FACTS_INVALID');
  }
}

function validateCustomerIntent(intent:MfpCustomerExternalIntent){
  text(intent.submissionId,'MFP_CUSTOMER_SUBMISSION_ID_INVALID');
  text(intent.idempotencyKey,'MFP_CUSTOMER_IDEMPOTENCY_KEY_INVALID');
  text(intent.customerDisplayName,'MFP_CUSTOMER_DISPLAY_NAME_INVALID');
  text(intent.phone,'MFP_CUSTOMER_PHONE_INVALID',40);
  instant(intent.createdAt,'MFP_CUSTOMER_CREATED_AT_INVALID');
  nonNegative(intent.itemCount,'MFP_EXTERNAL_ITEM_COUNT_INVALID');
  if(intent.itemCount<1)throw new Error('MFP_EXTERNAL_ITEM_COUNT_INVALID');
  if(intent.previewAmountMinor!==null)nonNegative(intent.previewAmountMinor,'MFP_CUSTOMER_PREVIEW_AMOUNT_INVALID');
  if(!Array.isArray(intent.items)||intent.items.reduce((sum,item)=>sum+nonNegative(item.quantity,'MFP_CUSTOMER_ITEM_INVALID'),0)!==intent.itemCount)throw new Error('MFP_CUSTOMER_ITEM_COUNT_MISMATCH');
  for(const item of intent.items){
    text(item.lineId,'MFP_CUSTOMER_ITEM_INVALID');text(item.name,'MFP_CUSTOMER_ITEM_INVALID');
    if(item.quantity<1)throw new Error('MFP_CUSTOMER_ITEM_INVALID');
    if(item.previewUnitMinor!==undefined)nonNegative(item.previewUnitMinor,'MFP_CUSTOMER_ITEM_INVALID');
  }
  if(intent.paymentMethod==='ELECTRONIC'){
    text(intent.paymentChannelId,'MFP_CUSTOMER_PAYMENT_CHANNEL_REQUIRED');
    if(intent.evidenceReview!=='UNREVIEWED'&&!intent.paymentEvidenceRef)throw new Error('MFP_CUSTOMER_PAYMENT_EVIDENCE_REQUIRED');
  }else if(intent.evidenceReview!=='NOT_REQUIRED')throw new Error('MFP_CUSTOMER_PAYMENT_EVIDENCE_STATE_INVALID');
  return Object.freeze({...intent,productIds:Object.freeze([...intent.productIds]),items:Object.freeze(intent.items.map(item=>Object.freeze({...item})))});
}

function validateKeetaIntent(intent:MfpKeetaExternalIntent){
  if(intent.provider!=='KEETA'||!Number.isSafeInteger(intent.providerShopId)||intent.providerShopId<1)throw new Error('MFP_KEETA_PROVIDER_IDENTITY_INVALID');
  for(const value of [intent.providerOrderId,intent.providerMessageId,intent.fingerprint,intent.providerEvidenceRef])text(value,'MFP_KEETA_PROVIDER_IDENTITY_INVALID');
  instant(intent.providerPushedAt,'MFP_KEETA_PROVIDER_TIME_INVALID');instant(intent.receivedAt,'MFP_KEETA_RECEIVED_TIME_INVALID');
  nonNegative(intent.itemCount,'MFP_EXTERNAL_ITEM_COUNT_INVALID');if(intent.itemCount<1)throw new Error('MFP_EXTERNAL_ITEM_COUNT_INVALID');
  nonNegative(intent.amountMinor,'MFP_KEETA_AMOUNT_INVALID');
  if(![0,1,2].includes(intent.deferCount))throw new Error('MFP_KEETA_DEFER_COUNT_INVALID');
  if(!Array.isArray(intent.items)||intent.items.reduce((sum,item)=>sum+nonNegative(item.quantity,'MFP_KEETA_ITEM_INVALID'),0)!==intent.itemCount)throw new Error('MFP_KEETA_ITEM_COUNT_MISMATCH');
  for(const item of intent.items){
    text(item.providerLineId,'MFP_KEETA_ITEM_INVALID');text(item.providerName,'MFP_KEETA_ITEM_INVALID');
    if(item.quantity<1)throw new Error('MFP_KEETA_ITEM_INVALID');
    if(intent.mappingState==='VALID'&&(!item.mappedProductId||!item.mappedName))throw new Error('MFP_KEETA_MAPPING_INVALID');
  }
  if(intent.mappingState==='VALID'&&intent.mappingRevision===null)throw new Error('MFP_KEETA_MAPPING_REVISION_REQUIRED');
  if(intent.mappingState!=='VALID'&&intent.status!=='ATTENTION')throw new Error('MFP_KEETA_MAPPING_ATTENTION_REQUIRED');
  return Object.freeze({...intent,productIds:Object.freeze([...intent.productIds]),items:Object.freeze(intent.items.map(item=>Object.freeze({...item})))});
}

function dedupe<T>(rows:readonly T[],key:(row:T)=>string,conflictCode:string){
  const out:T[]=[];
  const seen=new Map<string,string>();
  for(const row of rows){
    const id=key(row);const material=canonical(row);const existing=seen.get(id);
    if(existing!==undefined){if(existing!==material)throw new Error(conflictCode);continue;}
    seen.set(id,material);out.push(row);
  }
  return Object.freeze(out);
}

export function validateMfpExternalReadModel(value:MfpExternalReadModel):MfpExternalReadModel{
  if(value.schema!=='mfp.external.read.v1')throw new Error('MFP_EXTERNAL_READ_MODEL_INVALID');
  text(value.storeId,'MFP_EXTERNAL_READ_MODEL_INVALID');revision(value.revision);instant(value.readAt,'MFP_EXTERNAL_READ_MODEL_INVALID');
  if(!Array.isArray(value.customer?.intents)||!Array.isArray(value.customer?.confirmations)||!Array.isArray(value.keeta?.intents)||!Array.isArray(value.keeta?.lifecycleEvents)||!Array.isArray(value.keeta?.afterSales))throw new Error('MFP_EXTERNAL_READ_MODEL_INVALID');
  const customer=dedupe(value.customer.intents.map(validateCustomerIntent),row=>row.submissionId+':'+row.idempotencyKey,'MFP_CUSTOMER_INTENT_IDENTITY_CONFLICT');
  if(new Set(customer.map(row=>row.submissionId)).size!==customer.length)throw new Error('MFP_CUSTOMER_INTENT_IDENTITY_CONFLICT');
  const keeta=dedupe(value.keeta.intents.map(validateKeetaIntent),row=>`${row.providerShopId}:${row.providerOrderId}`,'MFP_KEETA_INTENT_IDENTITY_CONFLICT');
  const lifecycleEvents=dedupe(value.keeta.lifecycleEvents.map(item=>{
    for(const field of [item.providerOrderId,item.providerMessageId,item.fingerprint,item.eventCode])text(field,'MFP_KEETA_LIFECYCLE_INVALID');
    instant(item.providerPushedAt,'MFP_KEETA_LIFECYCLE_INVALID');instant(item.receivedAt,'MFP_KEETA_LIFECYCLE_INVALID');
    if(item.canonicalOrderId!==null)text(item.canonicalOrderId,'MFP_KEETA_LIFECYCLE_INVALID');
    return Object.freeze({...item});
  }),item=>`${item.providerOrderId}:${item.providerMessageId}`,'MFP_KEETA_LIFECYCLE_IDENTITY_CONFLICT');
  const afterSales=dedupe(value.keeta.afterSales.map(item=>{
    for(const field of [item.afterSaleOrderId,item.providerOrderId,item.providerMessageId,item.canonicalOrderId,item.providerStatus])text(field,'MFP_KEETA_AFTER_SALE_INVALID');
    nonNegative(item.requestedRefundMinor,'MFP_KEETA_AFTER_SALE_INVALID');nonNegative(item.eligibleRefundMinor,'MFP_KEETA_AFTER_SALE_INVALID');
    if(!Array.isArray(item.lineUnits)||!item.lineUnits.length)throw new Error('MFP_KEETA_AFTER_SALE_LINES_REQUIRED');
    const lineUnits=item.lineUnits as readonly Readonly<{lineId:string;quantity:number}>[];
    for(const line of lineUnits){text(line.lineId,'MFP_KEETA_AFTER_SALE_LINE_INVALID');if(!Number.isSafeInteger(line.quantity)||line.quantity<1)throw new Error('MFP_KEETA_AFTER_SALE_LINE_INVALID');}
    return Object.freeze({...item,lineUnits:Object.freeze(lineUnits.map(line=>Object.freeze({...line})))});
  }),item=>item.afterSaleOrderId,'MFP_KEETA_AFTER_SALE_IDENTITY_CONFLICT');
  const acceptance=value.customer.acceptance;
  revision(acceptance.revision);
  if(!['OPEN','SPECIAL_CUTOFF','IMMEDIATE_STOP'].includes(acceptance.mode))throw new Error('MFP_CUSTOMER_ACCEPTANCE_INVALID');
  if(acceptance.acceptingNew!==(acceptance.mode==='OPEN'))throw new Error('MFP_CUSTOMER_ACCEPTANCE_INVALID');
  if(acceptance.mode==='SPECIAL_CUTOFF'&&!acceptance.cutoffAt)throw new Error('MFP_CUSTOMER_CUTOFF_REQUIRED');
  if(acceptance.cutoffAt)instant(acceptance.cutoffAt,'MFP_CUSTOMER_CUTOFF_INVALID');
  const confirmations=dedupe(value.customer.confirmations.map(item=>{
    text(item.confirmationId,'MFP_CUSTOMER_CONFIRMATION_ID_INVALID');text(item.orderId,'MFP_CUSTOMER_CONFIRMATION_ORDER_ID_INVALID');instant(item.observedAt,'MFP_CUSTOMER_CONFIRMATION_TIME_INVALID');
    return Object.freeze({...item});
  }),item=>item.confirmationId,'MFP_CUSTOMER_CONFIRMATION_IDENTITY_CONFLICT');
  for(const item of [value.health?.customer,value.health?.keeta]){
    if(!item||!['READY','ATTENTION','BLOCKED'].includes(item.state))throw new Error('MFP_EXTERNAL_HEALTH_INVALID');
    instant(item.observedAt,'MFP_EXTERNAL_HEALTH_INVALID');
  }
  return Object.freeze({...value,
    customer:Object.freeze({...value.customer,intents:customer,confirmations,acceptance:Object.freeze({...acceptance})}),
    keeta:Object.freeze({...value.keeta,intents:keeta,lifecycleEvents,afterSales}),
    health:Object.freeze({customer:Object.freeze({...value.health.customer}),keeta:Object.freeze({...value.health.keeta})}),
  });
}

export async function reviewMfpCustomerEvidence(adapter:MfpExternalAdapter,intent:MfpCustomerExternalIntent,evidenceReview:Exclude<MfpPaymentEvidenceReview,'NOT_REQUIRED'|'UNREVIEWED'>){
  if(intent.paymentMethod!=='ELECTRONIC'||!intent.paymentEvidenceRef)throw new Error('MFP_CUSTOMER_PAYMENT_EVIDENCE_REQUIRED');
  return adapter.submitExternalAction(Object.freeze({kind:'CUSTOMER_EVIDENCE_REVIEW',submissionId:intent.submissionId,idempotencyKey:intent.idempotencyKey,evidenceRef:intent.paymentEvidenceRef,evidenceReview}));
}

export type MfpWhatsAppReason='UNCLEAR'|'AMOUNT_MISMATCH'|'DETAIL_MISSING'|'ORDER_FALLBACK';

function whatsappPhone(value:string){
  const digits=value.replace(/\D/g,'');
  if(/^852\d{8}$/.test(digits))return digits;
  if(/^\d{8}$/.test(digits))return '852'+digits;
  if(/^\d{10,15}$/.test(digits))return digits;
  throw new Error('MFP_CUSTOMER_WHATSAPP_PHONE_INVALID');
}

export function buildMfpWhatsAppContact(intent:MfpCustomerExternalIntent,reason:MfpWhatsAppReason){
  const phone=whatsappPhone(intent.phone);
  const amount=intent.previewAmountMinor===null?'訂單':new Intl.NumberFormat('zh-HK',{style:'currency',currency:'HKD'}).format(intent.previewAmountMinor/100);
  const detail=reason==='AMOUNT_MISMATCH'?`付款金額暫時未能核對（${amount}）`:
    reason==='DETAIL_MISSING'?'付款資料唔完整':reason==='ORDER_FALLBACK'?'網上下單暫時未能完成':'付款截圖比較模糊';
  const message=`你好，我哋係磨飯。你嘅訂單 ${intent.submissionId} ${detail}，麻煩透過 WhatsApp 聯絡店舖處理，謝謝。`;
  return Object.freeze({phone,message,url:`https://wa.me/${phone}?text=${encodeURIComponent(message)}`});
}

export function cancelMfpCustomerPending(adapter:MfpExternalAdapter,intent:MfpCustomerExternalIntent,reason:string){
  if(intent.canonicalOrderId)throw new Error('MFP_CUSTOMER_PENDING_CANCEL_FORMAL_ORDER_FORBIDDEN');
  return adapter.submitExternalAction(Object.freeze({kind:'CUSTOMER_PENDING_CANCEL',submissionId:intent.submissionId,idempotencyKey:intent.idempotencyKey,reason:text(reason,'MFP_CUSTOMER_CANCEL_REASON_REQUIRED')}));
}

export function proposeMfpCustomerModification(adapter:MfpExternalAdapter,intent:MfpCustomerExternalIntent,proposal:string){
  if(intent.canonicalOrderId)throw new Error('MFP_CUSTOMER_PENDING_MODIFICATION_FORMAL_ORDER_FORBIDDEN');
  return adapter.submitExternalAction(Object.freeze({kind:'CUSTOMER_MODIFICATION_PROPOSE',submissionId:intent.submissionId,idempotencyKey:intent.idempotencyKey,proposal:text(proposal,'MFP_CUSTOMER_MODIFICATION_PROPOSAL_REQUIRED',500)}));
}

export function canAutoAcceptMfpKeeta(intent:MfpKeetaExternalIntent){
  return intent.acceptanceMode==='AUTO'&&intent.status==='PENDING'&&intent.mappingState==='VALID'&&intent.mappingRevision!==null&&intent.providerFactsValid;
}

export function deferMfpKeetaIntent(adapter:MfpExternalAdapter,intent:MfpKeetaExternalIntent,deferredAt:string){
  if(intent.deferCount>=2)return Promise.reject(new Error('MFP_KEETA_DEFER_LIMIT_REACHED'));
  return adapter.submitExternalAction(Object.freeze({kind:'KEETA_DEFER',providerOrderId:intent.providerOrderId,providerMessageId:intent.providerMessageId,fingerprint:intent.fingerprint,nextDeferCount:(intent.deferCount+1) as 1|2,deferredAt:instant(deferredAt,'MFP_KEETA_DEFER_TIME_INVALID'),status:'PENDING'}));
}

export function createMfpCustomerChannelControlSession(input:{
  readonly commandId:string;
  readonly expectedRevision:string|number;
  readonly mode:'OPEN'|'SPECIAL_CUTOFF'|'IMMEDIATE_STOP';
  readonly cutoffAt:string|null;
  readonly message:string|null;
  readonly security:ExternalSecurity;
  readonly adapter:MfpExternalAdapter;
  readonly now?:()=>string;
}){
  const commandId=text(input.commandId,'MFP_CUSTOMER_CONTROL_ID_INVALID');
  if(input.mode==='SPECIAL_CUTOFF'&&!input.cutoffAt)throw new Error('MFP_CUSTOMER_CUTOFF_REQUIRED');
  const cutoffAt=input.cutoffAt?instant(input.cutoffAt,'MFP_CUSTOMER_CUTOFF_INVALID'):null;
  if(input.mode!=='SPECIAL_CUTOFF'&&cutoffAt)throw new Error('MFP_CUSTOMER_CUTOFF_MODE_INVALID');
  const command:Omit<MfpStoreKernelCommandEnvelope,'deviceId'|'staffSessionRef'>=Object.freeze({
    schema:'mfp.store-kernel.command.v1',storeId:'MF01',submissionId:commandId,idempotencyKey:commandId,
    commandType:'CUSTOMER_NEW_ORDER_ACCEPTANCE_SET',expectedRevision:revision(input.expectedRevision),
    payload:Object.freeze({scope:'FUTURE_CUSTOMER_SUBMISSIONS_ONLY' as const,mode:input.mode,cutoffAt,message:input.message?.trim()||null}),
    createdAt:(input.now??(()=>new Date().toISOString()))(),
  });
  type Outcome=Readonly<{state:MfpStoreKernelResult['state'];result:MfpStoreKernelResult;propagationState:'ACKNOWLEDGED'|'ATTENTION'|null}>;
  let active:Promise<Outcome>|null=null;
  let terminal:Outcome|null=null;
  const submit=()=>{
    if(active)return active;if(terminal)return Promise.resolve(terminal);
    const task=input.security.submitFrontlineFormalCommand(command).then(async result=>{
      if(result.state!=='COMMITTED')return Object.freeze({state:result.state,result,propagationState:null}) as Outcome;
      let propagationState:'ACKNOWLEDGED'|'ATTENTION'='ATTENTION';
      try{propagationState=(await input.adapter.submitExternalAction(Object.freeze({kind:'CUSTOMER_CHANNEL_CONTROL_PROPAGATE',commandId,scope:'FUTURE_CUSTOMER_SUBMISSIONS_ONLY',mode:input.mode,cutoffAt}))).state;}
      catch{/* Formal policy remains committed; propagation is explicit attention. */}
      terminal=Object.freeze({state:'COMMITTED' as const,result,propagationState});return terminal;
    }).finally(()=>{if(active===task)active=null;});
    active=task;return task;
  };
  return Object.freeze({submit,command});
}

export interface MfpCustomerModificationConfirmation{
  readonly confirmationId:string;
  readonly orderId:string;
  readonly expectedRevision:string|number;
  readonly proposedChangeRef:string;
  readonly state:'ACCEPTED'|'REJECTED'|'UNKNOWN';
  readonly amountDeltaMinor:number;
  readonly observedAt:string;
}

export function createMfpCustomerConfirmationSession(input:{
  readonly confirmation:MfpCustomerModificationConfirmation;
  readonly security:ExternalSecurity;
  readonly authority:Pick<MfpOrderOperationsReadPort,'readOrder'>;
  readonly now?:()=>string;
}){
  const value=input.confirmation;
  const moneyRoute=value.amountDeltaMinor>0?'A5_PAYMENT_TOP_UP_REQUIRED':value.amountDeltaMinor<0?'A6_A5_REFUND_REQUIRED':'NONE';
  const command:Omit<MfpStoreKernelCommandEnvelope,'deviceId'|'staffSessionRef'>=Object.freeze({
    schema:'mfp.store-kernel.command.v1',storeId:'MF01',submissionId:`MFP-CUSTOMER-CONFIRM-${text(value.confirmationId,'MFP_CUSTOMER_CONFIRMATION_ID_INVALID')}`,
    idempotencyKey:`MFP-CUSTOMER-CONFIRM-${value.confirmationId}`,commandType:'ORDER_MODIFICATION_CUSTOMER_DECISION',
    expectedRevision:revision(value.expectedRevision),createdAt:(input.now??(()=>new Date().toISOString()))(),
    payload:Object.freeze({orderId:text(value.orderId,'MFP_CUSTOMER_CONFIRMATION_ORDER_ID_INVALID'),proposedChangeRef:text(value.proposedChangeRef,'MFP_CUSTOMER_CONFIRMATION_CHANGE_REF_INVALID'),decision:value.state,amountDeltaMinor:value.amountDeltaMinor,moneyRoute}),
  });
  instant(value.observedAt,'MFP_CUSTOMER_CONFIRMATION_TIME_INVALID');
  if(!Number.isSafeInteger(value.amountDeltaMinor))throw new Error('MFP_CUSTOMER_CONFIRMATION_AMOUNT_INVALID');
  let active:Promise<unknown>|null=null;let terminal:unknown=null;
  const submit=()=>{
    if(value.state==='UNKNOWN')return Promise.resolve(Object.freeze({state:'PENDING' as const,confirmationState:'UNKNOWN' as const}));
    if(active)return active;if(terminal)return Promise.resolve(terminal);
    const task=input.security.submitFrontlineFormalCommand(command).then(async result=>{
      if(result.state!=='COMMITTED'){terminal=Object.freeze({state:result.state,result,order:null});return terminal;}
      if(result.orderRef!==value.orderId)return Object.freeze({state:'UNKNOWN',result,order:null,readbackRequired:true});
      try{
        const order=await input.authority.readOrder(value.orderId);
        if(!order||order.orderId!==value.orderId)throw new Error('MFP_CUSTOMER_CONFIRMATION_READBACK_REQUIRED');
        terminal=Object.freeze({state:'COMMITTED',result,order:validateMfpCanonicalOrder(order)});return terminal;
      }catch{return Object.freeze({state:'UNKNOWN',result,order:null,readbackRequired:true});}
    }).finally(()=>{if(active===task)active=null;});
    active=task;return task;
  };
  return Object.freeze({submit,command});
}

export function createMfpKeetaLifecycleSession(input:{
  readonly event:MfpKeetaLifecycleEvent;
  readonly lastProviderPushedAt?:string;
  readonly security:ExternalSecurity;
  readonly authority:Pick<MfpOrderOperationsReadPort,'readOrder'>;
  readonly adapter:MfpExternalAdapter;
  readonly now?:()=>string;
}){
  const event=input.event;
  if(!event.canonicalOrderId)throw new Error('MFP_KEETA_LIFECYCLE_CANONICAL_ORDER_REQUIRED');
  const pushedAt=instant(event.providerPushedAt,'MFP_KEETA_LIFECYCLE_TIME_INVALID');
  if(input.lastProviderPushedAt&&Date.parse(pushedAt)<Date.parse(instant(input.lastProviderPushedAt,'MFP_KEETA_LIFECYCLE_TIME_INVALID')))throw new Error('MFP_KEETA_LIFECYCLE_RECONCILE_REQUIRED');
  const submissionId=`MFP-KEETA-LIFECYCLE-${text(event.providerMessageId,'MFP_KEETA_PROVIDER_MESSAGE_ID_INVALID')}`;
  const command:Omit<MfpStoreKernelCommandEnvelope,'deviceId'|'staffSessionRef'>=Object.freeze({
    schema:'mfp.store-kernel.command.v1',storeId:'MF01',submissionId,idempotencyKey:`${submissionId}-${text(event.fingerprint,'MFP_KEETA_FINGERPRINT_INVALID')}`,
    commandType:'EXTERNAL_KEETA_LIFECYCLE_APPLY',expectedRevision:null,createdAt:(input.now??(()=>new Date().toISOString()))(),
    payload:Object.freeze({orderId:event.canonicalOrderId,providerOrderId:event.providerOrderId,providerMessageId:event.providerMessageId,eventCode:event.eventCode,providerPushedAt:pushedAt}),
  });
  let active:Promise<unknown>|null=null;let terminal:unknown=null;
  const apply=()=>{
    if(active)return active;if(terminal)return Promise.resolve(terminal);
    const task=input.security.submitFrontlineFormalCommand(command).then(async result=>{
      if(result.state!=='COMMITTED'){terminal=Object.freeze({state:result.state,result,order:null,ackState:null});return terminal;}
      if(result.orderRef!==event.canonicalOrderId)return Object.freeze({state:'UNKNOWN',result,order:null,ackState:null,readbackRequired:true});
      try{
        const order=await input.authority.readOrder(event.canonicalOrderId!);
        if(!order||order.orderId!==event.canonicalOrderId)throw new Error('MFP_KEETA_LIFECYCLE_READBACK_REQUIRED');
        let ackState:'ACKNOWLEDGED'|'ATTENTION'='ATTENTION';
        try{ackState=(await input.adapter.submitExternalAction(Object.freeze({kind:'KEETA_LIFECYCLE_ACK',providerOrderId:event.providerOrderId,providerMessageId:event.providerMessageId,canonicalOrderId:order.orderId}))).state;}
        catch{/* Local canonical state is not rewritten by provider ACK failure. */}
        terminal=Object.freeze({state:'COMMITTED',result,order:validateMfpCanonicalOrder(order),ackState});return terminal;
      }catch{return Object.freeze({state:'UNKNOWN',result,order:null,ackState:null,readbackRequired:true});}
    }).finally(()=>{if(active===task)active=null;});
    active=task;return task;
  };
  return Object.freeze({apply,command});
}

export function decideMfpKeetaAfterSale(adapter:MfpExternalAdapter,value:MfpKeetaAfterSaleCase,decision:'APPROVE'|'REJECT',reason?:string){
  if(value.state!=='PENDING'&&value.state!=='ATTENTION')throw new Error('MFP_KEETA_AFTER_SALE_NOT_PENDING');
  return adapter.submitExternalAction(Object.freeze({kind:'KEETA_AFTER_SALE_DECISION',afterSaleOrderId:text(value.afterSaleOrderId,'MFP_KEETA_AFTER_SALE_ID_INVALID'),providerOrderId:text(value.providerOrderId,'MFP_KEETA_PROVIDER_ORDER_ID_INVALID'),canonicalOrderId:text(value.canonicalOrderId,'MFP_KEETA_AFTER_SALE_ORDER_ID_INVALID'),decision,...(reason?.trim()?{reason:reason.trim()}:{} )}));
}

export function createMfpKeetaAfterSaleRefundSession(input:{
  readonly case:MfpKeetaAfterSaleCase;
  readonly order:MfpCanonicalOrder;
  readonly amountMinor:number;
  readonly refundTenderId:string;
  readonly lineUnits:readonly Readonly<{lineId:string;quantity:number}>[];
  readonly security:ExternalSecurity;
  readonly authority:Pick<MfpOrderOperationsReadPort,'readOrder'>;
  readonly now?:()=>string;
}){
  if(input.case.state!=='APPROVED')throw new Error('MFP_KEETA_AFTER_SALE_PROVIDER_APPROVAL_REQUIRED');
  if(input.case.canonicalOrderId!==input.order.orderId)throw new Error('MFP_KEETA_AFTER_SALE_ORDER_MISMATCH');
  if(input.amountMinor>input.case.eligibleRefundMinor)throw new Error('MFP_REFUND_EXCEEDS_ELIGIBLE_AMOUNT');
  const operation=createMfpRefundOperation(input.order,{scope:'PARTIAL',amountMinor:input.amountMinor,refundTenderId:input.refundTenderId,lineUnits:input.lineUnits});
  return createMfpOrderOperationSession({operation,operationId:`MFP-KEETA-AFTER-SALE-${text(input.case.afterSaleOrderId,'MFP_KEETA_AFTER_SALE_ID_INVALID')}`,security:input.security,authority:input.authority,now:input.now});
}

export interface MfpExternalTransport{
  readExternal():Promise<unknown>;
  connectDoorbell(listener:Readonly<{onDoorbell(event:Readonly<{type:string;payload?:unknown}>):void;onOffline():void}>):()=>void;
}

export interface MfpExternalCoordinatorSnapshot{
  readonly state:'IDLE'|'READING'|'READY'|'OFFLINE'|'ATTENTION'|'ERROR';
  readonly model:MfpExternalReadModel|null;
  readonly lastReadAt:string|null;
  readonly lastError:string|null;
}

export function createMfpExternalCoordinator(input:{readonly transport:MfpExternalTransport;readonly now?:()=>string}){
  const now=input.now??(()=>new Date().toISOString());
  const listeners=new Set<()=>void>();
  let pending=false;
  let inFlight:Promise<void>|null=null;
  let snapshot:MfpExternalCoordinatorSnapshot=Object.freeze({state:'IDLE',model:null,lastReadAt:null,lastError:null});
  const update=(patch:Partial<MfpExternalCoordinatorSnapshot>)=>{snapshot=Object.freeze({...snapshot,...patch});for(const listener of listeners)listener();};
  const request=()=>{
    if(inFlight){pending=true;return inFlight;}
    const task=Promise.resolve().then(async()=>{
      try{
        let rerun=pending;pending=false;
        for(let pass=0;pass<2;pass++){
          update({state:'READING',lastError:null});
          const model=validateMfpExternalReadModel(await input.transport.readExternal() as MfpExternalReadModel);
          update({state:'READY',model,lastReadAt:now(),lastError:null});
          rerun=rerun||pending;pending=false;
          if(!rerun)return;
          if(pass===0){rerun=false;continue;}
        }
        update({state:'ATTENTION',lastError:'MFP_EXTERNAL_RECONCILE_TRAILING_LIMIT'});
      }catch(error){update({state:'ERROR',lastError:error instanceof Error?error.message:'MFP_EXTERNAL_RECONCILE_FAILED'});throw error;}
    }).finally(()=>{if(inFlight===task)inFlight=null;});
    inFlight=task;return task;
  };
  const coordinator=Object.freeze({
    getSnapshot:()=>snapshot,
    subscribe(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};},
    startup:request,
    networkOnline:request,
    manualRefresh:request,
    doorbellReceived(_event:Readonly<{type:string;payload?:unknown}>){return request();},
    networkOffline(){update({state:'OFFLINE'});},
    connectDoorbell(){return input.transport.connectDoorbell({onDoorbell:event=>{void request().catch(()=>{});void event;},onOffline(){coordinator.networkOffline();}});},
  });
  return coordinator;
}

function assertCanonicalChannelAccepting(intent:MfpExternalIntent,model:Awaited<ReturnType<ExternalAuthority['readOperations']>>){
  const productIds=new Set(intent.productIds);
  const pools=model.capacity.pools.filter(pool=>pool.boundProductIds.some(productId=>productIds.has(productId)));
  const accepting=pools.every(pool=>intent.kind==='CUSTOMER'?pool.ownPlatformAccepting:pool.thirdPartyAccepting);
  if(!accepting)throw new Error(intent.kind==='CUSTOMER'?'MFP_CUSTOMER_CHANNEL_STOPPED':'MFP_KEETA_CHANNEL_STOPPED');
}

function commandForIntent(intent:MfpExternalIntent,createdAt:string):Omit<MfpStoreKernelCommandEnvelope,'deviceId'|'staffSessionRef'> {
  const identity=stableFormalIdentity(intent);
  return Object.freeze({
    schema:'mfp.store-kernel.command.v1',storeId:'MF01',...identity,
    commandType:intent.kind==='CUSTOMER'?'EXTERNAL_CUSTOMER_ORDER_ADMIT':'EXTERNAL_KEETA_ORDER_ADMIT',
    expectedRevision:revision(intent.revision),createdAt,
    payload:intent.kind==='CUSTOMER'?Object.freeze({
      source:'MORE_FUN_APP',externalIdentity:externalIdentity(intent),submissionId:intent.submissionId,
      idempotencyKey:intent.idempotencyKey,serviceMode:intent.serviceMode,paymentMethod:intent.paymentMethod,
      paymentChannelId:intent.paymentChannelId,paymentEvidenceRef:intent.paymentEvidenceRef,
      paymentEvidenceReview:intent.evidenceReview,productIds:Object.freeze([...intent.productIds]),
    }):Object.freeze({
      source:'KEETA',externalIdentity:externalIdentity(intent),providerShopId:intent.providerShopId,
      providerOrderId:intent.providerOrderId,providerMessageId:intent.providerMessageId,fingerprint:intent.fingerprint,
      providerEvidenceRef:intent.providerEvidenceRef,mappingRevision:intent.mappingRevision,
      productIds:Object.freeze([...intent.productIds]),
    }),
  });
}

export function createMfpExternalAdmissionSession(input:{
  readonly intent:MfpExternalIntent;
  readonly security:ExternalSecurity;
  readonly authority:ExternalAuthority;
  readonly adapter:MfpExternalAdapter;
  readonly now?:()=>string;
}){
  validatePendingIntent(input.intent);
  const createdAt=(input.now??(()=>new Date().toISOString()))();
  if(!Number.isFinite(Date.parse(createdAt)))throw new Error('MFP_EXTERNAL_CREATED_AT_INVALID');
  const command=commandForIntent(input.intent,createdAt);
  let active:Promise<MfpExternalAdmissionOutcome>|null=null;
  let terminal:MfpExternalAdmissionOutcome|null=null;

  const accept=()=>{
    if(active)return active;
    if(terminal)return Promise.resolve(terminal);
    const task=(async()=>{
      assertCanonicalChannelAccepting(input.intent,await input.authority.readOperations());
      const result=await input.security.submitFrontlineFormalCommand(command);
      if(result.state==='REJECTED'){
        terminal=Object.freeze({state:'REJECTED',result,order:null,ackState:null});
        return terminal;
      }
      if(result.state==='UNKNOWN')return Object.freeze({state:'UNKNOWN',result,order:null,ackState:null,readbackRequired:true}) as MfpExternalAdmissionOutcome;
      if(!result.orderRef)return Object.freeze({state:'UNKNOWN',result,order:null,ackState:null,readbackRequired:true}) as MfpExternalAdmissionOutcome;
      try{
        const order=await input.authority.readOrder(result.orderRef);
        if(!order||order.orderId!==result.orderRef)throw new Error('MFP_EXTERNAL_CANONICAL_ORDER_READBACK_REQUIRED');
        const expectedSource=input.intent.kind==='CUSTOMER'?'MORE_FUN_APP':'KEETA';
        if(order.source!==expectedSource)throw new Error('MFP_EXTERNAL_CANONICAL_ORDER_SOURCE_MISMATCH');
        let ackState:'ACKNOWLEDGED'|'ATTENTION'='ATTENTION';
        try{
          const ack=await input.adapter.submitExternalAction(Object.freeze({
            kind:'ACK_ACCEPTED',externalKind:input.intent.kind,identity:externalIdentity(input.intent),
            canonicalOrderId:order.orderId,
            ...(input.intent.kind==='KEETA'?{providerMessageId:input.intent.providerMessageId}:{}),
          }));
          ackState=ack.state;
        }catch{/* Canonical Order stays committed; provider ACK remains attention. */}
        terminal=Object.freeze({state:'COMMITTED',result,order:validateMfpCanonicalOrder(order),ackState});
        return terminal;
      }catch{
        return Object.freeze({state:'UNKNOWN',result,order:null,ackState:null,readbackRequired:true}) as MfpExternalAdmissionOutcome;
      }
    })().finally(()=>{if(active===task)active=null;});
    active=task;
    return task;
  };

  return Object.freeze({accept,command});
}
